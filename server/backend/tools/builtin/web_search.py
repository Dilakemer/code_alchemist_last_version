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
    """
    Generates a list of query variants from most specific to most general.
    1. Original query
    2. Broadened query (official docs/latest)
    3. Keyword-only query (simplification)
    """
    base = (query or "").strip()
    if not base:
        return []

    variants = [base]
    
    # 1. Broaden: Add documentation context (if long enough)
    words = base.split()
    if len(words) > 2:
        variants.append(f"{base} official documentation latest")

    # 2. Simplify: Remove question words and conversational filler
    stop_words = {"nasıl", "nasil", "nedir", "what", "is", "how", "to", "the", "a", "an", "lütfen", "please", "can", "you", "tell", "me"}
    simplified_words = [w for w in words if w.lower().strip("?!.,") not in stop_words]
    if simplified_words and len(simplified_words) < len(words):
        variants.append(" ".join(simplified_words))
        
    # 3. Keyword only: first 4 significant words
    if len(simplified_words) > 4:
        variants.append(" ".join(simplified_words[:4]))

    # Preserve order while deduplicating.
    seen = set()
    out = []
    for item in variants:
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


async def _search_once(query: str, limit: int, provider: str = None) -> List[Dict[str, Any]]:
    active_provider = provider or _PROVIDER
    cache_key = _cache_key(active_provider, query, limit)
    cached = _get_cached_results(cache_key)
    if cached:
        return cached

    hits = []
    if active_provider == "serper":
        hits = await _serper_search(query, limit)
    elif active_provider == "tavily":
        hits = await _tavily_search(query, limit)
    elif active_provider == "brave":
        hits = await _brave_search(query, limit)
    elif active_provider == "duckduckgo":
        hits = await _duckduckgo_search(query, limit)

    if hits:
        _set_cached_results(cache_key, hits)
    return hits


async def _duckduckgo_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Calls DuckDuckGo Instant Answer API. Falls back to HTML scrape if 0 results."""
    import asyncio
    import json
    import urllib.parse
    import urllib.request
    import re

    def _fetch_api() -> List[Dict[str, Any]]:
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
            req = urllib.request.Request(url, headers={"User-Agent": "CodeAlchemist-Agent/1.0"})
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
        _walk_related(data.get("RelatedTopics") or [], results)
        if len(results) < limit:
            for item in data.get("Results") or []:
                if not isinstance(item, dict): continue
                _append_result(results, item.get("Text") or "", item.get("FirstURL") or "", item.get("Text") or "")
                if len(results) >= limit: break

        if len(results) < limit and data.get("AbstractText"):
            results.append({
                "title": data.get("Heading") or query,
                "url": data.get("AbstractURL") or "",
                "snippet": data["AbstractText"][:400],
                "domain": _extract_domain(data.get("AbstractURL") or ""),
            })
        return results[:limit]

    def _fetch_html() -> List[Dict[str, Any]]:
        try:
            print(f"[web_search] [DDG] API yielded 0. Scrapping HTML for '{query}'...")
            encoded = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded}"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode('utf-8', errors='ignore')
            
            results = []
            matches = re.findall(r'<a class="result__a" rel="nofollow" href="([^"]+)">(.+?)</a>', content, re.DOTALL)
            snippets = re.findall(r'<a class="result__snippet" href="[^"]+">(.+?)</a>', content, re.DOTALL)
            
            for i in range(min(len(matches), len(snippets))):
                raw_url = matches[i][0]
                title = re.sub(r'<[^>]+>', '', matches[i][1]).strip()
                snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip()
                
                url = raw_url
                if "/l/?kh=" in url:
                    from urllib.parse import parse_qs, urlparse
                    try:
                        p = urlparse(url)
                        qs = parse_qs(p.query)
                        if 'uddg' in qs: url = qs['uddg'][0]
                    except: pass

                results.append({"title": title, "url": url, "snippet": snippet, "domain": _extract_domain(url)})
            print(f"[web_search] [DDG] HTML scrape found {len(results)} results.")
            return results[:limit]
        except Exception as e:
            print(f"[web_search] [DDG] HTML scrape failed: {e}")
            return []

    loop = asyncio.get_event_loop()
    hits = await loop.run_in_executor(None, _fetch_api)
    if not hits:
        hits = await loop.run_in_executor(None, _fetch_html)
    return hits


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

    # 1. Multi-stage query variants
    attempts = _build_fallback_queries(query)
    
    # 2. Multi-provider sequence
    # Primary -> DDG (unless DDG is primary)
    providers = [_PROVIDER]
    if _PROVIDER != "duckduckgo":
        providers.append("duckduckgo")

    all_results: List[Dict[str, Any]] = []
    trace_log = []

    # 3. Search Loop: Variants x Providers
    for q_idx, q_variant in enumerate(attempts[:3]):
        for p_idx, provider in enumerate(providers):
            start_time = time.time()
            hits = await _search_once(q_variant, limit, provider=provider)
            duration = (time.time() - start_time) * 1000
            
            trace_log.append({
                "query": q_variant,
                "provider": provider,
                "fallback_level": q_idx,
                "result_count": len(hits),
                "duration_ms": duration
            })
            
            print(f"[web_search] Level {q_idx} | Provider: {provider} | Results: {len(hits)} | Query: '{q_variant}'")
            
            if hits:
                all_results.extend(hits)
            
            # If we have enough unique results, we can stop early
            if len(_dedupe_results(all_results, limit)) >= limit:
                break
        
        if len(_dedupe_results(all_results, limit)) >= limit:
            break

    results = _dedupe_results(all_results, limit)

    return {
        "ok": True,
        "query": query,
        "provider": _PROVIDER,
        "attempted_queries": attempts[:3],
        "search_trace": trace_log,
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
