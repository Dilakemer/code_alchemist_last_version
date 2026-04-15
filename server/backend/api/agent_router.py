"""
FastAPI router for the Agent API.

Endpoints:
  POST /agent/run       — SSE streaming agent run
  POST /agent/run/sync  — JSON (non-streaming) agent run
  GET  /agent/tools     — list all registered tools
  GET  /agent/health    — readiness / provider status check

The router depends on a singleton AgentRuntime that is wired up in
app_factory.py via FastAPI's dependency injection system.
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..runtime.core import AgentRuntime
from .schemas import (
    AgentRequest,
    AgentSyncResult,
    HealthResponse,
    ProviderStatus,
    ToolInfo,
    ToolListResponse,
)

router = APIRouter(prefix="/agent", tags=["Agent"])


# ── Dependency: resolve the runtime from app state ────────────────────────────

def get_runtime(request: Request) -> AgentRuntime:
    runtime: AgentRuntime = request.app.state.agent_runtime
    if runtime is None:
        raise HTTPException(status_code=503, detail="Agent runtime not initialised.")
    return runtime


# ── SSE streaming run ─────────────────────────────────────────────────────────

@router.post(
    "/run",
    summary="Run agent (SSE streaming)",
    description=(
        "Starts an agent run and streams events as Server-Sent Events. "
        "Event types: metadata | reasoning | tool_call | tool_result | message | done | error"
    ),
)
async def agent_run_stream(
    body: AgentRequest,
    request: Request,
    runtime: AgentRuntime = Depends(get_runtime),
) -> StreamingResponse:
    run_id = f"run_{uuid.uuid4().hex[:8]}"

    # Inject dependency-resolved objects (project, history callbacks)
    # The Flask app.py patches these into the request dict via _enrich_request()
    runtime_request = body.to_runtime_request()
    runtime_request["run_id"] = run_id

    # If the Flask app injected context objects via request.state, merge them
    flask_ctx = getattr(request.state, "agent_flask_context", None) or {}
    runtime_request.update(flask_ctx)

    async def _event_generator() -> AsyncIterator[str]:
        async for chunk in runtime.stream(runtime_request):
            yield chunk
        # Final keepalive to ensure the client receives the done event
        yield ": keepalive\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "X-Run-Id": run_id,
        },
    )


# ── Synchronous JSON run ──────────────────────────────────────────────────────

@router.post(
    "/run/sync",
    response_model=AgentSyncResult,
    summary="Run agent (JSON response)",
    description="Runs the agent and returns the final result as JSON. Does not stream.",
)
async def agent_run_sync(
    body: AgentRequest,
    request: Request,
    runtime: AgentRuntime = Depends(get_runtime),
) -> AgentSyncResult:
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    runtime_request = body.to_runtime_request()
    runtime_request["run_id"] = run_id
    runtime_request["stream"] = False

    flask_ctx = getattr(request.state, "agent_flask_context", None) or {}
    runtime_request.update(flask_ctx)

    result = await runtime.run_sync(runtime_request)

    return AgentSyncResult(
        run_id=run_id,
        text=result.text,
        finish_reason=result.finish_reason,
        total_steps=result.total_steps,
        token_estimate=result.token_estimate,
        tool_capable=result.tool_capable,
        trace=[
            {
                "step": t.step,
                "tool": t.tool_name,
                "args": t.args,
                "summary": t.summary,
                "ok": t.ok,
                "duration_ms": t.duration_ms,
            }
            for t in result.trace
        ],
        changed_files=[
            {
                "operation": f.operation,
                "path": f.path,
                "persisted": f.persisted,
            }
            for f in result.changed_files
        ],
        pending_confirmations=result.pending_confirmations,
        error=result.error,
    )


# ── Tool registry endpoint ────────────────────────────────────────────────────

@router.get(
    "/tools",
    response_model=ToolListResponse,
    summary="List registered tools",
    description="Returns all tools currently registered in the agent tool registry.",
)
async def list_tools(
    runtime: AgentRuntime = Depends(get_runtime),
) -> ToolListResponse:
    specs = runtime.list_tools()
    tools = [
        ToolInfo(
            name=s["name"],
            description=s["description"],
            input_schema=s["input_schema"],
            tags=s.get("tags") or [],
        )
        for s in specs
    ]
    return ToolListResponse(tools=tools, count=len(tools))


# ── Health check ──────────────────────────────────────────────────────────────

@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Agent runtime health check",
    description="Returns the runtime status and which LLM providers have configured API keys.",
)
async def health_check(
    runtime: AgentRuntime = Depends(get_runtime),
) -> HealthResponse:
    providers = runtime.available_providers()
    return HealthResponse(
        status="ok",
        version="1.0.0",
        providers=ProviderStatus(
            openai=providers.get("openai", False),
            anthropic=providers.get("anthropic", False),
            gemini=providers.get("gemini", False),
        ),
    )
