"""
Built-in read-only remote/data tools.

Tools:
  - web_fetch: fetches a URL and returns extracted text or raw HTML.
  - api_get: performs an HTTP GET request and returns status + body.
  - db_read: executes a read-only SQL query via an injected callback.
"""
from __future__ import annotations

import json
import re
import threading
import time
from typing import Any, Dict, List
from urllib.parse import urlencode, urlparse, parse_qsl
from urllib.request import Request, urlopen

from ..registry import Tool

_CACHE_TTL_SECONDS = 24 * 60 * 60
_WEB_FETCH_CACHE: Dict[str, Dict[str, Any]] = {}
_WEB_FETCH_CACHE_LOCK = threading.Lock()


def _is_allowed_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
    except Exception:
        return False


def _strip_html(html: str) -> str:
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _read_body(url: str, headers: Dict[str, str], timeout_s: float) -> tuple[int, Dict[str, str], str]:
    req = Request(url, headers=headers)
    with urlopen(req, timeout=timeout_s) as resp:
        status = int(getattr(resp, "status", 200))
        raw_headers = {k.lower(): v for k, v in dict(resp.headers).items()}
        body = resp.read().decode("utf-8", errors="replace")
    return status, raw_headers, body


def _cache_key(url: str, extract: str, max_chars: int) -> str:
    return f"{url.strip().lower()}::{extract}::{max_chars}"


def _get_cached_web_fetch(key: str) -> Dict[str, Any] | None:
    now = time.time()
    with _WEB_FETCH_CACHE_LOCK:
        entry = _WEB_FETCH_CACHE.get(key)
        if not entry:
            return None
        if now - float(entry.get("ts", 0)) > _CACHE_TTL_SECONDS:
            _WEB_FETCH_CACHE.pop(key, None)
            return None
        cached = entry.get("value")
        return dict(cached) if isinstance(cached, dict) else None


def _set_cached_web_fetch(key: str, value: Dict[str, Any]) -> None:
    with _WEB_FETCH_CACHE_LOCK:
        _WEB_FETCH_CACHE[key] = {"ts": time.time(), "value": dict(value)}


async def _web_fetch(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    import asyncio

    url = str(args.get("url") or "").strip()
    if not _is_allowed_url(url):
        return {"ok": False, "error": "A valid http/https url is required."}

    extract = str(args.get("extract") or "text").lower()
    if extract not in {"text", "html"}:
        extract = "text"

    max_chars = max(200, min(120_000, int(args.get("max_chars", 20_000) or 20_000)))
    timeout_s = max(1.0, min(15.0, float(args.get("timeout_s", 6.0) or 6.0)))
    headers = {"User-Agent": "CodeAlchemist-Agent/1.0"}

    cache_key = _cache_key(url, extract, max_chars)
    cached = _get_cached_web_fetch(cache_key)
    if cached is not None:
        cached["cached"] = True
        return cached

    loop = asyncio.get_event_loop()
    try:
        status, resp_headers, body = await loop.run_in_executor(
            None,
            lambda: _read_body(url, headers=headers, timeout_s=timeout_s),
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    payload = body if extract == "html" else _strip_html(body)
    clipped = payload[:max_chars]
    result = {
        "ok": True,
        "url": url,
        "status": status,
        "content_type": resp_headers.get("content-type", ""),
        "extract": extract,
        "content": clipped,
        "truncated": len(payload) > max_chars,
        "cached": False,
    }
    _set_cached_web_fetch(cache_key, result)
    return result


async def _api_get(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    import asyncio

    url = str(args.get("url") or "").strip()
    if not _is_allowed_url(url):
        return {"ok": False, "error": "A valid http/https url is required."}

    params = args.get("params") if isinstance(args.get("params"), dict) else {}
    headers = args.get("headers") if isinstance(args.get("headers"), dict) else {}
    timeout_s = max(1.0, min(15.0, float(args.get("timeout_s", 6.0) or 6.0)))
    max_chars = max(200, min(120_000, int(args.get("max_chars", 20_000) or 20_000)))

    parsed = urlparse(url)
    merged = dict(parse_qsl(parsed.query, keep_blank_values=True))
    merged.update({str(k): str(v) for k, v in params.items()})
    query = urlencode(merged)
    final_url = parsed._replace(query=query).geturl()

    safe_headers = {str(k): str(v) for k, v in headers.items()}
    safe_headers.setdefault("User-Agent", "CodeAlchemist-Agent/1.0")

    loop = asyncio.get_event_loop()
    try:
        status, resp_headers, body = await loop.run_in_executor(
            None,
            lambda: _read_body(final_url, headers=safe_headers, timeout_s=timeout_s),
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    content_type = resp_headers.get("content-type", "")
    is_json = "application/json" in content_type.lower()
    result: Dict[str, Any] = {
        "ok": True,
        "url": final_url,
        "status": status,
        "content_type": content_type,
        "headers": {
            "cache-control": resp_headers.get("cache-control", ""),
            "etag": resp_headers.get("etag", ""),
        },
    }

    if is_json:
        try:
            parsed_json = json.loads(body)
            result["json"] = parsed_json
            result["truncated"] = False
            return result
        except Exception:
            pass

    clipped = body[:max_chars]
    result["text"] = clipped
    result["truncated"] = len(body) > max_chars
    return result


def _is_read_only_query(query: str) -> bool:
    q = (query or "").strip().lower()
    if not q:
        return False
    if not (q.startswith("select") or q.startswith("with")):
        return False
    forbidden = [" insert ", " update ", " delete ", " drop ", " alter ", " truncate ", " create "]
    wrapped = f" {q} "
    return not any(token in wrapped for token in forbidden)


async def _db_read(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    import asyncio

    query = str(args.get("query") or "").strip()
    if not _is_read_only_query(query):
        return {"ok": False, "error": "Only read-only SELECT/WITH queries are allowed."}

    limit = max(1, min(500, int(args.get("limit", 100) or 100)))
    callback = getattr(ctx, "db_read_callback", None)
    if not callable(callback):
        return {"ok": False, "error": "db_read_callback is not configured for this runtime."}

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, lambda: callback(query, limit))
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    if isinstance(result, dict):
        result.setdefault("ok", True)
        return result
    return {"ok": True, "rows": result}


def make_remote_read_tools() -> List[Tool]:
    return [
        Tool(
            name="web_fetch",
            description=(
                "Fetch a web page by URL and return extracted text or raw HTML content. "
                "Use this when you need to read and summarize a specific page."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Target http/https URL."},
                    "extract": {
                        "type": "string",
                        "description": "Extraction mode: 'text' or 'html'.",
                        "default": "text",
                    },
                    "max_chars": {
                        "type": "integer",
                        "description": "Maximum content length returned.",
                        "default": 20000,
                    },
                    "timeout_s": {
                        "type": "number",
                        "description": "HTTP timeout in seconds.",
                        "default": 6,
                    },
                },
                "required": ["url"],
            },
            execute=_web_fetch,
            tags=["web", "read"],
        ),
        Tool(
            name="api_get",
            description=(
                "Call an HTTP API with GET and return status, headers, and response body. "
                "Use for endpoint inspection and diagnostics."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "API URL (http/https)."},
                    "params": {
                        "type": "object",
                        "description": "Optional query parameters.",
                        "additionalProperties": {"type": "string"},
                    },
                    "headers": {
                        "type": "object",
                        "description": "Optional request headers.",
                        "additionalProperties": {"type": "string"},
                    },
                    "max_chars": {"type": "integer", "default": 20000},
                    "timeout_s": {"type": "number", "default": 6},
                },
                "required": ["url"],
            },
            execute=_api_get,
            tags=["api", "read"],
        ),
        Tool(
            name="db_read",
            description=(
                "Run a read-only SQL query (SELECT/WITH) through a server-controlled callback. "
                "Never use for writes."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Read-only SQL query."},
                    "limit": {
                        "type": "integer",
                        "description": "Safety row limit (1-500).",
                        "default": 100,
                    },
                },
                "required": ["query"],
            },
            execute=_db_read,
            tags=["db", "read"],
        ),
    ]
