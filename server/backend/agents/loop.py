"""
Core AgentLoop — the heart of the agent runtime.

The loop runs until one of three exit conditions:
  1. The model produces a final text answer (no tool calls)
  2. max_tool_calls is reached
  3. An unrecoverable error occurs

The loop emits AgentEvents on an asyncio.Queue that the runtime
layer drains and serialises to SSE. This keeps the loop logic
separate from the transport.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, AsyncIterator, Dict, List, Optional

from ..adapters.base import AdapterConfig, AdapterResponse, BaseAdapter, ToolCallRequest
from ..agents.base import (
    AgentEvent,
    AgentEventType,
    AgentResult,
    ChangedFile,
    ToolTrace,
)
from ..tools.registry import ToolRegistry
from ..runtime.limits import ContextCompressor, TokenBudget


_SENTINEL = object()   # signals the queue is exhausted


class AgentLoop:
    """
    Async agentic loop.

    Typical usage::

        loop = AgentLoop(adapter, tool_registry)
        async for event in loop.run(ctx):
            yield sse.build_sse_event(event.type, event.payload)
    """

    def __init__(
        self,
        adapter: BaseAdapter,
        tool_registry: ToolRegistry,
        compressor: Optional[ContextCompressor] = None,
        *,
        provider: Optional[str] = None,
        provider_semaphores: Optional[Dict[str, asyncio.Semaphore]] = None,
        model_queue_timeout: float = 8.0,
    ) -> None:
        self._adapter = adapter
        self._registry = tool_registry
        self._compressor = compressor or ContextCompressor()
        self._provider = (provider or "").lower()
        self._provider_semaphores = provider_semaphores or {}
        self._model_queue_timeout = max(0.1, float(model_queue_timeout or 8.0))

    # ── Public entry point ────────────────────────────────────────────────

    async def run(self, ctx: Any) -> AsyncIterator[AgentEvent]:
        """
        Drive the agent loop and yield AgentEvents.

        *ctx* is an AgentContextWithState (duck-typed for testability).
        """
        queue: asyncio.Queue = asyncio.Queue()

        async def _produce():
            try:
                await self._loop(ctx, queue)
            except Exception as exc:
                await queue.put(AgentEvent(
                    type=AgentEventType.ERROR,
                    payload={"message": str(exc), "code": "LOOP_ERROR"},
                ))
            finally:
                await queue.put(_SENTINEL)

        producer = asyncio.create_task(_produce())

        try:
            while True:
                event = await queue.get()
                if event is _SENTINEL:
                    break
                yield event
        finally:
            producer.cancel()

    # ── Internal loop ─────────────────────────────────────────────────────

    async def _loop(self, ctx: Any, queue: asyncio.Queue) -> None:
        budget = TokenBudget(max_tokens=max(int(ctx.max_tokens or 8000), 16000))
        max_files_touched = max(1, int(getattr(ctx, "max_files_touched", 3) or 3))
        max_reads_per_file = max(1, int(getattr(ctx, "max_reads_per_file", 2) or 2))
        min_token_reserve = max(0, int(getattr(ctx, "min_token_reserve", 512) or 0))
        touched_files: set[str] = set()
        file_read_counts: Dict[str, int] = {}

        # Emit initial status
        await queue.put(AgentEvent(
            type=AgentEventType.STATUS,
            payload={"message": "📊 Sorunu analiz ediliyor..."},
        ))

        # Build the initial message list
        messages: List[Dict[str, Any]] = list(ctx.history_messages or [])

        # Add current user message
        user_content = (ctx.question or "").strip()
        if ctx.code and ctx.code.strip():
            user_content += f"\n\nRelated code:\n```\n{ctx.code.strip()}\n```"
        messages.append({"role": "user", "content": user_content})

        print(f"\n[AgentLoop] Starting run_id: {ctx.run_id}")
        print(f"[AgentLoop] Model: {ctx.model} | Provider: {ctx.provider}")
        print(f"[AgentLoop] Question: {ctx.question[:100]}...")

        # Compress history to stay within budget
        messages = self._compressor.compress(messages)
        budget.add_messages(messages)

        trace: List[ToolTrace] = []
        web_search_count = 0  # Track web_search tool invocations
        last_tool_result_weak = False  # Track if last search was weak

        if not budget.can_spend(1, reserve=min_token_reserve):
            await queue.put(AgentEvent(
                type=AgentEventType.MESSAGE,
                payload={"text": "Agent stopped because the token budget was exhausted before the first model call."},
            ))
            await self._emit_done(
                ctx, queue, trace, finish_reason="token_budget_exhausted",
                total_steps=0, budget=budget,
            )
            return

        # Build tool specs once
        tool_specs = self._registry.get_specs()
        formatted_tools = self._adapter.format_tools(tool_specs) if tool_specs else None

        config = AdapterConfig(
            model=ctx.model,
            temperature=ctx.temperature,
            max_tokens=min(ctx.max_tokens, 4096),
            stream=False,
        )

        for step in range(ctx.max_tool_calls + 1):
            if not budget.can_spend(1, reserve=min_token_reserve):
                await queue.put(AgentEvent(
                    type=AgentEventType.MESSAGE,
                    payload={"text": "Agent stopped because the token budget was exhausted."},
                ))
                await self._emit_done(
                    ctx, queue, trace, finish_reason="token_budget_exhausted",
                    total_steps=step, budget=budget,
                )
                return

            # Emit thinking status
            status_emoji = "🔍" if last_tool_result_weak else "🧠"
            status_msg = "Arama yapılıyor..." if last_tool_result_weak else "Düşünülüyor..."
            await queue.put(AgentEvent(
                type=AgentEventType.STATUS,
                payload={"message": f"{status_emoji} {status_msg}"},
            ))

            # ── Call the model ────────────────────────────────────────────
            loop = asyncio.get_event_loop()
            
            # Reasoning Buffer Logic: Avoid UI spam by buffering thought chunks
            reasoning_buffer = []
            reasoning_threshold = 100 # chars

            async def _on_reasoning(chunk: str):
                reasoning_buffer.append(chunk)
                if sum(len(c) for c in reasoning_buffer) >= reasoning_threshold:
                    combined = "".join(reasoning_buffer)
                    reasoning_buffer.clear()
                    await queue.put(AgentEvent(
                        type=AgentEventType.REASONING,
                        payload={"text": combined, "partial": True}
                    ))

            async def _on_chunk(chunk: str):
                # If we have reasoning buffered, flush it before text starts
                if reasoning_buffer:
                    combined = "".join(reasoning_buffer)
                    reasoning_buffer.clear()
                    await queue.put(AgentEvent(
                        type=AgentEventType.REASONING,
                        payload={"text": combined, "partial": True}
                    ))
                
                # Emit partial message chunk to the stream
                await queue.put(AgentEvent(
                    type=AgentEventType.MESSAGE,
                    payload={"text": chunk, "partial": True},
                ))

            stream_callbacks_enabled = not formatted_tools

            response: AdapterResponse = await self._generate_with_provider_limit(
                messages=messages,
                tools=formatted_tools,
                config=config,
                system_prompt=ctx.system_prompt,
                on_chunk=(lambda c: asyncio.run_coroutine_threadsafe(_on_chunk(c), loop)) if stream_callbacks_enabled else None,
                on_reasoning=(lambda c: asyncio.run_coroutine_threadsafe(_on_reasoning(c), loop)) if stream_callbacks_enabled else None,
            )

            # Guard: adapter may return None on unexpected errors
            if response is None:
                print(f"[AgentLoop] [Step {step}] Adapter returned None response — aborting loop.")
                await self._emit_done(
                    ctx, queue, trace, finish_reason="error",
                    total_steps=step, budget=budget,
                )
                return

            # Final flush of reasoning if any left
            if reasoning_buffer:
                combined = "".join(reasoning_buffer)
                reasoning_buffer.clear()
                await queue.put(AgentEvent(
                    type=AgentEventType.REASONING,
                    payload={"text": combined, "partial": True}
                ))

            print(f"[AgentLoop] [Step {step}] Model responded. Text: {len(response.text or '')} | Reasoning: {len(response.reasoning or '')} | Tool calls: {len(response.tool_calls)}")
            if response.text:
                preview = response.text[:200].replace("\n", " ")
                print(f"[AgentLoop] [Step {step}] Message: {preview}...")
            budget.add(response.text)
            budget.add(response.reasoning)

            # ── Weak search result policy: force retry if needed ────────────
            if response.is_final and last_tool_result_weak and web_search_count < 2:
                print(f"[AgentLoop] [Step {step}] Weak search results detected. Model tried to finalize but we need more searches. Forcing retry...")
                # Reset flags and force tool call for web_search
                last_tool_result_weak = False
                # Inject a system message to force model to search again
                messages.append({
                    "role": "user",
                    "content": "Önceki arama sonuçları yetersizdi. Lütfen farklı bir sorgu ile tekrar denemeyi yaparak daha detaylı bilgi arayın."
                })
                continue  # Go to next loop iteration

            # ── Final answer ──────────────────────────────────────────────
            if response.is_final or not response.tool_calls:
                if response.text:
                    await queue.put(AgentEvent(
                        type=AgentEventType.MESSAGE,
                        payload={"text": response.text, "full": True},
                    ))
                await self._emit_done(
                    ctx, queue, trace, finish_reason="stop",
                    total_steps=step, budget=budget,
                )
                return

            # ── Tool calls ────────────────────────────────────────────────
            if step >= ctx.max_tool_calls:
                await queue.put(AgentEvent(
                    type=AgentEventType.MESSAGE,
                    payload={
                        "text": "Agent reached the maximum number of tool calls without producing a final answer."
                    },
                ))
                await self._emit_done(
                    ctx, queue, trace, finish_reason="max_steps",
                    total_steps=step, budget=budget,
                )
                return

            # Reset weak flag for next iteration
            last_tool_result_weak = False
            
            for tc in response.tool_calls:
                if not await self._can_dispatch_tool(
                    tc=tc,
                    touched_files=touched_files,
                    file_read_counts=file_read_counts,
                    max_files_touched=max_files_touched,
                    max_reads_per_file=max_reads_per_file,
                    queue=queue,
                    ctx=ctx,
                    trace=trace,
                    budget=budget,
                    step=step,
                ):
                    return

                if tc.name == "web_search":
                    web_search_count += 1
                
                tool_result = await self._dispatch_tool(
                    tc=tc, step=step, ctx=ctx, messages=messages,
                    trace=trace, queue=queue, budget=budget,
                )

                self._record_tool_usage(tc, tool_result, touched_files, file_read_counts)
                
                # Check if web_search returned weak results
                if tc.name == "web_search" and tool_result and tool_result.get("ok"):
                    result_count = tool_result.get("count", 0)
                    if result_count < 2:
                        print(f"[AgentLoop] [Step {step}] Weak web search result: {result_count} results")
                        last_tool_result_weak = True

        # Fallback (should not be reached under normal execution)
        await self._emit_done(ctx, queue, trace, finish_reason="max_steps",
                              total_steps=ctx.max_tool_calls, budget=budget)

    async def _generate_with_provider_limit(
        self,
        *,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str,
        on_chunk: Optional[callable],
        on_reasoning: Optional[callable],
    ) -> AdapterResponse:
        semaphore = self._provider_semaphores.get(self._provider)
        if semaphore is None:
            return await self._adapter.generate(
                messages=messages,
                tools=tools,
                config=config,
                system_prompt=system_prompt,
                on_chunk=on_chunk,
                on_reasoning=on_reasoning,
            )

        try:
            await asyncio.wait_for(semaphore.acquire(), timeout=self._model_queue_timeout)
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"{self._provider or 'model'} provider is busy. "
                "Please retry shortly."
            ) from exc

        try:
            return await self._adapter.generate(
                messages=messages,
                tools=tools,
                config=config,
                system_prompt=system_prompt,
                on_chunk=on_chunk,
                on_reasoning=on_reasoning,
            )
        finally:
            semaphore.release()

    # ── Tool dispatch ─────────────────────────────────────────────────────

    async def _dispatch_tool(
        self,
        *,
        tc: ToolCallRequest,
        step: int,
        ctx: Any,
        messages: List[Dict[str, Any]],
        trace: List[ToolTrace],
        queue: asyncio.Queue,
        budget: TokenBudget,
    ) -> Dict[str, Any]:
        """
        Execute a tool and emit SSE events.
        Returns the tool result dict for inspection by the loop.
        """
        # Emit status based on tool type
        status_messages = {
            "web_search": "🔍 Web'de araştırılıyor...",
            "web_fetch": "📄 Sayfa getiriliyor...",
            "project_search": "🔎 Proje taranıyor...",
            "memory_lookup": "💾 Bellek sorgulanıyor...",
            "read_file": "📖 Dosya okunuyor...",
            "write_file": "✍️  Dosya yazılıyor...",
            "delete_file": "🗑️  Dosya siliniyor...",
            "list_files": "📋 Dosyalar listeleniyor...",
            "api_get": "🔗 API sorgulanıyor...",
            "db_read": "🗄️  Veritabanı sorgulanıyor...",
        }
        status_msg = status_messages.get(tc.name, f"⚙️  {tc.name} çalıştırılıyor...")
        await queue.put(AgentEvent(
            type=AgentEventType.STATUS,
            payload={"message": status_msg},
        ))

        # Emit tool_call event
        await queue.put(AgentEvent(
            type=AgentEventType.TOOL_CALL,
            payload={"step": step, "name": tc.name, "args": tc.args},
        ))

        print(f"[AgentLoop] [Step {step}] Dispatching tool: {tc.name}({tc.args})")
        t0 = time.monotonic()
        result = await self._registry.execute(tc.name, tc.args, ctx)
        duration_ms = round((time.monotonic() - t0) * 1000, 1)
        print(f"[AgentLoop] [Step {step}] Tool {tc.name} returned in {duration_ms}ms. Ok: {result.get('ok', True)}")

        summary = self._registry.summary(result, tc.name)
        ok = bool(result.get("ok", True))

        # Emit status for processing results
        await queue.put(AgentEvent(
            type=AgentEventType.STATUS,
            payload={"message": "⚡ Sonuçlar işleniyor..."},
        ))

        # Track trace
        trace.append(ToolTrace(
            step=step,
            tool_name=tc.name,
            args=tc.args,
            result=result,
            summary=summary,
            ok=ok,
            duration_ms=duration_ms,
        ))

        # Emit tool_result event
        await queue.put(AgentEvent(
            type=AgentEventType.TOOL_RESULT,
            payload={
                "step": step,
                "name": tc.name,
                "ok": ok,
                "summary": summary,
                "result": result,
                "duration_ms": duration_ms,
            },
        ))

        # Append tool result to messages in provider format
        budget.add(self._budget_text_for_tool_result(tc.name, result))
        updated_messages = self._adapter.format_tool_result(messages, tc.call_id, tc.name, result)
        if updated_messages is not None:
            messages[:] = updated_messages
        else:
            print(f"[AgentLoop] Warning: format_tool_result returned None for tool '{tc.name}'. Messages not updated.")
        
        # Return result for loop inspection
        return result

    def _budget_text_for_tool_result(self, tool_name: str, result: Dict[str, Any]) -> str:
        """
        Keep the budget guard conservative without letting verbose tool payloads
        consume the whole run. The full payload is still sent back to the model.
        """
        if tool_name == "web_search" and isinstance(result, dict):
            compact_results = []
            for item in (result.get("results") or [])[:5]:
                if not isinstance(item, dict):
                    continue
                compact_results.append({
                    "title": str(item.get("title") or "")[:120],
                    "url": str(item.get("url") or "")[:220],
                    "snippet": str(item.get("snippet") or "")[:240],
                })
            return str({
                "ok": result.get("ok", True),
                "query": result.get("query"),
                "count": result.get("count"),
                "results": compact_results,
            })

        if isinstance(result, dict):
            compact = dict(result)
            for key in ("content", "raw_content", "html", "text"):
                if key in compact:
                    compact[key] = str(compact.get(key) or "")[:1200]
            return str(compact)[:6000]

        return str(result)[:6000]

    def _extract_tool_path(self, tc: ToolCallRequest, result: Dict[str, Any]) -> str:
        if isinstance(result, dict) and result.get("path"):
            return str(result.get("path") or "").strip()
        return str((tc.args or {}).get("path") or "").strip()

    def _record_tool_usage(
        self,
        tc: ToolCallRequest,
        result: Dict[str, Any],
        touched_files: set[str],
        file_read_counts: Dict[str, int],
    ) -> None:
        path = self._extract_tool_path(tc, result)
        if not path:
            return
        normalized = path.lower()
        if tc.name == "read_file":
            file_read_counts[normalized] = file_read_counts.get(normalized, 0) + 1
        if tc.name in {"read_file", "write_file", "delete_file"} and result.get("ok", True):
            touched_files.add(normalized)

    async def _can_dispatch_tool(
        self,
        *,
        tc: ToolCallRequest,
        touched_files: set[str],
        file_read_counts: Dict[str, int],
        max_files_touched: int,
        max_reads_per_file: int,
        queue: asyncio.Queue,
        ctx: Any,
        trace: List[ToolTrace],
        budget: TokenBudget,
        step: int,
    ) -> bool:
        if tc.name not in {"read_file", "write_file", "delete_file"}:
            return True

        path = str((tc.args or {}).get("path") or "").strip()
        normalized = path.lower()
        if not normalized:
            return True

        if tc.name == "read_file" and file_read_counts.get(normalized, 0) >= max_reads_per_file:
            await queue.put(AgentEvent(
                type=AgentEventType.MESSAGE,
                payload={"text": f"Agent stopped because read_file for {path} exceeded the per-file read limit."},
            ))
            await self._emit_done(
                ctx, queue, trace, finish_reason="file_read_budget_exhausted",
                total_steps=step, budget=budget,
            )
            return False

        if normalized not in touched_files and len(touched_files) >= max_files_touched:
            await queue.put(AgentEvent(
                type=AgentEventType.MESSAGE,
                payload={"text": f"Agent stopped because touching {path} would exceed the unique file budget."},
            ))
            await self._emit_done(
                ctx, queue, trace, finish_reason="file_budget_exhausted",
                total_steps=step, budget=budget,
            )
            return False

        return True

    # ── Done event ────────────────────────────────────────────────────────

    async def _emit_done(
        self,
        ctx: Any,
        queue: asyncio.Queue,
        trace: List[ToolTrace],
        finish_reason: str,
        total_steps: int,
        budget: TokenBudget,
    ) -> None:
        changed = getattr(ctx, "changed_files", []) or []
        pending = getattr(ctx, "pending_confirmations", []) or []
        await queue.put(AgentEvent(
            type=AgentEventType.DONE,
            payload={
                "run_id": ctx.run_id,
                "finish_reason": finish_reason,
                "total_steps": total_steps,
                "token_usage": budget.to_dict(),
                "trace": [
                    {
                        "step": t.step,
                        "tool": t.tool_name,
                        "args": t.args,
                        "summary": t.summary,
                        "ok": t.ok,
                        "duration_ms": t.duration_ms,
                    }
                    for t in trace
                ],
                "changed_files": [c if isinstance(c, dict) else c.__dict__ for c in changed],
                "pending_confirmations": [
                    item if isinstance(item, dict) else getattr(item, "__dict__", {})
                    for item in pending
                ],
            },
        ))
