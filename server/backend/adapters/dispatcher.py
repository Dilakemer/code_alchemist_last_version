"""
AdapterDispatcher — maps provider strings to lazy-initialised adapter instances.

Usage:
    dispatcher = AdapterDispatcher(openai_key="...", anthropic_key="...", gemini_key="...")
    adapter = dispatcher.get("openai")
    response = await adapter.generate(messages, tools, config)
"""
from __future__ import annotations

import os
from typing import Dict, Optional

from .base import BaseAdapter


class AdapterDispatcher:
    """
    Factory + registry for provider adapters.

    Adapters are initialised lazily on first use so that missing
    API keys only fail at call time, not at import time.
    """

    PROVIDER_ALIASES: Dict[str, str] = {
        # normalised name → canonical name
        "openai":     "openai",
        "gpt":        "openai",
        "anthropic":  "anthropic",
        "claude":     "anthropic",
        "gemini":     "gemini",
        "google":     "gemini",
        "gemma":      "gemini",
    }

    def __init__(
        self,
        openai_key: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
    ) -> None:
        self._keys = {
            "openai":    openai_key    or os.getenv("OPENAI_API_KEY", ""),
            "anthropic": anthropic_key or os.getenv("ANTHROPIC_API_KEY", ""),
            "gemini":    gemini_key    or os.getenv("GEMINI_API_KEY", ""),
        }
        self._cache: Dict[str, BaseAdapter] = {}

    # ── Public API ────────────────────────────────────────────────────────

    def get(self, provider: str, override_key: Optional[str] = None) -> BaseAdapter:
        """
        Return the adapter for *provider*.

        Resolves aliases (e.g. 'claude' → 'anthropic') and caches
        the instance. If override_key is provided, it bypasses the cache
        and uses the provided key directly.

        Raises:
            ValueError – if the provider is unknown.
            RuntimeError – if the required API key is missing.
        """
        canonical = self._resolve(provider)
        
        if override_key:
            # Bypass cache for user-owned keys for security/privacy
            return self._build(canonical, key=override_key)

        if canonical not in self._cache:
            self._cache[canonical] = self._build(canonical)
        return self._cache[canonical]

    def infer_provider(self, model: str) -> str:
        """
        Infer the canonical provider name from a model string.

        Examples:
            'gpt-4o'              → 'openai'
            'claude-sonnet-4-5-20250929' → 'anthropic'
            'gemini-2.5-flash'    → 'gemini'
        """
        m = model.lower()
        if "claude" in m:
            return "anthropic"
        if "gpt" in m or m.startswith("o1") or m.startswith("o3"):
            return "openai"
        if "gemini" in m or "gemma" in m:
            return "gemini"
        return "openai"  # safe default

    def available_providers(self) -> Dict[str, bool]:
        """Return which providers have API keys configured."""
        return {name: bool(key) for name, key in self._keys.items()}

    # ── Private helpers ───────────────────────────────────────────────────

    def _resolve(self, provider: str) -> str:
        canonical = self.PROVIDER_ALIASES.get(provider.lower())
        if not canonical:
            raise ValueError(
                f"Unknown provider '{provider}'. "
                f"Valid options: {list(self.PROVIDER_ALIASES)}"
            )
        return canonical

    def _build(self, canonical: str, key: Optional[str] = None) -> BaseAdapter:
        key = key or self._keys.get(canonical, "")
        if not key:
            raise RuntimeError(
                f"No API key configured for provider '{canonical}'. "
                f"Set the corresponding environment variable."
            )

        if canonical == "openai":
            from .openai_adapter import OpenAIAdapter
            return OpenAIAdapter(api_key=key)

        if canonical == "anthropic":
            from .anthropic_adapter import AnthropicAdapter
            return AnthropicAdapter(api_key=key)

        if canonical == "gemini":
            from .gemini_adapter import GeminiAdapter
            return GeminiAdapter(api_key=key)

        raise ValueError(f"No builder defined for '{canonical}'")
