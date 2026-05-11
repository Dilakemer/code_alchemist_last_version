from __future__ import annotations

import json
import os
import random
import time
from typing import Any

from locust import HttpUser, between, events, task


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    try:
        return float(raw) if raw is not None else default
    except ValueError:
        return default


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    try:
        return int(raw) if raw is not None else default
    except ValueError:
        return default


MODEL = os.getenv("LOCUST_MODEL", "gpt-4o-mini")
BLEND_MODELS = [
    item.strip()
    for item in os.getenv("LOCUST_BLEND_MODELS", "gpt-4o-mini,claude-sonnet-4-5-20250929").split(",")
    if item.strip()
]
AGENT_MODE = _bool_env("LOCUST_AGENT_MODE", False)
ENABLE_BLEND = _bool_env("LOCUST_ENABLE_BLEND", False)  # Blend disabled for now
NO_SAVE = _bool_env("LOCUST_NO_SAVE", True)
INCLUDE_HISTORY = _bool_env("LOCUST_INCLUDE_HISTORY", False)
STREAM_READ_TIMEOUT = _float_env("LOCUST_STREAM_READ_TIMEOUT", 180.0)  # Increased for fallback model attempts
BLEND_STREAM_READ_TIMEOUT = _float_env("LOCUST_BLEND_STREAM_READ_TIMEOUT", 180.0)
MAX_STREAM_BYTES = _int_env("LOCUST_MAX_STREAM_BYTES", 2_000_000)


PROMPTS = [
    "Kisa cevap ver: Python'da liste comprehension nedir?",
    "Bu React state guncellemesini performans acisindan nasil iyilestiririm?",
    "Flask uygulamasinda ayni anda cok kullanici varken yavaslik nasil analiz edilir?",
    "SQLAlchemy sorgularinda N+1 problemini nasil fark ederim?",
    "Bir API endpoint'i icin hizli smoke test checklist'i yaz.",
]


CODE_SNIPPETS = [
    "",
    "items = [x for x in range(1000) if x % 2 == 0]\nprint(sum(items))",
    "const [items, setItems] = useState([]);\nuseEffect(() => { fetchItems().then(setItems) }, []);",
]


def _parse_sse_payload(line: bytes) -> dict[str, Any] | None:
    if not line.startswith(b"data: "):
        return None
    raw = line[6:].strip()
    if not raw or raw == b"[DONE]":
        return None
    try:
        payload = json.loads(raw.decode("utf-8", errors="replace"))
        return payload if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        return None


class CodeAlchemistUser(HttpUser):
    wait_time = between(
        _float_env("LOCUST_WAIT_MIN", 1.0),
        _float_env("LOCUST_WAIT_MAX", 3.0),
    )

    def on_start(self) -> None:
        self.headers = {
            "Content-Type": "application/json",
            "X-Client-Source": "locust",
        }

        token = os.getenv("LOCUST_AUTH_TOKEN")
        if not token:
            token = self._login_for_token()
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def _login_for_token(self) -> str | None:
        email = os.getenv("LOCUST_EMAIL")
        password = os.getenv("LOCUST_PASSWORD")
        if not email or not password:
            return None

        with self.client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
            name="/api/auth/login",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"login failed: {response.status_code} {response.text[:200]}")
                return None
            token = (response.json() or {}).get("token")
            if not token:
                response.failure("login response did not include token")
                return None
            return str(token)

    @task(6)
    def ask_stream(self) -> None:
        payload = {
            "question": random.choice(PROMPTS),
            "code": random.choice(CODE_SNIPPETS),
            "model": MODEL,
            "agent_mode": AGENT_MODE,
            "include_previous_modules": INCLUDE_HISTORY,
            "no_save": NO_SAVE,
            "request_id": f"locust-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
        }

        started = time.perf_counter()
        first_chunk_ms: float | None = None
        bytes_seen = 0
        done_seen = False
        answer_chars = 0
        total_stream_ms = 0.0

        with self.client.post(
            "/api/ask",
            json=payload,
            headers=self.headers,
            name="/api/ask stream_headers",
            stream=True,
            timeout=STREAM_READ_TIMEOUT,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"status={response.status_code} body={response.text[:300]}")
                return

            for line in response.iter_lines(chunk_size=1024):
                if not line:
                    continue

                bytes_seen += len(line)
                if bytes_seen > MAX_STREAM_BYTES:
                    response.failure(f"stream exceeded {MAX_STREAM_BYTES} bytes")
                    return

                payload = _parse_sse_payload(line)
                if not payload:
                    continue

                text = payload.get("chunk") or payload.get("text") or ""
                if text and first_chunk_ms is None:
                    first_chunk_ms = (time.perf_counter() - started) * 1000
                    events.request.fire(
                        request_type="SSE",
                        name="/api/ask time_to_first_chunk",
                        response_time=first_chunk_ms,
                        response_length=0,
                        exception=None,
                    )
                answer_chars += len(str(text))

                if payload.get("done") is True or payload.get("type") == "done":
                    done_seen = True
                    break

            total_stream_ms = (time.perf_counter() - started) * 1000
            events.request.fire(
                request_type="SSE",
                name="/api/ask stream_total",
                response_time=total_stream_ms,
                response_length=bytes_seen,
                exception=None,
            )

            if not done_seen:
                response.failure("stream ended without done event")
                return

            if answer_chars <= 0:
                response.failure("stream completed with empty answer")
                return

            response.success()

    @task(1)
    def blend_stream(self) -> None:
        if not ENABLE_BLEND:
            return

        if len(BLEND_MODELS) < 2:
            return

        payload = {
            "question": random.choice(PROMPTS),
            "code": random.choice(CODE_SNIPPETS),
            "models": BLEND_MODELS[:4],
            "model": "blend",
            "include_previous_modules": INCLUDE_HISTORY,
            "no_save": NO_SAVE,
            "is_compare": True,
            "request_id": f"locust-blend-{int(time.time() * 1000)}-{random.randint(1000, 9999)}",
        }

        started = time.perf_counter()
        first_chunk_ms: float | None = None
        bytes_seen = 0
        done_seen = False
        answer_chars = 0
        source_models_seen = 0

        with self.client.post(
            "/api/blend",
            json=payload,
            headers=self.headers,
            name="/api/blend stream_headers",
            stream=True,
            timeout=BLEND_STREAM_READ_TIMEOUT,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"status={response.status_code} body={response.text[:300]}")
                return

            for line in response.iter_lines(chunk_size=1024):
                if not line:
                    continue

                bytes_seen += len(line)
                if bytes_seen > MAX_STREAM_BYTES:
                    response.failure(f"blend stream exceeded {MAX_STREAM_BYTES} bytes")
                    return

                payload = _parse_sse_payload(line)
                if not payload:
                    continue

                text = payload.get("chunk") or payload.get("blended_response") or ""
                if text and first_chunk_ms is None:
                    first_chunk_ms = (time.perf_counter() - started) * 1000
                    events.request.fire(
                        request_type="SSE",
                        name="/api/blend time_to_first_chunk",
                        response_time=first_chunk_ms,
                        response_length=0,
                        exception=None,
                    )

                answer_chars += len(str(text))

                if payload.get("status") == "progress":
                    source_models_seen = max(source_models_seen, int(payload.get("completed") or 0))

                if payload.get("done") is True:
                    done_seen = True
                    source_models_seen = max(source_models_seen, len(payload.get("source_models") or []))
                    break

            total_stream_ms = (time.perf_counter() - started) * 1000
            events.request.fire(
                request_type="SSE",
                name="/api/blend stream_total",
                response_time=total_stream_ms,
                response_length=bytes_seen,
                exception=None,
            )

            if not done_seen:
                response.failure("blend stream ended without done event")
                return

            if source_models_seen < 2:
                response.failure("blend completed without at least two source models")
                return

            if answer_chars <= 0:
                response.failure("blend completed with empty answer")
                return

            response.success()

    @task(2)
    def health(self) -> None:
        self.client.get("/health", name="/health")

    @task(1)
    def conversations_optional(self) -> None:
        if "Authorization" not in self.headers:
            return
        self.client.get("/api/conversations", headers=self.headers, name="/api/conversations")


# Disabled: ModelCompareUser forces blend mode which hits Gemini quota limits
# class ModelCompareUser(CodeAlchemistUser):
#     """Use this class when every virtual user should exercise /api/blend."""
#
#     @task
#     def compare_models_only(self) -> None:
#         original = globals()["ENABLE_BLEND"]
#         globals()["ENABLE_BLEND"] = True
#         try:
#             self.blend_stream()
#         finally:
#             globals()["ENABLE_BLEND"] = original
#
#
# ModelCompareUser.tasks = [ModelCompareUser.compare_models_only]
