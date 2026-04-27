"""
Gemini adapter — wraps google.genai.Client (async).

Supports:
- FunctionDeclaration / function_calls
- generate_content_stream for SSE delivery
- gemini-2.5-flash, gemini-3.1-flash-lite-preview, gemma models
"""
from __future__ import annotations

import os
from typing import Any, AsyncIterator, Dict, List, Optional

from .base import BaseAdapter, AdapterConfig, AdapterResponse, ToolCallRequest
from ...utils.timeout_utils import to_gemini_timeout


class GeminiAdapter(BaseAdapter):
    """Async adapter for the Google Gemini GenAI API."""

    def __init__(self, api_key: str) -> None:
        try:
            from google import genai
            from google.genai import types as gemini_types
            self._client = genai.Client(
                api_key=api_key,
                http_options={'timeout': to_gemini_timeout(120)}
            )
            self._types = gemini_types
        except ImportError as exc:
            raise RuntimeError("google-genai package is required for GeminiAdapter") from exc

    # ── Tool formatting ───────────────────────────────────────────────────

    def format_tools(self, tool_specs: List[Dict[str, Any]]) -> Any:
        types = self._types
        declarations = []
        for spec in tool_specs:
            declarations.append(
                types.FunctionDeclaration(
                    name=spec["name"],
                    description=spec["description"],
                    parametersJsonSchema=spec.get("input_schema") or spec.get("parameters") or {},
                )
            )
        return [types.Tool(functionDeclarations=declarations)]

    def format_tool_result(
        self,
        messages: List[Dict[str, Any]],
        call_id: str,
        tool_name: str,
        result: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call_id,
                "name": tool_name,
                "content": result if isinstance(result, str) else __import__("json").dumps(result, ensure_ascii=False),
            }
        )
        return messages

    # ── Private helpers ───────────────────────────────────────────────────

    def _extract_text(self, response: Any) -> str:
        chunks: List[str] = []
        candidates = list(getattr(response, "candidates", None) or [])
        if not candidates:
            return ""
        content = getattr(candidates[0], "content", None)
        parts = list(getattr(content, "parts", None) or [])
        for part in parts:
            text = getattr(part, "text", None)
            if text:
                chunks.append(str(text))
        return "".join(chunks).strip()

    @staticmethod
    def _safe_args(raw_args: Any) -> Dict[str, Any]:
        if isinstance(raw_args, dict):
            return dict(raw_args)
        try:
            return dict(raw_args or {})
        except Exception:
            return {}

    def _extract_tool_calls_from_response(self, response: Any) -> List[ToolCallRequest]:
        tool_calls: List[ToolCallRequest] = []

        # 1) Top-level helper field (present in some SDK responses)
        for call in list(getattr(response, "function_calls", None) or []):
            name = getattr(call, "name", "") or ""
            if not name:
                continue
            tool_calls.append(ToolCallRequest(
                call_id=getattr(call, "id", None) or name,
                name=name,
                args=self._safe_args(getattr(call, "args", None)),
            ))

        # 2) Canonical location: candidates[0].content.parts[].function_call
        candidates = list(getattr(response, "candidates", None) or [])
        if candidates:
            content = getattr(candidates[0], "content", None)
            for part in list(getattr(content, "parts", None) or []):
                fc = getattr(part, "function_call", None)
                if not fc:
                    continue
                name = getattr(fc, "name", "") or ""
                if not name:
                    continue
                tool_calls.append(ToolCallRequest(
                    call_id=getattr(fc, "id", None) or name,
                    name=name,
                    args=self._safe_args(getattr(fc, "args", None)),
                ))

        # Deduplicate by (name,args) while preserving order.
        deduped: List[ToolCallRequest] = []
        seen = set()
        for tc in tool_calls:
            key = (tc.name, str(sorted(tc.args.items())))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(tc)
        return deduped

    def _extract_assistant_blocks(self, response: Any) -> List[Dict[str, Any]]:
        blocks: List[Dict[str, Any]] = []
        candidates = list(getattr(response, "candidates", None) or [])
        if not candidates:
            return blocks

        content = getattr(candidates[0], "content", None)
        for part in list(getattr(content, "parts", None) or []):
            text = getattr(part, "text", None)
            if text:
                blocks.append({"type": "text", "text": str(text)})
            fc = getattr(part, "function_call", None)
            if fc:
                name = getattr(fc, "name", "") or "tool"
                blocks.append({
                    "type": "function_call",
                    "name": name,
                    "args": self._safe_args(getattr(fc, "args", None)),
                })
        return blocks

    def _build_gemini_contents(self, messages: List[Dict[str, Any]]) -> List[Any]:
        """
        Convert our internal message list (history_messages format) to
        Gemini Content objects.
        """
        types = self._types
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content") or ""

            if role == "tool":
                tool_name = msg.get("name") or msg.get("tool_name") or "tool"
                tool_response = content
                if isinstance(tool_response, str):
                    try:
                        parsed = __import__("json").loads(tool_response)
                        tool_response = parsed if isinstance(parsed, dict) else {"result": parsed}
                    except Exception:
                        tool_response = {"result": tool_response}
                elif not isinstance(tool_response, dict):
                    tool_response = {"result": tool_response}

                contents.append(
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=tool_name,
                                response=tool_response,
                            )
                        ],
                    )
                )
                continue

            if role == "assistant":
                gemini_role = "model"
            elif role == "system":
                continue  # system handled via GenerateContentConfig
            else:
                gemini_role = "user"

            if hasattr(content, "parts"):
                contents.append(content)
                continue

            if isinstance(content, str):
                if content:
                    contents.append(
                        types.Content(role=gemini_role, parts=[types.Part.from_text(text=content)])
                    )
            elif isinstance(content, list):
                parts = []
                for block in content:
                    block_type = block.get("type")
                    if block_type == "text" and block.get("text"):
                        parts.append(types.Part.from_text(text=block.get("text", "")))
                    elif block_type in {"tool_use", "function_call"}:
                        tool_name = block.get("name") or block.get("tool_name") or "tool"
                        tool_args = block.get("input") or block.get("args") or {}
                        parts.append(
                            types.Part.from_function_call(
                                name=tool_name,
                                args=tool_args,
                            )
                        )
                if parts:
                    contents.append(types.Content(role=gemini_role, parts=parts))

        return contents

    # ── Core inference ────────────────────────────────────────────────────

    async def generate(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AdapterResponse:
        import asyncio

        types = self._types
        contents = self._build_gemini_contents(messages)

        gen_config = types.GenerateContentConfig(
            system_instruction=system_prompt or None,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            tools=tools,
            http_options=types.HttpOptions(timeout=to_gemini_timeout(120)),
        )

        # google-genai SDK is synchronous; run in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._client.models.generate_content(
                model=config.model,
                contents=contents,
                config=gen_config,
            ),
        )

        if os.getenv("GEMINI_ADAPTER_DEBUG", "").strip() == "1":
            print("[GeminiAdapter] GEMINI RAW:", response)

        tool_calls = self._extract_tool_calls_from_response(response)

        if tool_calls:
            assistant_blocks = self._extract_assistant_blocks(response)
            if assistant_blocks:
                messages.append({"role": "assistant", "content": assistant_blocks})
            else:
                text_fallback = self._extract_text(response)
                messages.append({"role": "assistant", "content": text_fallback})

        text = self._extract_text(response)
        return AdapterResponse(
            text=text if not tool_calls else "",
            tool_calls=tool_calls,
            raw=response,
            token_estimate=len(text) // 4,
        )

    async def stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        import asyncio

        types = self._types
        contents = self._build_gemini_contents(messages)
        gen_config = types.GenerateContentConfig(
            system_instruction=system_prompt or None,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            tools=tools,
            tool_config={"function_calling_config": {"mode": "AUTO"}} if tools else None,
            http_options=types.HttpOptions(timeout=to_gemini_timeout(120)),
        )

        loop = asyncio.get_event_loop()

        def _iter():
            return self._client.models.generate_content_stream(
                model=config.model,
                contents=contents,
                config=gen_config,
            )

        stream_iter = await loop.run_in_executor(None, _iter)

        def _collect():
            chunks = []
            for item in stream_iter:
                text = getattr(item, "text", None) or self._extract_text(item)
                if text:
                    chunks.append(text)
            return chunks

        chunks = await loop.run_in_executor(None, _collect)
        for chunk in chunks:
            yield chunk
