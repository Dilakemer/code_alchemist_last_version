from __future__ import annotations

import os
import threading
from contextlib import contextmanager


def env_int(name: str, default: int, *, minimum: int = 1, maximum: int | None = None) -> int:
    raw = os.getenv(name)
    try:
        value = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def env_float(name: str, default: float, *, minimum: float = 0.0, maximum: float | None = None) -> float:
    raw = os.getenv(name)
    try:
        value = float(raw) if raw is not None else default
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


_provider_limits = {
    "gemini": env_int("GEMINI_MAX_CONCURRENCY", 4, minimum=1, maximum=64),
    "openai": env_int("OPENAI_MAX_CONCURRENCY", 8, minimum=1, maximum=64),
    "anthropic": env_int("ANTHROPIC_MAX_CONCURRENCY", 4, minimum=1, maximum=64),
}
_provider_semaphores = {
    provider: threading.BoundedSemaphore(limit)
    for provider, limit in _provider_limits.items()
}


def provider_limit(provider: str) -> int:
    return _provider_limits.get((provider or "").lower(), 4)


@contextmanager
def provider_slot(provider: str, *, wait_seconds: float | None = None):
    key = (provider or "").lower()
    semaphore = _provider_semaphores.get(key)
    if semaphore is None:
        yield
        return

    timeout = env_float("MODEL_QUEUE_TIMEOUT_SEC", 8.0, minimum=0.1, maximum=120.0)
    if wait_seconds is not None:
        timeout = wait_seconds

    acquired = semaphore.acquire(timeout=timeout)
    if not acquired:
        limit = provider_limit(key)
        raise TimeoutError(
            f"{key or 'model'} provider is busy. "
            f"Concurrency limit ({limit}) reached; please retry shortly."
        )

    try:
        yield
    finally:
        semaphore.release()
