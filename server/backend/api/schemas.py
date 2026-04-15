"""
Pydantic request/response models for the Agent API.

Supports Python 3.9+ and Pydantic v2.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class WorkspaceFileSchema(BaseModel):
    """A single file in the client workspace snapshot."""
    path: str
    content: str = ""
    language: str = "plaintext"


class AgentRequest(BaseModel):
    """
    Request body for POST /agent/run.

    All fields optional with sensible defaults; only `question` is typically required.
    """
    # ── Core ─────────────────────────────────────────────────────────────
    question: str = Field(..., min_length=1, description="The user's question or instruction.")
    code: str = Field("", description="Optional code snippet to provide as context.")
    model: str = Field("gpt-4o", description="LLM model to use for this run.")

    # ── Identity / session ─────────────────────────────────────────────
    conversation_id: Optional[int] = Field(None, description="Existing conversation to continue.")
    project_id: Optional[int] = Field(None, description="Project database ID.")
    user_id: Optional[int] = Field(None, description="Authenticated user ID (injected by auth middleware).")

    # ── Workspace ─────────────────────────────────────────────────────
    workspace_files: List[WorkspaceFileSchema] = Field(
        default_factory=list,
        description="Files from the client editor / VS Code extension.",
    )

    # ── Context options ────────────────────────────────────────────────
    include_history: bool = Field(True, description="Include previous conversation messages.")
    rag_context: str = Field("", description="Pre-assembled RAG context (bypasses DB lookup).")
    memory_context: str = Field("", description="Pre-assembled memory context (bypasses DB lookup).")

    # ── Limits ────────────────────────────────────────────────────────
    max_tool_calls: int = Field(8, ge=0, le=20, description="Max tool invocations per run.")
    max_tokens: int = Field(8000, ge=256, le=32000, description="Estimated token budget for the run.")
    temperature: float = Field(0.2, ge=0.0, le=2.0)
    allow_write_tools: bool = Field(
        False,
        description="Allow write-capable tools (write_file/delete_file). Requires explicit user confirmation.",
    )

    # ── Streaming ────────────────────────────────────────────────────
    stream: bool = Field(True, description="Return SSE stream (True) or JSON result (False).")

    # ── User preferences ──────────────────────────────────────────────
    user_prefs: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("model", mode="before")
    @classmethod
    def normalise_model(cls, v: str) -> str:
        return (v or "gpt-4o").replace("models/", "")

    def to_runtime_request(self) -> Dict[str, Any]:
        """Convert to the flat dict consumed by AgentRuntime."""
        return {
            "question": self.question,
            "code": self.code,
            "model": self.model,
            "conversation_id": self.conversation_id,
            "project_id": self.project_id,
            "user_id": self.user_id,
            "workspace_files": [f.model_dump() for f in self.workspace_files],
            "include_history": self.include_history,
            "max_tool_calls": self.max_tool_calls,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "allow_write_tools": self.allow_write_tools,
            "stream": self.stream,
            "user_prefs": self.user_prefs,
            "_rag_context": self.rag_context,
            "_memory_context": self.memory_context,
        }


class ToolInfo(BaseModel):
    """Describes a single registered tool."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    tags: List[str] = []
    enabled: bool = True


class ToolListResponse(BaseModel):
    tools: List[ToolInfo]
    count: int


class ProviderStatus(BaseModel):
    openai: bool
    anthropic: bool
    gemini: bool


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    providers: ProviderStatus


class AgentSyncResult(BaseModel):
    """JSON response for non-streaming agent runs."""
    run_id: str
    text: str
    finish_reason: str
    total_steps: int
    token_estimate: int
    tool_capable: bool
    trace: List[Dict[str, Any]] = []
    changed_files: List[Dict[str, Any]] = []
    pending_confirmations: List[Dict[str, Any]] = []
    error: Optional[str] = None
