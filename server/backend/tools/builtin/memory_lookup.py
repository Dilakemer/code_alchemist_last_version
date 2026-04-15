"""
Built-in tool: memory_lookup

Retrieves relevant long-term memory items for the current user and question.
Delegates to the existing memory_utils layer.
"""
from __future__ import annotations

from typing import Any, Dict

from ..registry import Tool


async def _execute(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    import asyncio

    query = str(args.get("query") or "").strip()
    if not query:
        return {"ok": False, "error": "query is required"}

    limit = max(1, min(20, int(args.get("limit", 5) or 5)))

    user_id = getattr(ctx, "user_id", None)
    if user_id is None:
        return {"ok": False, "error": "No authenticated user — memory lookup unavailable."}

    # Import memory utils from the existing server layer
    try:
        from utils.memory_utils import build_structured_memory_capsule
    except ImportError:
        return {"ok": False, "error": "memory_utils module not available."}

    try:
        loop = asyncio.get_event_loop()

        def _run():
            # build_structured_memory_capsule is synchronous (DB calls)
            try:
                # We need a User ORM object; retrieve it
                from models import User, db
                user = db.session.get(User, user_id)
                if not user:
                    return None
                capsule = build_structured_memory_capsule(
                    user=user,
                    question=query,
                    top_k=limit,
                )
                return capsule
            except Exception as exc:
                return {"error": str(exc)}

        result = await loop.run_in_executor(None, _run)

        if result is None:
            return {"ok": False, "error": "User not found."}
        if isinstance(result, dict) and "error" in result:
            return {"ok": False, "error": result["error"]}

        # result is a string capsule — parse to structured list
        if isinstance(result, str):
            return {
                "ok": True,
                "hit_count": 1 if result.strip() else 0,
                "memory_text": result,
                "hits": [{"text": result}] if result.strip() else [],
            }

        return {"ok": True, "hit_count": 0, "memory_text": "", "hits": []}

    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def make_memory_lookup_tool() -> Tool:
    return Tool(
        name="memory_lookup",
        description=(
            "Retrieve relevant long-term memory items for the current user based on a query. "
            "Use this to recall past conversations, user preferences, or previously discussed code. "
            "Returns a structured memory capsule with text excerpts."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The topic or question to look up in memory.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of memory items to retrieve.",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        execute=_execute,
        tags=["memory", "user"],
    )
