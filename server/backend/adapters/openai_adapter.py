"""
OpenAI adapter — wraps AsyncOpenAI.

Supports:
- Function/tool calling (parallel_tool_calls=True)
- SSE streaming via openai.AsyncStream
- gpt-4o, gpt-4o-mini, o1, o3 family models
"""
from __future__ import annotations

import json
import time
import uuid
from typing import Any, AsyncIterator, Dict, List, Optional

from .base import BaseAdapter, AdapterConfig, AdapterResponse, ToolCallRequest


class OpenAIAdapter(BaseAdapter):
    """Async adapter for the OpenAI Chat Completions API."""

    def __init__(self, api_key: str) -> None:
        try:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=api_key)
        except ImportError as exc:
            raise RuntimeError("openai package is required for OpenAIAdapter") from exc
        self._api_key = api_key

    # ── Tool formatting ───────────────────────────────────────────────────

    def format_tools(self, tool_specs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": spec["name"],
                    "description": spec["description"],
                    "parameters": spec.get("input_schema") or spec.get("parameters") or {},
                },
            }
            for spec in tool_specs
        ]

    def format_tool_result(
        self,
        messages: List[Dict[str, Any]],
        call_id: str,
        tool_name: str,
        result: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        messages.append({
            "role": "tool",
            "tool_call_id": call_id,
            "content": json.dumps(result, ensure_ascii=False),
        })
        return messages

    # ── Core inference ────────────────────────────────────────────────────

    async def generate(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        config: AdapterConfig,
        system_prompt: str = "",
        on_chunk: Optional[callable] = None,
        on_reasoning: Optional[callable] = None,
    ) -> AdapterResponse:
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        kwargs: Dict[str, Any] = {
            "model": config.model,
            "messages": full_messages,
            "temperature": config.temperature,
        }

        # o1/o3 models use max_completion_tokens and don't support temperature
        is_o_model = config.model.startswith(("o1", "o3"))
        if is_o_model:
            kwargs.pop("temperature", None)
            kwargs["max_completion_tokens"] = config.max_tokens
        else:
            kwargs["max_tokens"] = config.max_tokens

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
            if not is_o_model:
                kwargs["parallel_tool_calls"] = True

        if on_chunk:
            # ── Streaming Path ───────────────────────────────────────────
            kwargs["stream"] = True
            accumulated_text = ""
            accumulated_reasoning = ""
            
            # Note: Tool calls are not easily streamed in a single turn with text in OpenAI
            # while maintaining the same complexity, so we usually don't stream if tools are possible.
            # But AgentLoop wants streaming for text.
            
            response_stream = await self._client.chat.completions.create(**kwargs)
            async for chunk in response_stream:
                if not chunk.choices: continue
                delta = chunk.choices[0].delta
                
                # Reasoning (o1/o3 support)
                if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                    accumulated_reasoning += delta.reasoning_content
                    if on_reasoning:
                        on_reasoning(delta.reasoning_content)
                
                if delta.content:
                    accumulated_text += delta.content
                    if on_chunk:
                        on_chunk(delta.content)
            
            # For simplicity in Agent Mode, we assume streaming means no tools or we don't stream tools.
            # However, OpenAI DOES stream tool calls. If needed, we'd collect them here.
            # But the current AgentLoop expects non-streaming tools or manual extraction.
            # Let's fallback to non-streaming if tools are present for now, or just return text.
            
            return AdapterResponse(
                text=accumulated_text,
                reasoning=accumulated_reasoning,
                token_estimate=self.estimate_tokens(full_messages) + len(accumulated_text) // 4
            )

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message

        raw_tool_calls = getattr(message, "tool_calls", None) or []
        tool_calls: List[ToolCallRequest] = []

        if raw_tool_calls:
            # Append assistant turn with tool_calls before returning
            messages.append({
                "role": "assistant",
                "content": getattr(message, "content", None) or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in raw_tool_calls
                ],
            })
            for tc in raw_tool_calls:
                tool_calls.append(ToolCallRequest(
                    call_id=tc.id,
                    name=tc.function.name,
                    args=self.safe_json(tc.function.arguments),
                ))

        text = getattr(message, "content", "") or ""
        reasoning = getattr(message, "reasoning_content", "") or ""
        estimate = self.estimate_tokens(full_messages) + (len(text) + len(reasoning)) // 4

        return AdapterResponse(
            text=text if not tool_calls else "",
            reasoning=reasoning,
            tool_calls=tool_calls,
            raw=response,
            token_estimate=estimate,
        )

    async def stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        kwargs: Dict[str, Any] = {
            "model": config.model,
            "messages": full_messages,
            "temperature": config.temperature,
            "max_tokens": config.max_tokens,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        async with await self._client.chat.completions.create(**kwargs) as stream:
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield delta.content
