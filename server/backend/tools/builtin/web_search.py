"""
Built-in tool: web_search

Performs a lightweight web search and returns titles, URLs and snippets.

Supported providers:
- duckduckgo (no API key, weakest recall)
- serper (Google via serper.dev)
- tavily (tavily.com search API)
- brave (Brave Search API)

Set WEB_SEARCH_PROVIDER plus WEB_SEARCH_API_KEY, or provider-specific keys.
"""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Dict, List
from urllib.parse import urlparse

from ..registry import Tool

_PROVIDER = os.getenv("WEB_SEARCH_PROVIDER", "duckduckgo").lower()
_API_KEY  = os.getenv("WEB_SEARCH_API_KEY", "")
_SERPER_API_KEY = os.getenv("SERPER_API_KEY", _API_KEY)
_TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", _API_KEY)
_BRAVE_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY", _API_KEY)
_CACHE_TTL_SECONDS = 24 * 60 * 60
_SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}
_SEARCH_CACHE_LOCK = threading.Lock()


def _build_fallback_queries(query: str) -> List[str]:
    base = (query or "").strip()
    if not base:
        return []

    q = [base]
    # A second query biased toward official/current sources improves weak SERP hits.
    q.append(f"{base} official documentation latest")
    # A third query uses a policy/availability framing for country-specific checks.
    if any(tok in base.lower() for tok in ["turkiye", "türkiye", "supported", "çalışıyor", "available"]):
        q.append(f"{base} availability supported countries")

    # Preserve order while deduplicating.
    seen = set()
    out = []
    for item in q:
        k = item.lower().strip()
        if k and k not in seen:
            seen.add(k)
            out.append(item)
    return out


def _dedupe_results(results: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    seen_urls = set()
    merged: List[Dict[str, Any]] = []
    for item in results:
        url = str(item.get("url") or "").strip()
        key = url.lower()
        if not key or key in seen_urls:
            continue
        seen_urls.add(key)
        merged.append(item)
        if len(merged) >= limit:
            break
    return merged


def _cache_key(provider: str, query: str, limit: int) -> str:
    return f"{provider}:{limit}:{query.strip().lower()}"


def _get_cached_results(key: str) -> List[Dict[str, Any]] | None:
    now = time.time()
    with _SEARCH_CACHE_LOCK:
        entry = _SEARCH_CACHE.get(key)
        if not entry:
            return None
        if now - float(entry.get("ts", 0)) > _CACHE_TTL_SECONDS:
            _SEARCH_CACHE.pop(key, None)
            return None
        cached = entry.get("value")
        return [dict(item) for item in cached] if isinstance(cached, list) else None


def _set_cached_results(key: str, value: List[Dict[str, Any]]) -> None:
    with _SEARCH_CACHE_LOCK:
        _SEARCH_CACHE[key] = {"ts": time.time(), "value": [dict(item) for item in value]}


def _extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        return parsed.netloc.lower().lstrip("www.")
    except Exception:
        return ""


def _build_recommended_fetch_urls(results: List[Dict[str, Any]], limit: int = 2) -> List[str]:
    seen_domains = set()
    candidates: List[str] = []
    for item in results:
        url = str(item.get("url") or "").strip()
        domain = _extract_domain(url)
        if not url or not domain or domain in seen_domains:
            continue
        seen_domains.add(domain)
        candidates.append(url)
        if len(candidates) >= limit:
            break
    return candidates


async def _search_once(query: str, limit: int) -> List[Dict[str, Any]]:
    cache_key = _cache_key(_PROVIDER, query, limit)
    cached = _get_cached_results(cache_key)
    if cached is not None:
        return cached

    if _PROVIDER == "serper" and _SERPER_API_KEY:
        primary = await _serper_search(query, limit)
        if primary:
            _set_cached_results(cache_key, primary)
            return primary
        # Provider fallback when Serper quota/network fails.
        fallback = await _duckduckgo_search(query, limit)
        if fallback:
            _set_cached_results(cache_key, fallback)
        return fallback

    if _PROVIDER == "tavily" and _TAVILY_API_KEY:
        primary = await _tavily_search(query, limit)
        if primary:
            _set_cached_results(cache_key, primary)
            return primary
        fallback = await _duckduckgo_search(query, limit)
        if fallback:
            _set_cached_results(cache_key, fallback)
        return fallback

    if _PROVIDER == "brave" and _BRAVE_API_KEY:
        primary = await _brave_search(query, limit)
        if primary:
            _set_cached_results(cache_key, primary)
            return primary
        fallback = await _duckduckgo_search(query, limit)
        if fallback:
            _set_cached_results(cache_key, fallback)
        return fallback

    fallback = await _duckduckgo_search(query, limit)
    if fallback:
        _set_cached_results(cache_key, fallback)
    return fallback


async def _duckduckgo_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """
    Calls DuckDuckGo Instant Answer API (no API key required).
    Rate-limited and best-effort; returns [] on failure.
    """
    import asyncio
    import json
    import urllib.parse
    import urllib.request

    encoded = urllib.parse.quote(query)
    url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"

    def _fetch() -> List[Dict[str, Any]]:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CodeAlchemist-Agent/1.0"},
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode())
        except Exception:
            return []

        def _append_result(out: List[Dict[str, Any]], text: str, ref: str, title: str = "") -> None:
            txt = (text or "").strip()
            ttl = (title or "").strip()
            url_value = (ref or "").strip()
            if not url_value or (not txt and not ttl):
                return
            out.append({
                "title": (ttl or txt)[:120],
                "url": url_value,
                "snippet": txt or ttl,
                "domain": _extract_domain(url_value),
            })

        def _walk_related(topics: List[Dict[str, Any]], out: List[Dict[str, Any]]) -> None:
            for topic in topics:
                if len(out) >= limit:
                    return
                if isinstance(topic, dict) and isinstance(topic.get("Topics"), list):
                    _walk_related(topic.get("Topics") or [], out)
                    continue
                text = ""
                ref = ""
                if isinstance(topic, dict):
                    text = topic.get("Text") or ""
                    ref = topic.get("FirstURL") or ""
                _append_result(out, text, ref)

        results: List[Dict[str, Any]] = []

        # RelatedTopics can be flat or nested under groups with a `Topics` key.
        _walk_related(data.get("RelatedTopics") or [], results)

        # Some DDG responses place links under `Results`.
        if len(results) < limit:
            for item in data.get("Results") or []:
                if not isinstance(item, dict):
                    continue
                _append_result(
                    results,
                    item.get("Text") or "",
                    item.get("FirstURL") or "",
                    item.get("Text") or "",
                )
                if len(results) >= limit:
                    break

        # AbstractText as a fallback
        if len(results) < limit and data.get("AbstractText"):
            results.append({
                "title": data.get("Heading") or query,
                "url": data.get("AbstractURL") or "",
                "snippet": data["AbstractText"][:400],
                "domain": _extract_domain(data.get("AbstractURL") or ""),
            })

        return results[:limit]

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def _serper_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Calls Serper.dev Google Search API (requires WEB_SEARCH_API_KEY)."""
    import asyncio
    import json
    import urllib.request

    if not _SERPER_API_KEY:
        return []

    def _fetch() -> List[Dict[str, Any]]:
        try:
            payload = json.dumps({"q": query, "num": limit}).encode()
            req = urllib.request.Request(
                "https://google.serper.dev/search",
                data=payload,
                headers={
                    "X-API-KEY": _SERPER_API_KEY,
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception:
            return []

        results = []
        for item in (data.get("organic") or [])[:limit]:
            results.append({
                "title":   item.get("title", ""),
                "url":     item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "domain": _extract_domain(item.get("link", "")),
            })
        return results

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def _tavily_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Calls Tavily Search API (requires TAVILY_API_KEY or WEB_SEARCH_API_KEY)."""
    import asyncio
    import json
    import urllib.request

    if not _TAVILY_API_KEY:
        return []

    def _fetch() -> List[Dict[str, Any]]:
        try:
            payload = json.dumps({
                "query": query,
                "max_results": limit,
                "search_depth": "basic",
            }).encode()
            req = urllib.request.Request(
                "https://api.tavily.com/search",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {_TAVILY_API_KEY}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception:
            return []

        results = []
        for item in (data.get("results") or [])[:limit]:
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("content", "") or item.get("raw_content", ""),
                "domain": _extract_domain(item.get("url", "")),
            })
        return results

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def _brave_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Calls Brave Search API (requires BRAVE_SEARCH_API_KEY or WEB_SEARCH_API_KEY)."""
    import asyncio
    import json
    import urllib.parse
    import urllib.request

    if not _BRAVE_API_KEY:
        return []

    def _fetch() -> List[Dict[str, Any]]:
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://api.search.brave.com/res/v1/web/search?q={encoded}&count={limit}"
            req = urllib.request.Request(
                url,
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": _BRAVE_API_KEY,
                },
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception:
            return []

        web = data.get("web") or {}
        results = []
        for item in (web.get("results") or [])[:limit]:
            results.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "snippet": item.get("description", ""),
                "domain": _extract_domain(item.get("url", "")),
            })
        return results

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def _execute(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    query = str(args.get("query") or "").strip()
    if not query:
        return {"ok": False, "error": "query is required"}

    limit = max(1, min(10, int(args.get("limit", 5) or 5)))

    all_results: List[Dict[str, Any]] = []
    attempts = _build_fallback_queries(query)
    # Keep the number of outbound searches small and predictable.
    for candidate in attempts[:3]:
        hits = await _search_once(candidate, limit)
        if hits:
            all_results.extend(hits)
        # Stop early if we already have enough unique results.
        if len(_dedupe_results(all_results, limit)) >= limit:
            break

    results = _dedupe_results(all_results, limit)

    return {
        "ok": True,
        "query": query,
        "provider": _PROVIDER,
        "attempted_queries": attempts[:3],
        "results": results,
        "recommended_fetch_urls": _build_recommended_fetch_urls(results, limit=2),
        "count": len(results),
    }


def make_web_search_tool() -> Tool:
    return Tool(
        name="web_search",
        description=(
            "Search the web for current information, documentation, or code examples. "
            "Returns result titles, URLs, and text snippets. "
            "Use when the answer requires up-to-date external knowledge not in the project."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query (natural language or keywords).",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of results to return (1-10).",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        execute=_execute,
        tags=["web", "search", "external"],
    )
