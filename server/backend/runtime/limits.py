"""
Token budget tracking and context compression for the agent runtime.

TokenBudget   — tracks estimated token consumption per run.
ContextCompressor — trims conversation history to stay within limits.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

# Env-configurable threshold (chars before compression kicks in)
COMPRESS_THRESHOLD = int(os.getenv("AGENT_COMPRESS_THRESHOLD", "6000"))
# Chars per rough token estimate
_CHARS_PER_TOKEN = 4


def _char_count(messages: List[Dict[str, Any]]) -> int:
    total = 0
    for msg in messages:
        content = msg.get("content") or ""
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    total += len(str(block.get("text") or ""))
        else:
            total += len(str(content))
    return total


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


class TokenBudget:
    """
    Lightweight token estimator for a single agent run.

    Uses char-based estimation (4 chars ≈ 1 token) to avoid needing
    the actual tokeniser at runtime.
    """

    def __init__(self, max_tokens: int = 8000) -> None:
        self.max_tokens = max_tokens
        self._used: int = 0

    def add(self, text: str) -> None:
        self._used += _estimate_tokens(text)

    def add_messages(self, messages: List[Dict[str, Any]]) -> None:
        self._used += _char_count(messages) // _CHARS_PER_TOKEN

    @property
    def used(self) -> int:
        return self._used

    @property
    def remaining(self) -> int:
        return max(0, self.max_tokens - self._used)

    @property
    def is_over_budget(self) -> bool:
        return self._used >= self.max_tokens

    def to_dict(self) -> Dict[str, int]:
        return {
            "estimated_tokens": self._used,
            "max_tokens": self.max_tokens,
            "remaining": self.remaining,
        }


class ContextCompressor:
    """
    Trims conversation history to fit token limits.

    Strategy: drop the oldest user/assistant message pairs until the
    estimated token count drops below the compression threshold.
    System messages and the most recent pair are always preserved.
    """

    def __init__(
        self,
        threshold: int = COMPRESS_THRESHOLD,
        min_messages: int = 2,
    ) -> None:
        self.threshold_chars = threshold * _CHARS_PER_TOKEN
        self.min_messages = min_messages

    def compress(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Return a (possibly shorter) copy of *messages* that fits within
        the token threshold. Non-destructive.
        """
        if _char_count(messages) <= self.threshold_chars:
            return list(messages)

        # Separate system messages from the rest
        system_msgs = [m for m in messages if m.get("role") == "system"]
        other_msgs  = [m for m in messages if m.get("role") != "system"]

        # Drop oldest messages until we're under budget
        while (
            len(other_msgs) > self.min_messages
            and _char_count(system_msgs + other_msgs) > self.threshold_chars
        ):
            other_msgs.pop(0)

        compressed = system_msgs + other_msgs

        # Add a synthetic note so the model knows context was trimmed
        if len(compressed) < len(messages):
            note = {
                "role": "system",
                "content": (
                    "[Context compressed: earlier conversation history was truncated "
                    "to fit the context window. The most recent messages are preserved.]"
                ),
            }
            # Insert after any existing system messages
            insert_at = len(system_msgs)
            compressed.insert(insert_at, note)

        return compressed

    def compress_rag(
        self,
        rag_context: str,
        max_chars: int = 8000,
    ) -> str:
        """Truncate RAG context blob to *max_chars*."""
        if not rag_context or len(rag_context) <= max_chars:
            return rag_context
        truncated = rag_context[:max_chars]
        return truncated + "\n... [RAG context truncated]"

    def compress_memory(
        self,
        memory_context: str,
        max_chars: int = 4000,
    ) -> str:
        """Truncate memory context blob to *max_chars*."""
        if not memory_context or len(memory_context) <= max_chars:
            return memory_context
        return memory_context[:max_chars] + "\n... [Memory context truncated]"
