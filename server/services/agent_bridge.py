"""
Flask ↔ AgentRuntime bridge.

This module is imported by app.py to forward agent_mode=True requests
from the legacy /api/ask endpoint into the new AgentRuntime without
requiring a separate HTTP hop.

Usage in app.py::

    from services.agent_bridge import run_agent_bridge, stream_agent_bridge

    # Non-streaming (existing agent_mode path)
    result = run_agent_bridge(
        question=question,
        code=code,
        model=selected_model,
        project=resolved_agent_project,
        user=user,
        conversation=conversation,
        workspace_files=workspace_files,
        prefs=prefs,
        history_context=history_context,
        github_context=github_context,
        on_event=on_event_callback,
    )

    # Streaming SSE (new /agent/run path)
    async for chunk in stream_agent_bridge(...):
        yield chunk
"""
from __future__ import annotations

import asyncio
import queue
import threading
from typing import Any, Callable, Dict, Iterator, List, Optional


# Lazy import — AgentRuntime is only created once (singleton)
_runtime = None
_runtime_lock = threading.Lock()


def _get_runtime():
    """Get the central AgentRuntime singleton for Flask bridge calls."""
    global _runtime
    if _runtime is not None:
        return _runtime

    with _runtime_lock:
        if _runtime is not None:
            return _runtime

        try:
            # Preferred path: reuse the app factory singleton when FastAPI stack is available.
            from backend.app_factory import _get_or_create_runtime
            _runtime = _get_or_create_runtime()
            return _runtime
        except ModuleNotFoundError as exc:
            # Flask-only local runs may not have FastAPI installed.
            if getattr(exc, "name", None) != "fastapi":
                raise

            from backend.runtime.core import AgentRuntime
            from backend.tools.registry import create_default_registry

            _runtime = AgentRuntime(tool_registry=create_default_registry())
            return _runtime


def _run_coroutine(coro):
    """Run an async coroutine from synchronous code."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # In a threaded Flask worker we may already be inside an event loop
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def build_runtime_request(
    *,
    question: str,
    code: str = "",
    model: str = "gpt-4o",
    project: Any = None,
    user: Any = None,
    conversation: Any = None,
    workspace_files: List[Dict[str, Any]] = None,
    prefs: Dict[str, Any] = None,
    messages: List[Dict[str, Any]] = None,
    history_context: List[Dict[str, Any]] = None,
    github_context: str = "",
    memory_context: str = "",
    max_tool_calls: int = 8,
    max_tokens: int = 8000,
    max_files_touched: int = 3,
    max_reads_per_file: int = 2,
    min_token_reserve: int = 512,
    allow_write_tools: bool = False,
    stream: bool = False,
    search_project_callback: Optional[Callable] = None,
    db_read_callback: Optional[Callable] = None,
    invalidate_project_cache: Optional[Callable] = None,
    workspace_root: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build the flat dict consumed by AgentRuntime from Flask request data.

    Converts SQLAlchemy objects and Flask-specific structures into the
    provider-agnostic runtime format.
    """
    history_messages = []
    if messages is not None:
        for msg in (messages or []):
            if not isinstance(msg, dict):
                continue
            role = (msg.get("role") or "").strip()
            content = msg.get("content")
            if role in {"user", "assistant"} and isinstance(content, str) and content.strip():
                history_messages.append({"role": role, "content": content.strip()})
    else:
        # Convert history_context list[{user, ai}] to runtime format messages list
        for turn in (history_context or []):
            u = (turn.get("user") or "").strip()
            a = (turn.get("ai") or "").strip()
            if u:
                history_messages.append({"role": "user", "content": u})
            if a:
                history_messages.append({"role": "assistant", "content": a})

    # Normalise workspace files
    ws_files = []
    for item in (workspace_files or []):
        if isinstance(item, dict):
            ws_files.append({
                "path": item.get("path") or item.get("name") or "",
                "content": item.get("content") or "",
                "language": item.get("language") or "plaintext",
                "trust_id": item.get("trust_id"),
                "trust_scope": item.get("trust_scope"),
            })

    req: Dict[str, Any] = {
        "question": question or "",
        "code": code or "",
        "model": model,
        "conversation_id": conversation if isinstance(conversation, (int, str)) else getattr(conversation, "id", None) if conversation else None,
        "project_id": project if isinstance(project, (int, str)) else getattr(project, "id", None) if project else None,
        "user_id": user if isinstance(user, (int, str)) else getattr(user, "id", None) if user else None,
        "workspace_files": ws_files,
        "workspace_root": workspace_root,
        "include_history": False,  # history passed directly via _rag_context / messages
        "max_tool_calls": max_tool_calls,
        "max_tokens": max_tokens,
        "max_files_touched": max_files_touched,
        "max_reads_per_file": max_reads_per_file,
        "min_token_reserve": min_token_reserve,
        "allow_write_tools": bool(allow_write_tools),
        "stream": stream,
        "user_prefs": prefs or {},
        "_rag_context": github_context or "",
        "_memory_context": memory_context or "",
        "_project": project if isinstance(project, (int, str)) else getattr(project, "id", None) if project else None,
        "_search_project_callback": search_project_callback,
        "_db_read_callback": db_read_callback,
        "_invalidate_project_cache": invalidate_project_cache,
    }

    # Pre-inject history messages so ContextAssembler skips DB lookup
    # We do this by adding them to the runtime request as a special key
    req["_pre_assembled_history"] = history_messages

    return req


def run_agent_bridge(
    *,
    question: str,
    code: str = "",
    model: str = "gpt-4o",
    project: Any = None,
    user: Any = None,
    conversation: Any = None,
    workspace_files: List[Dict[str, Any]] = None,
    prefs: Dict[str, Any] = None,
    messages: List[Dict[str, Any]] = None,
    history_context: List[Dict[str, Any]] = None,
    github_context: str = "",
    memory_context: str = "",
    max_tool_calls: int = 8,
    max_files_touched: int = 3,
    max_reads_per_file: int = 2,
    min_token_reserve: int = 512,
    allow_write_tools: bool = False,
    on_event: Optional[Callable[[Dict[str, Any]], None]] = None,
    search_project_callback: Optional[Callable] = None,
    db_read_callback: Optional[Callable] = None,
    invalidate_project_cache: Optional[Callable] = None,
    workspace_root: Optional[str] = None,
) -> "AgentBridgeResult":
    """
    Synchronous bridge: run the agent and return a result dict.

    Compatible with the existing Flask /api/ask handler.
    """
    from backend.agents.base import AgentEventType

    runtime = _get_runtime()
    req = build_runtime_request(
        question=question,
        code=code,
        model=model,
        project=project,
        user=user,
        conversation=conversation,
        workspace_files=workspace_files,
        prefs=prefs,
        messages=messages,
        history_context=history_context,
        github_context=github_context,
        memory_context=memory_context,
        max_tool_calls=max_tool_calls,
        max_files_touched=max_files_touched,
        max_reads_per_file=max_reads_per_file,
        min_token_reserve=min_token_reserve,
        allow_write_tools=allow_write_tools,
        stream=False,
        search_project_callback=search_project_callback,
        db_read_callback=db_read_callback,
        invalidate_project_cache=invalidate_project_cache,
        workspace_root=workspace_root,
    )

    async def _run():
        result = await runtime.run_sync(req)
        return result

    flask_result = _run_coroutine(_run())
    if flask_result and flask_result.error:
        print(f"[AgentBridge] Error in run_sync: {flask_result.error}")
    elif not flask_result:
        print("[AgentBridge] Failed to get result from Agent Runtime.")

    # Forward on_event callbacks for trace events (compatible with old API)
    if on_event and flask_result:
        for t in flask_result.trace:
            on_event({"type": "tool_start", "tool": t.tool_name, "args": t.args})
            on_event({"type": "tool_end",   "tool": t.tool_name, "summary": t.summary})

    return AgentBridgeResult(
        text=flask_result.text if flask_result else "",
        trace=[
            {
                "type": "tool",
                "tool": t.tool_name,
                "args": t.args,
                "summary": t.summary,
                "ok": t.ok,
            }
            # Trace already contains the raw result from tool_runtime, 
            # which include trust_id/trust_scope in the output
            for t in (flask_result.trace if flask_result else [])
        ],
        changed_files=[
            {
                "operation": f.operation,
                "path": f.path,
                "persisted": f.persisted,
                "trust_id": getattr(f, "trust_id", None),
                "trust_scope": getattr(f, "trust_scope", None),
            }
            for f in (flask_result.changed_files if flask_result else [])
        ],
        pending_confirmations=list(flask_result.pending_confirmations if flask_result else []),
        tool_capable=flask_result.tool_capable if flask_result else False,
        finish_reason=flask_result.finish_reason if flask_result else "error",
        error=flask_result.error if flask_result else None,
    )


def stream_agent_bridge(
    *,
    question: str,
    code: str = "",
    model: str = "gpt-4o",
    project: Any = None,
    user: Any = None,
    conversation: Any = None,
    workspace_files: List[Dict[str, Any]] = None,
    prefs: Dict[str, Any] = None,
    messages: List[Dict[str, Any]] = None,
    history_context: List[Dict[str, Any]] = None,
    github_context: str = "",
    memory_context: str = "",
    max_tool_calls: int = 8,
    max_files_touched: int = 3,
    max_reads_per_file: int = 2,
    min_token_reserve: int = 512,
    allow_write_tools: bool = False,
    search_project_callback: Optional[Callable] = None,
    db_read_callback: Optional[Callable] = None,
    invalidate_project_cache: Optional[Callable] = None,
    workspace_root: Optional[str] = None,
) -> Iterator[str]:
    """
    Streaming bridge: run the agent and yield SSE strings.

    Compatible with Flask's Response(stream_with_context(...)).
    Transforms new Agent Mode events into the format expected by the legacy UI.
    """
    import json

    runtime = _get_runtime()
    req = build_runtime_request(
        question=question,
        code=code,
        model=model,
        project=project,
        user=user,
        conversation=conversation,
        workspace_files=workspace_files,
        prefs=prefs,
        messages=messages,
        history_context=history_context,
        github_context=github_context,
        memory_context=memory_context,
        max_tool_calls=max_tool_calls,
        max_files_touched=max_files_touched,
        max_reads_per_file=max_reads_per_file,
        min_token_reserve=min_token_reserve,
        allow_write_tools=allow_write_tools,
        stream=True,
        search_project_callback=search_project_callback,
        db_read_callback=db_read_callback,
        invalidate_project_cache=invalidate_project_cache,
        workspace_root=workspace_root,
    )

    q = queue.Queue(maxsize=64)

    def _producer():
        # Inner thread has its own event loop and should have its own app context
        from app import app
        import json

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        def is_critical(sse_chunk: str) -> bool:
            # Quick string check for critical event types
            return any(t in sse_chunk for t in ['"type": "message"', '"type": "tool_call"', '"type": "done"', '"type": "error"'])

        async def _consume():
            try:
                async for chunk in runtime.stream(req):
                    try:
                        q.put_nowait(chunk)
                    except queue.Full:
                        if is_critical(chunk):
                            # Critical events MUST be delivered; offload blocking put to executor
                            await loop.run_in_executor(None, q.put, chunk)
                        else:
                            # Drop non-critical (status/reasoning) events when congested
                            print(f"[AgentBridge] Backpressure: Dropping non-critical event: {chunk[:60]}...")
            except Exception as e:
                print(f"[AgentBridge] Stream producer error: {e}")
                err_msg = f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                await loop.run_in_executor(None, q.put, err_msg)
            finally:
                await loop.run_in_executor(None, q.put, StopIteration)

        try:
            loop.run_until_complete(_consume())
        finally:
            loop.close()

    thread = threading.Thread(target=_producer, daemon=True)
    thread.start()

    while True:
        try:
            chunk = q.get(timeout=60)
            if chunk is StopIteration:
                break
            
            # Legacy UI transformation
            # New runtime yields: data: {"type": "message", "text": "..."}
            # Legacy UI expects: data: {"chunk": "..."}
            if chunk.startswith("data: "):
                try:
                    raw_json = chunk[6:].strip()
                    data = json.loads(raw_json)
                    etype = data.get("type")
                    
                    if etype == "message":
                        # Map Agent Mode text to legacy 'chunk' key
                        data["chunk"] = data.get("text", "")
                        yield f"data: {json.dumps(data)}\n\n"
                        continue
                    elif etype == "done":
                        # Do NOT yield the done event yet.
                        # app.py will yield the final combined done event after DB save.
                        # But we yield it as a special internal data packet if necessary, 
                        # or just rely on the caller parsing it from the yield.
                        # Actually, since this is a bridge, we can just return it 
                        # via a specific mechanism or just let the caller parse.
                        pass

                except Exception:
                    # If parsing fails, fall back to raw passthrough
                    pass

            yield chunk
        except queue.Empty:
            break


class AgentBridgeResult:
    """Drop-in replacement for the old AgentRunResult dataclass."""
    def __init__(
        self,
        text: str = "",
        trace: List[Dict] = None,
        changed_files: List[Dict] = None,
        pending_confirmations: List[Dict] = None,
        tool_capable: bool = False,
        finish_reason: str = "stop",
        error: Optional[str] = None,
    ):
        self.text = text
        self.trace = trace or []
        self.changed_files = changed_files or []
        self.pending_confirmations = pending_confirmations or []
        self.tool_capable = tool_capable
        self.finish_reason = finish_reason
        self.error = error

