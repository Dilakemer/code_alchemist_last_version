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
    ) -> None:
        self._adapter = adapter
        self._registry = tool_registry
        self._compressor = compressor or ContextCompressor()

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
        budget = TokenBudget(max_tokens=ctx.max_tokens)

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

        # Build tool specs once
        tool_specs = self._registry.get_specs()
        formatted_tools = self._adapter.format_tools(tool_specs) if tool_specs else None

        config = AdapterConfig(
            model=ctx.model,
            temperature=ctx.temperature,
            max_tokens=min(ctx.max_tokens, 4096),
            stream=False,
        )

        trace: List[ToolTrace] = []
        web_search_count = 0  # Track web_search tool invocations
        last_tool_result_weak = False  # Track if last search was weak

        for step in range(ctx.max_tool_calls + 1):
            # Emit thinking status
            await queue.put(AgentEvent(
                type=AgentEventType.STATUS,
                payload={"message": "🧠 Düşünülüyor..."},
            ))

            # ── Call the model ────────────────────────────────────────────
            response: AdapterResponse = await self._adapter.generate(
                messages=messages,
                tools=formatted_tools,
                config=config,
                system_prompt=ctx.system_prompt,
            )
            print(f"[AgentLoop] [Step {step}] Model responded. Text length: {len(response.text or '')} | Tool calls: {len(response.tool_calls)}")
            if response.text:
                preview = response.text[:200].replace("\n", " ")
                print(f"[AgentLoop] [Step {step}] Message: {preview}...")
            budget.add(response.text)

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
                        payload={"text": response.text},
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
                if tc.name == "web_search":
                    web_search_count += 1
                
                tool_result = await self._dispatch_tool(
                    tc=tc, step=step, ctx=ctx, messages=messages,
                    trace=trace, queue=queue, budget=budget,
                )
                
                # Check if web_search returned weak results
                if tc.name == "web_search" and tool_result and tool_result.get("ok"):
                    result_count = tool_result.get("count", 0)
                    if result_count < 2:
                        print(f"[AgentLoop] [Step {step}] Weak web search result: {result_count} results")
                        last_tool_result_weak = True

        # Fallback (should not be reached under normal execution)
        await self._emit_done(ctx, queue, trace, finish_reason="max_steps",
                              total_steps=ctx.max_tool_calls, budget=budget)

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
        budget.add(str(result))
        updated_messages = self._adapter.format_tool_result(messages, tc.call_id, tc.name, result)
        if updated_messages is not None:
            messages[:] = updated_messages
        
        # Return result for loop inspection
        return result

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
