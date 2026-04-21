"""
Anthropic adapter — wraps AsyncAnthropic.

Supports:
- Tool use (tool_use content blocks)
- Input / output beta headers where needed
- claude-opus-4-5-20251101, claude-sonnet-4-5-20250929, claude-haiku-3-5
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, List, Optional

from .base import BaseAdapter, AdapterConfig, AdapterResponse, ToolCallRequest


class AnthropicAdapter(BaseAdapter):
    """Async adapter for the Anthropic Messages API."""

    def __init__(self, api_key: str) -> None:
        try:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=api_key)
        except ImportError as exc:
            raise RuntimeError("anthropic package is required for AnthropicAdapter") from exc

    # ── Tool formatting ───────────────────────────────────────────────────

    def format_tools(self, tool_specs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [
            {
                "name": spec["name"],
                "description": spec["description"],
                "input_schema": spec.get("input_schema") or spec.get("parameters") or {},
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
        # Anthropic expects tool_result inside a user-role message
        last = messages[-1] if messages else None
        result_block = {
            "type": "tool_result",
            "tool_use_id": call_id,
            "content": json.dumps(result, ensure_ascii=False),
        }
        if last and last.get("role") == "user" and isinstance(last.get("content"), list):
            last["content"].append(result_block)
        else:
            messages.append({"role": "user", "content": [result_block]})
        return messages

    # ── Private helpers ───────────────────────────────────────────────────

    @staticmethod
    def _extract_text(blocks: List[Any]) -> str:
        parts = []
        for block in blocks:
            if getattr(block, "type", None) == "text" and getattr(block, "text", None):
                parts.append(block.text)
        return "".join(parts).strip()

    @staticmethod
    def _extract_tool_blocks(blocks: List[Any]) -> List[Any]:
        return [b for b in blocks if getattr(b, "type", None) == "tool_use"]

    # ── Core inference ────────────────────────────────────────────────────

    async def generate(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AdapterResponse:
        # Ensure messages are in block format for stability
        formatted_messages = []
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            formatted_messages.append({
                "role": msg["role"],
                "content": content
            })

        kwargs: Dict[str, Any] = {
            "model": config.model,
            "max_tokens": config.max_tokens,
            "messages": formatted_messages,
            "temperature": config.temperature,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if tools:
            kwargs["tools"] = tools
            # Note: tool_choice removed as SDK handles default 'auto' better

        print(f"DEBUG ANTHROPIC KWARGS: {json.dumps({k:v for k,v in kwargs.items() if k != 'messages'}, indent=2)}")
        
        response = await self._client.messages.create(**kwargs)
        blocks = getattr(response, "content", []) or []

        tool_blocks = self._extract_tool_blocks(blocks)
        tool_calls: List[ToolCallRequest] = []

        if tool_blocks:
            # Build assistant content for the conversation history
            assistant_content = []
            for block in blocks:
                btype = getattr(block, "type", None)
                if btype == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif btype == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": block.id,
                        "name": block.name,
                        "input": block.input,
                    })
            messages.append({"role": "assistant", "content": assistant_content})

            for block in tool_blocks:
                raw_input = block.input
                args = raw_input if isinstance(raw_input, dict) else self.safe_json(raw_input)
                tool_calls.append(ToolCallRequest(
                    call_id=block.id,
                    name=block.name,
                    args=args,
                ))

        text = self._extract_text(blocks)
        return AdapterResponse(
            text=text if not tool_calls else "",
            tool_calls=tool_calls,
            raw=response,
            token_estimate=(getattr(response, "usage", None) and
                            getattr(response.usage, "input_tokens", 0) +
                            getattr(response.usage, "output_tokens", 0)) or 0,
        )

    async def stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        # Ensure messages are in block format for stability
        formatted_messages = []
        for msg in messages:
            content = msg.get("content")
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            formatted_messages.append({
                "role": msg["role"],
                "content": content
            })

        kwargs: Dict[str, Any] = {
            "model": config.model,
            "max_tokens": config.max_tokens,
            "messages": formatted_messages,
            "temperature": config.temperature,
            "stream": True,
        }
        if system_prompt:
            kwargs["system"] = system_prompt
        if tools:
            kwargs["tools"] = tools
            # Note: tool_choice removed as SDK handles default 'auto' better

        print(f"DEBUG ANTHROPIC STREAM KWARGS: {json.dumps({k:v for k,v in kwargs.items() if k != 'messages'}, indent=2)}")

        async with await self._client.messages.create(**kwargs) as stream:
             async for event in stream:
                 if event.type == "content_block_delta" and event.delta.type == "text_delta":
                     yield event.delta.text
