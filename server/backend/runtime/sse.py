"""
SSE event builder for the agent runtime.

Every event follows a consistent JSON-on-a-data-line format:

    data: {"type": "<event_type>", ...payload}\n\n

This module provides:
  - SSEEventType   — an enum of all recognised event names
  - build_sse_event() — serialise an event to a raw SSE data line
  - done_event(), error_event(), metadata_event(), etc. — convenience builders
"""
from __future__ import annotations

import json
from enum import Enum
from typing import Any, Dict, List, Optional


class SSEEventType(str, Enum):
    METADATA    = "metadata"
    STATUS      = "status"
    REASONING   = "reasoning"
    TOOL_CALL   = "tool_call"
    TOOL_RESULT = "tool_result"
    MESSAGE     = "message"
    DONE        = "done"
    ERROR       = "error"


def build_sse_event(event_type: SSEEventType, payload: Dict[str, Any]) -> str:
    """
    Serialize an event to a raw SSE string ready to stream to the client.

    Format::

        data: {"type": "...", ...}\n\n
    """
    data = {"type": event_type.value, **payload}
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


# ── Typed convenience builders ────────────────────────────────────────────────

def metadata_event(
    run_id: str,
    model: str,
    provider: str,
    project_id: Optional[int],
    tools_available: List[str],
    intent: Optional[str] = None,
    optimizer_version: Optional[str] = None,
) -> str:
    payload = {
        "run_id": run_id,
        "model": model,
        "provider": provider,
        "project_id": project_id,
        "tools_available": tools_available,
    }
    if intent:
        payload["intent"] = intent
        payload["optimized"] = True
    if optimizer_version:
        payload["optimizer_version"] = optimizer_version
    return build_sse_event(SSEEventType.METADATA, payload)


def status_event(message: str) -> str:
    return build_sse_event(SSEEventType.STATUS, {"message": message})


def reasoning_event(text: str) -> str:
    return build_sse_event(SSEEventType.REASONING, {"text": text})


def tool_call_event(step: int, name: str, args: Dict[str, Any]) -> str:
    return build_sse_event(SSEEventType.TOOL_CALL, {
        "step": step,
        "name": name,
        "args": args,
    })


def tool_result_event(
    step: int,
    name: str,
    ok: bool,
    summary: str,
    result: Dict[str, Any],
    duration_ms: float = 0.0,
) -> str:
    return build_sse_event(SSEEventType.TOOL_RESULT, {
        "step": step,
        "name": name,
        "ok": ok,
        "summary": summary,
        "result": result,
        "duration_ms": duration_ms,
    })


def message_event(text: str) -> str:
    return build_sse_event(SSEEventType.MESSAGE, {"text": text})


def done_event(
    run_id: str,
    finish_reason: str,
    total_steps: int,
    token_usage: Dict[str, int],
    trace: List[Dict[str, Any]],
    changed_files: List[Dict[str, Any]],
    pending_confirmations: Optional[List[Dict[str, Any]]] = None,
) -> str:
    return build_sse_event(SSEEventType.DONE, {
        "run_id": run_id,
        "finish_reason": finish_reason,
        "total_steps": total_steps,
        "token_usage": token_usage,
        "trace": trace,
        "changed_files": changed_files,
        "pending_confirmations": pending_confirmations or [],
    })


def error_event(message: str, code: str = "AGENT_ERROR") -> str:
    return build_sse_event(SSEEventType.ERROR, {
        "message": message,
        "code": code,
    })
