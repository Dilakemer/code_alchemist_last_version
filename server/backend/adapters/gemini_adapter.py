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
    
    def _build_gen_config(self, config: AdapterConfig, system_prompt: str, tools: Optional[Any], tool_config: Optional[Any] = None) -> Any:
        """Centralized helper to build GenerateContentConfig with thinking_config support."""
        types = self._types
        
        # Determine if thinking_config is needed (Gemini 3 or explicit thinking models)
        thinking_config = None
        model_lc = config.model.lower()
        if 'gemini-3' in model_lc or 'thinking' in model_lc:
            try:
                # Preferred: Use typed object for better SDK compatibility
                thinking_config = types.ThinkingConfig(thinking_level="LOW")
            except AttributeError:
                # Fallback: Some SDK versions might expect a dictionary
                thinking_config = {'thinking_level': 'LOW'}
            
        return types.GenerateContentConfig(
            system_instruction=system_prompt or None,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
            tools=tools,
            tool_config=tool_config,
            thinking_config=thinking_config,
            http_options=types.HttpOptions(timeout=to_gemini_timeout(120)),
        )

    # ── Private helpers ───────────────────────────────────────────────────

    @staticmethod
    def _clean_model_output(text: str, is_reasoning: bool = False) -> str:
        """
        Type-aware cleaning pipeline.
        - Reasoning blocks: Minimal cleaning (keep prose, remove tags).
        - Final answers: Aggressive cleaning (remove metadata, instructions).
        """
        import re
        if not text:
            return ""

        # 1. Block Tag Removal (Always remove for both types)
        _TAGS = [
            (r'<think>', r'</think>'),
            (r'<thought>', r'</thought>'),
            (r'<thinking>', r'</thinking>'),
            (r'<reasoning>', r'</reasoning>'),
        ]
        for open_tag, close_tag in _TAGS:
            text = re.sub(open_tag + r'.*?' + close_tag, '', text, flags=re.DOTALL | re.IGNORECASE)
            # Also remove dangling tags
            text = re.sub(open_tag, '', text, flags=re.IGNORECASE)
            text = re.sub(close_tag, '', text, flags=re.IGNORECASE)

        if is_reasoning:
            # For reasoning, we just want to remove technical markers but keep the prose.
            text = re.sub(r'^\s*#+\s*(thinking|thought|reasoning|plan|analysis).*', '', text, flags=re.MULTILINE | re.IGNORECASE)
            return text.strip()

        # 2. Aggressive Cleaning for Final Answer
        # Remove whole sections that look like internal checklists / metadata blocks.
        block_headers = (
            r'Constraint Checklist.*?(?=\n\n|\Z)'
            r'|\*\* Constraint Checklist.*?(?=\n\n|\Z)'
        )
        text = re.sub(block_headers, '', text, flags=re.DOTALL | re.IGNORECASE)

        # Remove individual label lines (surgical removal)
        label_pattern = r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?([a-z0-9\/\?\(\)\-\+ ]{2,50}):(\*\*|\*)?\s*(.*)'
        forbidden_keywords = [
            'metadata', 'persona', 'thinking process', 'reasoning steps', 
            'short sentences', 'direct answer', 'echoing instructions',
            'helpful ai assistant', 'user profile', 'expertise level',
            'natural conversation', 'internal analysis', 'thinking block'
        ]
        
        lines = text.split('\n')
        cleaned_lines = []
        for line in lines:
            lower_line = line.lower()
            if any(kw in lower_line for kw in forbidden_keywords):
                continue

            match = re.match(label_pattern, line)
            if match:
                content = match.group(5).strip()
                if content.lower() in ['yes', 'no', 'true', 'false', 'yes.', 'no.', 'turkish', 'english', 'natural']:
                    continue
                else:
                    cleaned_lines.append(content)
            else:
                cleaned_lines.append(line)
        
        text = '\n'.join(cleaned_lines)

        line_patterns = [
            r'(?i)^\s*#+\s*thinking.*',
            r'(?i)^\s*#+\s*thought.*',
            r'(?i)^\s*#+\s*reasoning.*',
            r'(?i)^\s*#+\s*plan.*',
            r'(?i)^\s*#+\s*analysis.*',
            r'(?i)^\s*#+\s*strategy.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?no internal (analysis|reasoning|thinking).*:?(\*\*|\*)?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?no (reasoning|thinking) blocks?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?no markdown labels?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?no image generation.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?confidence score:?(\*\*|\*)?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?(expertise|user expertise):?(\*\*|\*)?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?system:?(\*\*|\*)?.*',
            r'(?i)^\s*(\*|\-)?\s*(\*\*|\*)?assistant:?(\*\*|\*)?.*',
        ]
        for pattern in line_patterns:
            text = re.sub(pattern, '', text, flags=re.MULTILINE)

        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()

        # De-duplicate back-to-back sentences
        text = re.sub(r'^"(.+?)"\s+\1\s*$', r'\1', text, flags=re.DOTALL)
        text = re.sub(r'^"(.+?)"\s+"\1"\s*$', r'\1', text, flags=re.DOTALL)
        text = re.sub(r'^"(.+)"$', r'\1', text, flags=re.DOTALL)

        return text.strip()

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

        return self._clean_model_output("".join(chunks))

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
        on_chunk: Optional[callable] = None,
        on_reasoning: Optional[callable] = None,
    ) -> AdapterResponse:
        import asyncio
        import os

        types = self._types
        contents = self._build_gemini_contents(messages)

        gen_config = self._build_gen_config(config, system_prompt, tools)

        loop = asyncio.get_event_loop()

        if on_chunk or on_reasoning:
            # ── Streaming Path ───────────────────────────────────────────
            def _sync_stream():
                accumulated_text = ""
                accumulated_thought = ""
                it = self._client.models.generate_content_stream(
                    model=config.model,
                    contents=contents,
                    config=gen_config,
                )
                last_chunk = None
                for chunk in it:
                    last_chunk = chunk
                    candidates = getattr(chunk, "candidates", [])
                    if candidates:
                        content = getattr(candidates[0], "content", None)
                        parts = getattr(content, "parts", []) if content else []
                        for part in parts:
                            # 1. Handle Text
                            txt = getattr(part, "text", None)
                            if txt:
                                accumulated_text += txt
                                if on_chunk:
                                    loop.call_soon_threadsafe(on_chunk, txt)
                            
                            # 2. Handle Gemini 3 Thought
                            thought = getattr(part, "thought", None)
                            if thought:
                                accumulated_thought += thought
                                if on_reasoning:
                                    loop.call_soon_threadsafe(on_reasoning, thought)
                return last_chunk, accumulated_text, accumulated_thought

            final_response, raw_text, raw_thought = await loop.run_in_executor(None, _sync_stream)
            text = self._clean_model_output(raw_text)
            thought = self._clean_model_output(raw_thought, is_reasoning=True)
            response = final_response
        else:
            # ── Legacy Non-Streaming Path ────────────────────────────────
            response = await loop.run_in_executor(
                None,
                lambda: self._client.models.generate_content(
                    model=config.model,
                    contents=contents,
                    config=gen_config,
                ),
            )
            raw_text = ""
            raw_thought = ""
            candidates = getattr(response, "candidates", [])
            if candidates:
                content = getattr(candidates[0], "content", None)
                parts = getattr(content, "parts", []) if content else []
                for part in parts:
                    txt = getattr(part, "text", None)
                    if txt: raw_text += txt
                    th = getattr(part, "thought", None)
                    if th: raw_thought += th
            
            text = self._clean_model_output(raw_text)
            thought = self._clean_model_output(raw_thought, is_reasoning=True)

        if os.getenv("GEMINI_ADAPTER_DEBUG", "").strip() == "1":
            print("[GeminiAdapter] GEMINI RAW:", response)

        tool_calls = self._extract_tool_calls_from_response(response) if response else []

        if tool_calls:
            assistant_blocks = self._extract_assistant_blocks(response)
            if assistant_blocks:
                messages.append({"role": "assistant", "content": assistant_blocks})
            else:
                messages.append({"role": "assistant", "content": text})

        return AdapterResponse(
            text=text if not tool_calls else "",
            reasoning=thought,
            tool_calls=tool_calls,
            raw=response,
            token_estimate=(len(text) + len(thought)) // 4,
        )

    async def stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        """Stream response token-by-token using asyncio.Queue.

        A background thread iterates the synchronous SDK stream and pushes each
        raw text chunk into a queue.  The async side drains the queue and yields
        each chunk to the caller immediately — without waiting for the full
        response.  A lightweight cleaning pass is applied to each chunk to strip
        the most common single-line metadata labels.  A final, full-text cleaning
        pass deduplicates and removes any multi-line / cross-chunk artefacts.
        """
        import asyncio

        types = self._types
        contents = self._build_gemini_contents(messages)
        tool_config = {"function_calling_config": {"mode": "AUTO"}} if tools else None
        gen_config = self._build_gen_config(config, system_prompt, tools, tool_config=tool_config)

        loop = asyncio.get_event_loop()
        queue: asyncio.Queue = asyncio.Queue()
        _SENTINEL = object()

        def _produce():
            """Run in thread-pool; push each SDK chunk into the queue."""
            try:
                stream_iter = self._client.models.generate_content_stream(
                    model=config.model,
                    contents=contents,
                    config=gen_config,
                )
                for item in stream_iter:
                    text = getattr(item, "text", None) or ""
                    if not text:
                        # Try deeper extraction (e.g. Gemma candidates)
                        text = ""
                        candidates = list(getattr(item, "candidates", None) or [])
                        if candidates:
                            content = getattr(candidates[0], "content", None)
                            for part in list(getattr(content, "parts", None) or []):
                                pt = getattr(part, "text", None)
                                if pt:
                                    text += pt
                    if text:
                        loop.call_soon_threadsafe(queue.put_nowait, text)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

        # Start producer in thread pool (non-blocking for async side)
        loop.run_in_executor(None, _produce)

        # ── Streaming think-block filter ──────────────────────────────────
        # Gemma models emit <think>…</think> blocks mid-stream.  We buffer
        # chunks while inside a think block and never yield them to the caller.
        # A chunk may contain BOTH think content AND real text (e.g. the closing
        # </think> tag followed by the actual response), so we split carefully.
        #
        # State machine:
        #   _in_think=True  → we are inside a think block; suppress output
        #   _in_think=False → normal output; yield immediately
        #
        # We also keep `accumulated` for the post-stream full-text clean pass.
        _OPEN_TAGS  = ['<think>', '<thought>', '<thinking>', '<reasoning>']
        _CLOSE_TAGS = ['</think>', '</thought>', '</thinking>', '</reasoning>']

        _in_think = False
        accumulated: List[str] = []

        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            if isinstance(item, Exception):
                raise item

            # Fast-path: no think-related markers → yield immediately
            chunk_lower = item.lower()
            has_open  = any(t in chunk_lower for t in _OPEN_TAGS)
            has_close = any(t in chunk_lower for t in _CLOSE_TAGS)

            if not _in_think and not has_open:
                accumulated.append(item)
                yield item
                continue

            # Slow-path: parse the chunk character-by-character to find
            # think block boundaries and extract only the real-text parts.
            remaining = item
            visible_parts: List[str] = []

            while remaining:
                if _in_think:
                    # Look for the earliest closing tag
                    close_idx = -1
                    close_len = 0
                    for ctag in _CLOSE_TAGS:
                        idx = remaining.lower().find(ctag)
                        if idx != -1 and (close_idx == -1 or idx < close_idx):
                            close_idx = idx
                            close_len = len(ctag)
                    if close_idx == -1:
                        # Still inside think block; discard the whole remainder
                        remaining = ''
                    else:
                        # Exit think block; discard up to and including close tag
                        remaining = remaining[close_idx + close_len:]
                        _in_think = False
                else:
                    # Look for the earliest opening tag
                    open_idx = -1
                    open_len = 0
                    for otag in _OPEN_TAGS:
                        idx = remaining.lower().find(otag)
                        if idx != -1 and (open_idx == -1 or idx < open_idx):
                            open_idx = idx
                            open_len = len(otag)
                    if open_idx == -1:
                        # No think block in this remainder; keep it all
                        visible_parts.append(remaining)
                        remaining = ''
                    else:
                        # Emit text before the opening tag, then enter think mode
                        visible_parts.append(remaining[:open_idx])
                        remaining = remaining[open_idx + open_len:]
                        _in_think = True

            if visible_parts:
                visible_text = ''.join(visible_parts)
                if visible_text:
                    accumulated.append(visible_text)
                    yield visible_text

        # Post-stream: apply full cleaning to catch any remaining cross-chunk
        # artefacts (metadata labels, duplicate sentences, etc.).
        if accumulated:
            full_raw = ''.join(accumulated)
            full_cleaned = self._clean_model_output(full_raw)
            if full_cleaned != full_raw.strip():
                if os.getenv('GEMINI_ADAPTER_DEBUG', '').strip() == '1':
                    print('[GeminiAdapter] post-stream clean applied (cross-chunk artefact removed)')
