"""
Built-in tool: project_search

Semantic search over files in the active CodeAlchemist project.
Delegates to the embedding index built by the existing RAG layer in app.py.
"""
from __future__ import annotations

from typing import Any, Dict

from ..registry import Tool


async def _execute(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    query = str(args.get("query") or "").strip()
    if not query:
        return {"ok": False, "error": "query is required"}

    try:
        limit = max(1, min(20, int(args.get("limit", 6) or 6)))
    except Exception:
        limit = 6

    project = getattr(ctx, "project", None)
    search_cb = getattr(ctx, "search_project_callback", None)

    if project is None:
        return {"ok": False, "error": "No project is attached to this conversation."}

    if search_cb is not None:
        try:
            result = search_cb(project, query, top_k=limit)
            hits = (result or {}).get("hits") or []
            if hits:
                return {
                    "ok": True,
                    "scope": "project",
                    "query": query,
                    "hits": [
                        {
                            "path": hit.get("file") or hit.get("path") or "",
                            "score": hit.get("score"),
                            "excerpt": (hit.get("text") or hit.get("snippet") or "")[:800],
                            "chunk_index": hit.get("chunk_index"),
                        }
                        for hit in hits[:limit]
                    ],
                    "search_mode": "semantic",
                }
        except Exception as exc:
            pass  # Fall through to lexical

    # Lexical fallback
    import re
    import math

    tokens = [t for t in re.findall(r"[A-Za-z0-9_./-]+", query.lower()) if len(t) > 1]
    if not tokens:
        tokens = [query.lower()]

    # Attempt to read from project files via ORM
    try:
        files = list(project.files.order_by(project.files.property.mapper.class_.name).all())
    except Exception:
        files = []

    ranked = []
    for pf in files:
        path_lc = (pf.name or "").lower()
        content = pf.content or ""
        content_lc = content.lower()
        score = 0.0
        for tok in tokens:
            score += 4.0 if tok in path_lc else 0.0
            score += min(8.0, float(content_lc.count(tok)))
        if score == 0:
            continue
        first_idx = min(
            [content_lc.find(t) for t in tokens if content_lc.find(t) >= 0] or [-1]
        )
        excerpt = ""
        if first_idx >= 0:
            start = max(0, first_idx - 120)
            excerpt = content[start: first_idx + 220]
        ranked.append({
            "path": pf.name,
            "score": round(score / max(1.0, math.log(len(content or " ") + 10, 10)), 4),
            "excerpt": excerpt[:800],
        })

    ranked.sort(key=lambda h: (-h["score"], h["path"]))
    return {
        "ok": True,
        "scope": "project",
        "query": query,
        "hits": ranked[:limit],
        "search_mode": "lexical",
    }


def make_project_search_tool() -> Tool:
    return Tool(
        name="project_search",
        description=(
            "Search the active project for files relevant to a natural-language query. "
            "Returns ranked excerpts with file paths and similarity scores. "
            "Use this before reading a file when you need to find which file contains certain logic."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural-language search query."},
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of hits to return (1-20).",
                    "default": 6,
                },
            },
            "required": ["query"],
        },
        execute=_execute,
        tags=["project", "search", "rag"],
    )
