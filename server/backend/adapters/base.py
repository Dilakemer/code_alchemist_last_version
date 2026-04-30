"""
BaseAdapter ABC and shared types.

Each provider adapter (OpenAI, Anthropic, Gemini) implements this
interface so the AgentLoop can call any backend transparently.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional


@dataclass
class AdapterConfig:
    """Per-call configuration forwarded to provider."""
    model: str
    temperature: float = 0.2
    max_tokens: int = 4096
    stream: bool = False


@dataclass
class ToolCallRequest:
    """A single tool-call request emitted by the model."""
    call_id: str          # provider-specific call ID for correlation
    name: str
    args: Dict[str, Any]


@dataclass
class AdapterResponse:
    """
    Normalised response from any provider adapter.

    Either `text` is populated (final answer) OR `tool_calls` is
    non-empty (the model wants to use tools). Never both.
    """
    text: str = ""
    tool_calls: List[ToolCallRequest] = field(default_factory=list)
    raw: Any = None                    # original SDK response object
    token_estimate: int = 0

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)

    @property
    def is_final(self) -> bool:
        return bool(self.text) and not self.tool_calls


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


def _messages_token_estimate(messages: List[Dict[str, Any]]) -> int:
    total = 0
    for msg in messages:
        content = msg.get("content") or ""
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    total += _estimate_tokens(str(part.get("text") or ""))
        else:
            total += _estimate_tokens(str(content))
    return total


class BaseAdapter(ABC):
    """
    Abstract base for all LLM provider adapters.

    Subclasses must implement `generate` (single-shot) and
    `stream` (token-by-token). The agent loop always uses
    `generate` internally; streaming to the client is handled
    separately by the runtime layer.
    """

    # ── Format tool specs for this provider ───────────────────────────────

    @abstractmethod
    def format_tools(self, tool_specs: List[Dict[str, Any]]) -> Any:
        """Convert generic tool specs to provider-specific format."""

    @abstractmethod
    def format_tool_result(
        self,
        messages: List[Dict[str, Any]],
        call_id: str,
        tool_name: str,
        result: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Append a tool result to the message list in provider format.

        Implementations may mutate *messages* in place or return a new list.
        The agent loop will use the returned list when one is provided.
        """

    # ── Core inference ────────────────────────────────────────────────────

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str = "",
        on_chunk: Optional[callable] = None, # <--- NEW: Support real-time streaming
    ) -> AdapterResponse:
        """
        Single inference call. If on_chunk is provided, text should be streamed.
        Returns a normalised AdapterResponse (with full text accumulated).
        """

    @abstractmethod
    async def stream(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[Any],
        config: AdapterConfig,
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        """
        Streaming inference — yields raw text chunks.
        Tool calls are NOT returned via this path; the loop
        always uses `generate` for agentic turns.
        """

    # ── Shared helpers ────────────────────────────────────────────────────

    @staticmethod
    def safe_json(raw: Any) -> Dict[str, Any]:
        if isinstance(raw, dict):
            return raw
        try:
            parsed = json.loads(raw or "{}")
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    @staticmethod
    def estimate_tokens(messages: List[Dict[str, Any]]) -> int:
        return _messages_token_estimate(messages)
