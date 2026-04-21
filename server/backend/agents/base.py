"""
Agent dataclasses.

AgentContext — all per-request context passed through the agent loop.
AgentResult  — the final output produced by a completed agent run.
AgentEvent   — a single typed streaming event emitted during a run.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class AgentEventType(str, Enum):
    """SSE event taxonomy understood by both the server and the client."""
    METADATA    = "metadata"     # run start — model, provider, project_id
    STATUS      = "status"       # progress update — what agent is currently doing
    REASONING   = "reasoning"    # mid-stream thinking / scratchpad text
    TOOL_CALL   = "tool_call"    # model requested a tool
    TOOL_RESULT = "tool_result"  # tool execution result
    MESSAGE     = "message"      # final/streaming answer text chunk
    DONE        = "done"         # run finished — summary metadata
    ERROR       = "error"        # fatal or non-fatal run error


@dataclass
class WorkspaceFile:
    """A single file in the workspace snapshot sent from the client."""
    path: str
    content: str
    language: str = "plaintext"


@dataclass
class AgentContext:
    """
    All context for a single agent run.

    Built by ContextAssembler before the loop starts and treated as
    read-mostly during execution (tools may mutate workspace_files).
    """
    # ── Identity ──────────────────────────────────────────────────────────
    run_id: str = field(default_factory=lambda: f"run_{int(time.time() * 1000)}")
    user_id: Optional[int] = None
    conversation_id: Optional[int] = None
    project_id: Optional[int] = None

    # ── Input ────────────────────────────────────────────────────────────
    question: str = ""
    code: str = ""

    # ── Model selection ───────────────────────────────────────────────────
    provider: str = "openai"          # openai | anthropic | gemini
    model: str = "gpt-4o"

    # ── Rich context assembled before the loop ────────────────────────────
    system_prompt: str = ""
    history_messages: List[Dict[str, Any]] = field(default_factory=list)
    rag_context: str = ""             # Project / GitHub RAG snippets
    memory_context: str = ""          # Long-term memory capsule

    # ── Workspace (mutable during tool execution) ─────────────────────────
    workspace_files: Dict[str, WorkspaceFile] = field(default_factory=dict)
    project: Any = None               # SQLAlchemy Project ORM object (if any)
    search_project_callback: Any = None  # Callable for project semantic search

    # ── Limits ───────────────────────────────────────────────────────────
    max_tool_calls: int = 8
    max_tokens: int = 8000
    max_files_touched: int = 3
    max_reads_per_file: int = 2
    min_token_reserve: int = 512
    temperature: float = 0.2

    # ── Runtime preferences ───────────────────────────────────────────────
    user_prefs: Dict[str, Any] = field(default_factory=dict)
    stream: bool = True


@dataclass
class ToolTrace:
    """A single record of a tool invocation during a run."""
    step: int
    tool_name: str
    args: Dict[str, Any]
    result: Dict[str, Any]
    summary: str
    ok: bool
    duration_ms: float = 0.0


@dataclass
class ChangedFile:
    """Tracks a file mutation made by the agent during the run."""
    operation: str    # create | update | delete
    path: str
    persisted: bool   # True = saved to DB, False = workspace snapshot only


@dataclass
class AgentResult:
    """The complete output of a finished agent run."""
    text: str
    trace: List[ToolTrace] = field(default_factory=list)
    changed_files: List[ChangedFile] = field(default_factory=list)
    pending_confirmations: List[Dict[str, Any]] = field(default_factory=list)
    tool_capable: bool = False
    total_steps: int = 0
    finish_reason: str = "stop"  # stop | max_steps | error
    token_estimate: int = 0
    error: Optional[str] = None


@dataclass
class AgentEvent:
    """A single SSE event emitted during streaming."""
    type: AgentEventType
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {"type": self.type.value, **self.payload}
