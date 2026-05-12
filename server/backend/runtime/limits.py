"""
Token budget tracking and context compression for the agent runtime.

TokenBudget   — tracks estimated token consumption per run.
ContextCompressor — trims conversation history to stay within limits.
"""
from __future__ import annotations

import os
import re
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

    def can_spend(self, estimated_tokens: int, reserve: int = 0) -> bool:
        """Return True when the requested spend fits within the remaining budget."""
        return self.remaining - max(0, int(reserve)) >= max(0, int(estimated_tokens))

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


class ContextHealthAnalyzer:
    """
    Analyzes session health based on token pressure, workspace overlap,
    and intent stability.

    Thresholds (tunable via env vars):
      CONTEXT_BLOAT_CHARS  — total chars before bloat advisory fires (default 12000 ≈ 3K tokens)
      TOPIC_SHIFT_JACCARD  — keyword Jaccard threshold below which TOPIC_SHIFT fires (default 0.15)
      ADVISORY_MSG_COOLDOWN — min new messages between advisories in same conversation (default 10)
    """

    BLOAT_CHARS    = int(os.getenv("CONTEXT_BLOAT_CHARS",   "12000"))
    DRIFT_JACCARD  = float(os.getenv("TOPIC_SHIFT_JACCARD", "0.15"))
    MSG_COOLDOWN   = int(os.getenv("ADVISORY_MSG_COOLDOWN", "10"))

    def __init__(self, context: Any) -> None:
        self.ctx = context
        self.pressure_threshold = 0.75
        self.drift_threshold = 0.7

    # ── Token pressure ────────────────────────────────────────────────────

    def _history_chars(self) -> int:
        """Count chars in pre-assembled history messages (the real memory hog)."""
        total = 0
        for msg in (getattr(self.ctx, "history_messages", None) or []):
            content = msg.get("content") or ""
            total += len(str(content))
        return total

    def calculate_pressure(self) -> float:
        """
        Estimate token pressure using system_prompt + history + current question.
        History is the dominant term in long conversations.
        """
        total_chars = (
            len(self.ctx.system_prompt or "")
            + len(self.ctx.rag_context or "")
            + len(self.ctx.question or "")
            + self._history_chars()
        )
        # Rough: chars / 4 ≈ tokens
        estimated_tokens = total_chars // 4
        return min(1.0, estimated_tokens / max(1, self.ctx.max_tokens))

    # ── Topic drift ───────────────────────────────────────────────────────

    def _keyword_set(self, text: str, min_len: int = 4) -> set:
        """Extract significant words from text (lowercase, length >= min_len)."""
        words = re.findall(r"[a-zA-ZğüşıöçĞÜŞİÖÇ]{%d,}" % min_len, (text or "").lower())
        return set(words)

    def calculate_drift_score(self, current_intent: str, touched_files: List[str]) -> float:
        """
        Drift score in [0, 1]:
          0 = same topic as recent history
          1 = completely different topic

        Uses:
          - Keyword Jaccard similarity between recent history and current question
          - File workspace overlap (unchanged from original)
          - Intent shift heuristic
        """
        # 1. Keyword overlap: compare last 3 history turns with current question
        history_text = " ".join(
            msg.get("content", "")
            for msg in (getattr(self.ctx, "history_messages", None) or [])[-6:]
            if isinstance(msg.get("content"), str)
        )
        q_words = self._keyword_set(self.ctx.question or "")
        h_words = self._keyword_set(history_text)

        if not h_words or not q_words:
            keyword_overlap = 1.0   # Not enough data → assume no drift
        else:
            intersection = q_words & h_words
            union = q_words | h_words
            keyword_overlap = len(intersection) / len(union)

        # 2. Workspace / file overlap (Jaccard)
        rag_files = set(re.findall(r"file:///([^\s]+)", self.ctx.rag_context or ""))
        touched   = set(touched_files)
        if not rag_files or not touched:
            file_overlap = 1.0
        else:
            file_overlap = len(rag_files & touched) / len(rag_files | touched)

        # 3. Intent shift heuristic (unchanged)
        intent_shift = 0.0 if current_intent in {"debugging", "coding"} else 0.3

        # Weighted combination: keyword drift is the strongest signal
        drift = (
            (1.0 - keyword_overlap) * 0.55
            + (1.0 - file_overlap)  * 0.25
            + intent_shift          * 0.20
        )
        return min(1.0, drift)

    # ── Main health check ─────────────────────────────────────────────────

    def check_health(
        self,
        token_usage: int,
        current_intent: str,
        touched_files: List[str],
    ) -> Dict[str, Any]:
        """
        Returns a health report dict with advisory flag.

        Uses the richer pressure calculation (includes history) when
        ctx.history_messages is available; falls back to the caller-supplied
        token_usage otherwise.
        """
        pressure = self.calculate_pressure() if hasattr(self.ctx, "history_messages") \
                   else (token_usage / max(1, self.ctx.max_tokens))
        drift = self.calculate_drift_score(current_intent, touched_files)

        advisory_type = None
        if pressure > self.pressure_threshold:
            advisory_type = "CONTEXT_BLOAT"
        elif drift > self.drift_threshold:
            advisory_type = "TOPIC_SHIFT"

        return {
            "pressure": pressure,
            "drift": drift,
            "advisory_needed": advisory_type is not None,
            "type": advisory_type,
        }
