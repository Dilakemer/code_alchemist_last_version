"""
ToolRegistry — pluggable tool system for the agent runtime.

Tools are registered via decorators or direct calls and made available
to every agent loop invocation. The registry converts tools to the
provider-specific format on demand.

Usage:
    registry = ToolRegistry()

    @registry.register
    def my_tool() -> Tool:
        return Tool(
            name="my_tool",
            description="Does something",
            input_schema={...},
            execute=my_async_fn,
        )

    tools = registry.get_specs()  # list of dicts
    result = await registry.execute("my_tool", {"arg": "val"}, ctx)
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Optional


@dataclass
class Tool:
    """
    A single agent tool definition.

    Attributes:
        name:         Unique snake_case identifier.
        description:  One-paragraph description shown to the model.
        input_schema: JSON Schema dict describing expected parameters.
        execute:      Async callable that receives (args: dict, ctx: Any) → dict.
        tags:         Optional labels for filtering (e.g. ["workspace", "fs"]).
        enabled:      False = registered but never offered to the model.
    """
    name: str
    description: str
    input_schema: Dict[str, Any]
    execute: Callable[[Dict[str, Any], Any], Awaitable[Dict[str, Any]]]
    tags: List[str] = field(default_factory=list)
    enabled: bool = True


class ToolRegistry:
    """
    Central registry for all tools available to the agent loop.

    Thread-safe for reads; registrations should happen at startup.
    """

    def __init__(self) -> None:
        self._tools: Dict[str, Tool] = {}

    # ── Registration ──────────────────────────────────────────────────────

    def register(self, tool: Tool) -> Tool:
        """Register a tool. Returns the tool (useful as a decorator on factory fns)."""
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered.")
        self._tools[tool.name] = tool
        return tool

    def unregister(self, name: str) -> None:
        self._tools.pop(name, None)

    def enable(self, name: str) -> None:
        if name in self._tools:
            self._tools[name].enabled = True

    def disable(self, name: str) -> None:
        if name in self._tools:
            self._tools[name].enabled = False

    # ── Querying ──────────────────────────────────────────────────────────

    def get_tool(self, name: str) -> Optional[Tool]:
        return self._tools.get(name)

    def list_tools(self, tags: Optional[List[str]] = None) -> List[Tool]:
        """Return enabled tools, optionally filtered by tags."""
        tools = [t for t in self._tools.values() if t.enabled]
        if tags:
            tag_set = set(tags)
            tools = [t for t in tools if tag_set.intersection(t.tags)]
        return tools

    def get_specs(self, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Return tool specs as plain dicts (provider-agnostic JSON Schema format)."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
                "tags": t.tags,
            }
            for t in self.list_tools(tags=tags)
        ]

    # ── Execution ─────────────────────────────────────────────────────────

    async def execute(
        self,
        name: str,
        args: Dict[str, Any],
        ctx: Any,
    ) -> Dict[str, Any]:
        """
        Execute a registered tool and return its result dict.

        Returns an error dict if the tool is unknown or raises.
        """
        tool = self._tools.get(name)
        if tool is None or not tool.enabled:
            return {"ok": False, "error": f"Unknown or disabled tool: '{name}'"}

        # Guard write tools behind an explicit approval flag.
        if "write" in (tool.tags or []) and not bool(getattr(ctx, "allow_write_tools", False)):
            pending = {
                "tool": tool.name,
                "args": args,
                "reason": "write_confirmation_required",
            }
            pending_items = getattr(ctx, "pending_confirmations", None)
            if isinstance(pending_items, list):
                pending_items.append(pending)
            return {
                "ok": False,
                "error": "confirmation_required",
                "requires_confirmation": True,
                "message": (
                    "This action requires explicit write approval. "
                    "Retry with allow_write_tools=true after user confirmation."
                ),
                "tool": tool.name,
                "args": args,
            }

        t0 = time.monotonic()
        try:
            result = await tool.execute(args, ctx)
            duration = round((time.monotonic() - t0) * 1000, 1)
            if isinstance(result, dict):
                result.setdefault("_duration_ms", duration)
            return result
        except Exception as exc:
            return {
                "ok": False,
                "error": str(exc),
                "_duration_ms": round((time.monotonic() - t0) * 1000, 1),
            }

    # ── Summary helpers ───────────────────────────────────────────────────

    def summary(self, result: Dict[str, Any], name: str) -> str:
        """Generate a human-readable summary of a tool result for the trace."""
        if not isinstance(result, dict):
            return f"{name} completed."
        if not result.get("ok", True):
            return result.get("error") or f"{name} failed."

        # Generic summaries per tool name
        summaries = {
            "list_files":       lambda r: f"Listed {r.get('count', 0)} files.",
            "read_file":        lambda r: f"Read {r.get('path', 'file')}.",
            "write_file":       lambda r: ("Patched" if r.get("patched") else ("Created" if r.get("created") else "Updated")) + f" {r.get('path', 'file')}.",
            "delete_file":      lambda r: f"Deleted {r.get('path', 'file')}.",
            "search_files":     lambda r: f"Found {len(r.get('hits') or [])} matching files.",
            "project_search":   lambda r: f"Found {len(r.get('hits') or [])} project hits.",
            "memory_lookup":    lambda r: f"Retrieved {r.get('hit_count', 0)} memory items.",
            "workspace_files":  lambda r: f"Retrieved {r.get('count', 0)} workspace files.",
            "web_search":       lambda r: f"Found {len(r.get('results') or [])} web results.",
            "web_fetch":        lambda r: f"Fetched {r.get('url', 'page')}.",
            "api_get":          lambda r: f"GET {r.get('url', 'endpoint')} -> {r.get('status', '?')}.",
            "db_read":          lambda r: f"Returned {len(r.get('rows') or [])} database rows.",
        }
        fn = summaries.get(name)
        return fn(result) if fn else f"{name} completed."


def create_default_registry() -> ToolRegistry:
    """
    Build and return a ToolRegistry pre-populated with all built-in tools.

    Import is deferred to avoid circular imports and allow selective use.
    """
    from .builtin.project_search import make_project_search_tool
    from .builtin.memory_lookup import make_memory_lookup_tool
    from .builtin.workspace_files import make_workspace_file_tools
    from .builtin.web_search import make_web_search_tool
    from .builtin.remote_read import make_remote_read_tools

    registry = ToolRegistry()

    registry.register(make_project_search_tool())
    registry.register(make_memory_lookup_tool())

    for tool in make_workspace_file_tools():
        registry.register(tool)

    for tool in make_remote_read_tools():
        registry.register(tool)

    registry.register(make_web_search_tool())

    return registry
