"""
AgentRuntime — the top-level orchestrator for the agent system.

Wires together:
  AdapterDispatcher → BaseAdapter
  ToolRegistry
  ContextAssembler
  AgentLoop
  SSE event stream

This is the only object that should be imported by the API layer.

Usage::

    runtime = AgentRuntime()                      # uses env vars
    async for chunk in runtime.stream(request):   # SSE chunks
        yield chunk

    result = await runtime.run_sync(request)      # AgentResult
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from ..adapters.dispatcher import AdapterDispatcher
from ..agents.base import AgentEvent, AgentEventType, AgentResult, ChangedFile, ToolTrace
from ..agents.loop import AgentLoop
from ..tools.registry import ToolRegistry, create_default_registry
from .context import ContextAssembler
from .limits import ContextCompressor
from .sse import (
    SSEEventType,
    build_sse_event,
    done_event,
    error_event,
    metadata_event,
    message_event,
    tool_call_event,
    tool_result_event,
    advisory_event,
)
from ..prompt_optimizer import optimize_prompt
from .limits import ContextHealthAnalyzer
from utils.concurrency import env_float, env_int


class AgentRuntime:
    """
    Production-ready agent runtime.

    Parameters
    ----------
    tool_registry
        Pre-built ToolRegistry; defaults to create_default_registry().
    get_history_fn
        Callable(conversation_id: int) → list[{user, ai}]
    get_project_rag_fn
        Callable(project, question: str) → str
    get_memory_fn
        Callable(user_id: int, question: str) → str
    openai_key / anthropic_key / gemini_key
        API keys; fall back to environment variables when omitted.
    """

    def __init__(
        self,
        *,
        tool_registry: Optional[ToolRegistry] = None,
        get_history_fn: Optional[Callable] = None,
        get_project_rag_fn: Optional[Callable] = None,
        get_memory_fn: Optional[Callable] = None,
        openai_key: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
    ) -> None:
        self.registry = tool_registry or create_default_registry()
        self._dispatcher = AdapterDispatcher(
            openai_key=openai_key,
            anthropic_key=anthropic_key,
            gemini_key=gemini_key,
        )
        self._assembler = ContextAssembler(
            get_history_fn=get_history_fn,
            get_project_rag_fn=get_project_rag_fn,
            get_memory_fn=get_memory_fn,
        )
        self._compressor = ContextCompressor()
        self._seq_counter = 0  # <--- NEW: Track event sequence for frontend ordering
        self._cooldowns: Dict[int, float] = {} # conversation_id -> last_advisory_ts
        self._provider_semaphores = {
            "gemini": asyncio.Semaphore(env_int("GEMINI_MAX_CONCURRENCY", 4, minimum=1, maximum=64)),
            "openai": asyncio.Semaphore(env_int("OPENAI_MAX_CONCURRENCY", 8, minimum=1, maximum=64)),
            "anthropic": asyncio.Semaphore(env_int("ANTHROPIC_MAX_CONCURRENCY", 4, minimum=1, maximum=64)),
        }
        self._model_queue_timeout = env_float("MODEL_QUEUE_TIMEOUT_SEC", 8.0, minimum=0.1, maximum=120.0)

    # ── Public API ────────────────────────────────────────────────────────

    async def stream(self, request: Dict[str, Any]) -> AsyncIterator[str]:
        """
        Run the agent and yield raw SSE strings.

        Intended for use in a FastAPI StreamingResponse.
        """
        run_id = request.get("run_id") or f"run_{uuid.uuid4().hex[:8]}"
        self._seq_counter = 0 # Reset for new stream

        # ── Step 0: Optimize Prompt ───────────────────────────────────────
        try:
            self._run_prompt_optimization(request)
        except ValueError as e:
            yield error_event(str(e), code="VALIDATION_ERROR", seq=self._next_seq())
            return

        ctx = await self._build_context(request, run_id=run_id)

        provider = ctx.provider
        model = ctx.model
        tool_names = [t.name for t in self.registry.list_tools()]

        # ── metadata event ────────────────────────────────────────────────
        yield metadata_event(
            run_id=run_id,
            model=model,
            provider=provider,
            project_id=ctx.project_id,
            tools_available=tool_names,
            intent=request.get("intent"),
            optimizer_version=request.get("optimizer_version"),
            seq=self._next_seq()
        )

        try:
            adapter = self._dispatcher.get(provider)
        except Exception as exc:
            yield error_event(str(exc), code="ADAPTER_ERROR", seq=self._next_seq())
            return

        touched_files: List[str] = []

        loop = AgentLoop(
            adapter,
            self.registry,
            self._compressor,
            provider=provider,
            provider_semaphores=self._provider_semaphores,
            model_queue_timeout=self._model_queue_timeout,
        )

        try:
            async for event in loop.run(ctx):
                # Track files for drift detection
                if event.type == AgentEventType.TOOL_RESULT:
                    path = event.payload.get("result", {}).get("path")
                    if path: touched_files.append(path)
                
                yield self._event_to_sse(event, seq=self._next_seq())

            # ── Post-run Health Check ─────────────────────────────────────
            adv = await self._perform_health_check(ctx, touched_files, request)
            if adv:
                yield adv

        except Exception as exc:
            yield error_event(str(exc), code="RUNTIME_ERROR", seq=self._next_seq())

    async def _perform_health_check(self, ctx: Any, touched_files: List[str], request: Dict[str, Any]) -> Optional[str]:
        import time
        conv_id = ctx.conversation_id
        if not conv_id: return None

        # 15-minute cooldown
        now = time.time()
        if now - self._cooldowns.get(conv_id, 0) < 900:
            return None

        analyzer = ContextHealthAnalyzer(ctx)
        # Use simple char-based estimation for pressure
        char_count = len(ctx.system_prompt) + len(ctx.rag_context or "") + len(ctx.question)
        pressure_usage = char_count // 4 

        report = analyzer.check_health(
            token_usage=pressure_usage,
            current_intent=request.get("intent", "general"),
            touched_files=touched_files
        )

        if report["advisory_needed"]:
            self._cooldowns[conv_id] = now
            msg = (
                "Bağlam genişledi, yeni sohbet önerilir." 
                if report["type"] == "CONTEXT_BLOAT" else 
                "Konu değişmiş olabilir, yeni sohbet daha verimli olabilir."
            )
            return advisory_event(msg, advisory_type=report["type"], seq=self._next_seq())
        
        return None

    def _next_seq(self) -> int:
        self._seq_counter += 1
        return self._seq_counter

    async def run_sync(self, request: Dict[str, Any]) -> AgentResult:
        """
        Run the agent and collect a final AgentResult (no streaming).

        Useful for synchronous callers (e.g. the existing `/api/ask` bridge).
        """
        run_id = request.get("run_id") or f"run_{uuid.uuid4().hex[:8]}"
        
        # ── Step 0: Optimize Prompt ───────────────────────────────────────
        try:
            self._run_prompt_optimization(request)
        except ValueError as e:
            return AgentResult(text="", error=str(e), finish_reason="error")

        ctx = await self._build_context(request, run_id=run_id)

        try:
            adapter = self._dispatcher.get(ctx.provider)
        except Exception as exc:
            return AgentResult(text="", error=str(exc), finish_reason="error")

        loop_obj = AgentLoop(
            adapter,
            self.registry,
            self._compressor,
            provider=ctx.provider,
            provider_semaphores=self._provider_semaphores,
            model_queue_timeout=self._model_queue_timeout,
        )

        text_parts: List[str] = []
        trace: List[ToolTrace] = []
        changed: List[Dict] = []
        pending_confirmations: List[Dict] = []
        finish_reason = "stop"
        total_steps = 0
        token_estimate = 0

        async for event in loop_obj.run(ctx):
            if event.type == AgentEventType.MESSAGE:
                text_parts.append(event.payload.get("text") or "")
            elif event.type == AgentEventType.DONE:
                finish_reason = event.payload.get("finish_reason", "stop")
                total_steps = event.payload.get("total_steps", 0)
                token_estimate = (event.payload.get("token_usage") or {}).get("estimated_tokens", 0)
                changed = event.payload.get("changed_files") or []
                pending_confirmations = event.payload.get("pending_confirmations") or []
                for t in event.payload.get("trace") or []:
                    trace.append(ToolTrace(
                        step=t.get("step", 0),
                        tool_name=t.get("tool", ""),
                        args=t.get("args") or {},
                        result={},
                        summary=t.get("summary", ""),
                        ok=t.get("ok", True),
                        duration_ms=t.get("duration_ms", 0.0),
                    ))
            elif event.type == AgentEventType.ERROR:
                return AgentResult(
                    text="".join(text_parts),
                    error=event.payload.get("message"),
                    finish_reason="error",
                )

        return AgentResult(
            text="".join(text_parts),
            trace=trace,
            changed_files=[
                ChangedFile(
                    operation=c.get("operation", "update"),
                    path=c.get("path", ""),
                    persisted=c.get("persisted", False),
                )
                for c in changed
            ],
            pending_confirmations=[
                p if isinstance(p, dict) else {"item": str(p)}
                for p in pending_confirmations
            ],
            tool_capable=bool(self.registry.list_tools()),
            total_steps=total_steps,
            finish_reason=finish_reason,
            token_estimate=token_estimate,
        )

    def list_tools(self) -> List[Dict[str, Any]]:
        """Return all registered enabled tools as dicts."""
        return self.registry.get_specs()

    def available_providers(self) -> Dict[str, bool]:
        return self._dispatcher.available_providers()

    def _run_prompt_optimization(self, request: Dict[str, Any]) -> None:
        """
        Runs the Prompt Optimizer on the request question.
        
        Failure of the optimizer (other than ValueError) will fall back 
        to the original question to avoid crashing the runtime.
        """
        # 1. Prevent double optimization
        if request.get("optimized"):
            return

        question = request.get("question") or ""
        request["original_question"] = question

        try:
            # 2. Run optimization
            model_name = request.get("model") or ""
            result = optimize_prompt(question, model_name=model_name)
            
            # 3. Store result
            request["question"] = result["optimized_prompt"]
            request["intent"] = result["intent"]
            request["optimizer_version"] = result["optimizer_version"]
            request["optimized"] = True
            
        except ValueError:
            # Re-raise validation errors for the caller to handle
            raise
        except Exception as exc:
            # 4. Fallback for unexpected internal errors
            print(f"[runtime] Prompt optimization failed (fallback to original): {exc}")
            request["intent"] = "general"
            request["optimized"] = False

    # ── Internal helpers ──────────────────────────────────────────────────

    async def _build_context(self, request: Dict[str, Any], run_id: str):
        """Delegate context assembly to ContextAssembler."""
        model = request.get("model") or "gpt-4o"
        provider = request.get("provider") or self._dispatcher.infer_provider(model)

        return await self._assembler.assemble(
            run_id=run_id,
            user_id=request.get("user_id"),
            conversation_id=request.get("conversation_id"),
            project_id=request.get("project_id"),
            question=request.get("question") or "",
            code=request.get("code") or "",
            provider=provider,
            model=model,
            workspace_files_raw=request.get("workspace_files") or [],
            project=request.get("_project"),
            search_project_callback=request.get("_search_project_callback"),
            db_read_callback=request.get("_db_read_callback"),
            invalidate_project_cache=request.get("_invalidate_project_cache"),
            include_history=bool(request.get("include_history", True)),
            max_tool_calls=int(request.get("max_tool_calls") or 8),
            max_tokens=int(request.get("max_tokens") or 8000),
            temperature=float(request.get("temperature") or 0.2),
            max_files_touched=int(request.get("max_files_touched") or 3),
            max_reads_per_file=int(request.get("max_reads_per_file") or 2),
            min_token_reserve=int(request.get("min_token_reserve") or 512),
            allow_write_tools=bool(request.get("allow_write_tools", False)),
            user_prefs=request.get("user_prefs") or {},
            stream=bool(request.get("stream", True)),
            rag_context_override=request.get("_rag_context") or "",
            memory_context_override=request.get("_memory_context") or "",
            # Bridge pre-supply: skip DB history fetch if already assembled
            pre_assembled_history=request.get("_pre_assembled_history"),
        )

    @staticmethod
    def _event_to_sse(event: AgentEvent, seq: Optional[int] = None) -> str:
        """Convert an AgentEvent to a raw SSE data string."""
        etype = event.type
        payload = event.payload

        if etype == AgentEventType.TOOL_CALL:
            return tool_call_event(
                step=payload.get("step", 0),
                name=payload.get("name", ""),
                args=payload.get("args") or {},
                seq=seq
            )
        if etype == AgentEventType.TOOL_RESULT:
            return tool_result_event(
                step=payload.get("step", 0),
                name=payload.get("name", ""),
                ok=payload.get("ok", True),
                summary=payload.get("summary", ""),
                result=payload.get("result") or {},
                duration_ms=payload.get("duration_ms", 0.0),
                seq=seq
            )
        if etype == AgentEventType.MESSAGE:
            return message_event(payload.get("text", ""), seq=seq)
        if etype == AgentEventType.DONE:
            return done_event(
                run_id=payload.get("run_id", ""),
                finish_reason=payload.get("finish_reason", "stop"),
                total_steps=payload.get("total_steps", 0),
                token_usage=payload.get("token_usage") or {},
                trace=payload.get("trace") or [],
                changed_files=payload.get("changed_files") or [],
                pending_confirmations=payload.get("pending_confirmations") or [],
                seq=seq
            )
        if etype == AgentEventType.ERROR:
            return error_event(
                message=payload.get("message", "Unknown error"),
                code=payload.get("code", "AGENT_ERROR"),
                seq=seq
            )
        # metadata and reasoning passthrough
        return build_sse_event(SSEEventType(etype.value), payload, seq=seq)
