"""
Built-in workspace file tools: list_files, read_file, write_file, delete_file.

These mirror the capabilities of the existing AgentToolRuntime but are
implemented as pluggable Tool objects for the new registry.

The tools operate on two sources (priority order):
  1. project  — SQLAlchemy ORM (persisted to DB)
  2. workspace_files — in-memory snapshot (client-provided, not persisted)
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from ..registry import Tool


# ── Internal helpers ──────────────────────────────────────────────────────────

def _norm(path: str) -> str:
    cleaned = str(path or "").strip().replace("\\", "/")
    cleaned = re.sub(r"/{2,}", "/", cleaned)
    cleaned = re.sub(r"^\./+", "", cleaned)
    return cleaned.strip("/")


def _get_project(ctx: Any):
    return getattr(ctx, "project", None)


def _get_ws(ctx: Any) -> Dict[str, Any]:
    return getattr(ctx, "workspace_files", {}) or {}


def _register_change(ctx: Any, op: str, path: str, persisted: bool) -> None:
    changed = getattr(ctx, "changed_files", None)
    if isinstance(changed, list):
        changed.append({"operation": op, "path": _norm(path), "persisted": persisted})


def _find_project_file(project, path: str):
    normalized = _norm(path)
    exact = casefold = None
    try:
        from models import ProjectFile
        for pf in project.files.order_by(ProjectFile.name).all():
            pf_path = _norm(pf.name)
            if pf_path == normalized:
                exact = pf
                break
            if pf_path.lower() == normalized.lower() and casefold is None:
                casefold = pf
    except Exception:
        pass
    return exact or casefold


MAX_CHARS = 120_000


def _clip(text: str) -> str:
    return str(text or "")[:MAX_CHARS]


# ── list_files ────────────────────────────────────────────────────────────────

async def _list_files(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    limit = max(1, min(1000, int(args.get("limit", 200) or 200)))
    project = _get_project(ctx)

    if project is not None:
        try:
            from models import ProjectFile
            files = project.files.order_by(ProjectFile.name).all()
            payload = [
                {
                    "path": _norm(f.name),
                    "language": f.language or "plaintext",
                    "size": len(f.content or ""),
                }
                for f in files[:limit]
            ]
            return {
                "ok": True, "scope": "project",
                "project_id": project.id, "project_name": project.name,
                "count": len(payload), "files": payload,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    ws = _get_ws(ctx)
    files = [
        {"path": v["path"], "language": v.get("language", "plaintext"), "size": len(v.get("content", ""))}
        for v in sorted(ws.values(), key=lambda x: x["path"].lower())[:limit]
    ]
    return {"ok": True, "scope": "workspace", "count": len(files), "files": files}


# ── read_file ─────────────────────────────────────────────────────────────────

async def _read_file(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    path = _norm(args.get("path") or "")
    if not path:
        return {"ok": False, "error": "path is required"}

    project = _get_project(ctx)
    if project is not None:
        pf = _find_project_file(project, path)
        if not pf:
            return {"ok": False, "error": f"File not found: {path}"}
        content = pf.content or ""
        return {
            "ok": True, "scope": "project",
            "path": _norm(pf.name),
            "language": pf.language or "plaintext",
            "content": _clip(content),
            "truncated": len(content) > MAX_CHARS,
        }

    ws = _get_ws(ctx)
    norm_lower = path.lower()
    entry = ws.get(path) or next(
        (v for k, v in ws.items() if k.lower() == norm_lower), None
    )
    if not entry:
        return {"ok": False, "error": f"File not found: {path}"}
    content = entry.get("content") or ""
    return {
        "ok": True, "scope": "workspace",
        "path": entry["path"],
        "language": entry.get("language", "plaintext"),
        "content": _clip(content),
        "truncated": len(content) > MAX_CHARS,
    }


# ── write_file ────────────────────────────────────────────────────────────────

async def _write_file(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    path = _norm(args.get("path") or "")
    content = str(args.get("content") or "").replace("\x00", "")
    language = str(args.get("language") or "plaintext")
    if not path:
        return {"ok": False, "error": "path is required"}

    project = _get_project(ctx)
    if project is not None:
        try:
            from models import ProjectFile, db
            pf = _find_project_file(project, path)
            created = pf is None
            if created:
                pf = ProjectFile(project_id=project.id, name=path, content=content, language=language)
                db.session.add(pf)
            else:
                pf.name = path; pf.content = content
                if language: pf.language = language
            db.session.commit()

            # Invalidate embedding cache if callback present
            inv = getattr(ctx, "invalidate_project_cache", None)
            if callable(inv):
                try: inv(project.id)
                except Exception: pass

            _register_change(ctx, "create" if created else "update", path, persisted=True)
            return {
                "ok": True, "scope": "project",
                "path": _norm(pf.name), "language": pf.language,
                "size": len(pf.content or ""), "created": created, "persisted": True,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    ws = _get_ws(ctx)
    if ws is None:
        return {"ok": False, "error": "No writable workspace attached."}
    created = path not in ws and path.lower() not in {k.lower() for k in ws}
    ws[path] = {"path": path, "content": content, "language": language}
    _register_change(ctx, "create" if created else "update", path, persisted=False)
    return {
        "ok": True, "scope": "workspace",
        "path": path, "language": language,
        "size": len(content), "created": created, "persisted": False,
        "message": "Updated workspace snapshot. Apply changes locally on the client.",
    }


# ── delete_file ───────────────────────────────────────────────────────────────

async def _delete_file(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    path = _norm(args.get("path") or "")
    if not path:
        return {"ok": False, "error": "path is required"}

    project = _get_project(ctx)
    if project is not None:
        try:
            from models import ProjectFile, db
            pf = _find_project_file(project, path)
            if not pf:
                return {"ok": False, "error": f"File not found: {path}"}
            db.session.delete(pf)
            db.session.commit()
            inv = getattr(ctx, "invalidate_project_cache", None)
            if callable(inv):
                try: inv(project.id)
                except Exception: pass
            _register_change(ctx, "delete", path, persisted=True)
            return {"ok": True, "scope": "project", "path": path, "persisted": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    ws = _get_ws(ctx)
    norm_lower = path.lower()
    key = next((k for k in ws if k == path or k.lower() == norm_lower), None)
    if not key:
        return {"ok": False, "error": f"File not found: {path}"}
    ws.pop(key)
    _register_change(ctx, "delete", path, persisted=False)
    return {
        "ok": True, "scope": "workspace", "path": path, "persisted": False,
        "message": "Deleted from workspace snapshot.",
    }


# ── Factory ───────────────────────────────────────────────────────────────────

def make_workspace_file_tools() -> List[Tool]:
    """Return all four workspace file management tools."""
    return [
        Tool(
            name="list_files",
            description=(
                "List files available in the active project or workspace. "
                "Returns paths, languages, and file sizes."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of files to return.",
                        "default": 200,
                    }
                },
            },
            execute=_list_files,
            tags=["workspace", "fs"],
        ),
        Tool(
            name="read_file",
            description=(
                "Read the full content of a file by its exact relative path. "
                "Always read a file before modifying it to avoid overwriting unrelated code."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path to read."}
                },
                "required": ["path"],
            },
            execute=_read_file,
            tags=["workspace", "fs"],
        ),
        Tool(
            name="write_file",
            description=(
                "Create or overwrite a file in the active project or workspace. "
                "Provide the complete new file content; partial edits are not supported."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path."},
                    "content": {"type": "string", "description": "Complete file content."},
                    "language": {"type": "string", "description": "Language label (optional)."},
                },
                "required": ["path", "content"],
            },
            execute=_write_file,
            tags=["workspace", "fs", "write"],
        ),
        Tool(
            name="delete_file",
            description="Delete a file from the active project or workspace.",
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path to delete."}
                },
                "required": ["path"],
            },
            execute=_delete_file,
            tags=["workspace", "fs", "write"],
        ),
    ]
