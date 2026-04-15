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


def _register_change(
    ctx: Any,
    op: str,
    path: str,
    persisted: bool,
    content: str | None = None,
    language: str | None = None,
    trust_id: str | None = None,
    trust_scope: str | None = None,
    render_url: str | None = None,
) -> None:
    changed = getattr(ctx, "changed_files", None)
    if isinstance(changed, list):
        changed.append(
            {
                "operation": op,
                "path": _norm(path),
                "persisted": persisted,
                "content": _clip(content) if content is not None and op != "delete" else None,
                "language": language or "plaintext",
                "trust_id": trust_id,
                "trust_scope": trust_scope,
                "render_url": render_url,
            }
        )


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
MAX_READ_CHARS = 500_000


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

    try:
        offset = max(0, int(args.get("offset", 0) or 0))
    except Exception:
        offset = 0

    requested = args.get("max_chars", args.get("length", MAX_CHARS))
    try:
        read_chars = max(200, min(MAX_READ_CHARS, int(requested or MAX_CHARS)))
    except Exception:
        read_chars = MAX_CHARS

    def _window(content: str) -> Dict[str, Any]:
        total = len(content)
        start = min(offset, total)
        end = min(total, start + read_chars)
        clipped = content[start:end]
        return {
            "content": clipped,
            "truncated": end < total,
            "offset": start,
            "returned_chars": len(clipped),
            "total_chars": total,
            "next_offset": end if end < total else None,
        }

    project = _get_project(ctx)
    if project is not None:
        pf = _find_project_file(project, path)
        if not pf:
            return {"ok": False, "error": f"File not found: {path}"}
        content = pf.content or ""
        window = _window(content)
        return {
            "ok": True, "scope": "project",
            "path": _norm(pf.name),
            "language": pf.language or "plaintext",
            **window,
        }

    ws = _get_ws(ctx)
    norm_lower = path.lower()
    entry = ws.get(path) or next(
        (v for k, v in ws.items() if k.lower() == norm_lower), None
    )
    if not entry:
        return {"ok": False, "error": f"File not found: {path}"}
    content = entry.get("content") or ""
    window = _window(content)
    return {
        "ok": True, "scope": "workspace",
        "path": entry["path"],
        "language": entry.get("language", "plaintext"),
        **window,
    }


# ── write_file ────────────────────────────────────────────────────────────────

import os

def _generate_render_url(path: str) -> str | None:
    """
    Generate a preview URL for a file if it is an HTML or similar previewable file.
    """
    ext = os.path.splitext(path)[1].lower()
    if ext not in [".html", ".htm", ".svg"]:
        return None
    
    # Try to get the public host from environment, fallback to localhost if not set
    # User's actual link: https://code-alchemist-last-version.onrender.com
    base_url = os.getenv("RENDER_EXTERNAL_URL") or os.getenv("PREVIEW_BASE_URL") or "http://localhost:5173"
    
    # If the base URL doesn't have a protocol, assume https for Render or http for local
    if not base_url.startswith("http"):
        base_url = f"https://{base_url}"
        
    return f"{base_url.rstrip('/')}/{_norm(path)}"


async def _write_file(args: Dict[str, Any], ctx: Any) -> Dict[str, Any]:
    path = _norm(args.get("path") or "")
    content = str(args.get("content") or "").replace("\x00", "")
    language = str(args.get("language") or "plaintext")
    mode = str(args.get("mode") or "replace").strip().lower()
    if mode not in {"replace", "append", "prepend"}:
        return {"ok": False, "error": "mode must be one of: replace, append, prepend"}
    if not path:
        return {"ok": False, "error": "path is required"}

    render_url = _generate_render_url(path)

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
                base = pf.content or ""
                if mode == "append":
                    pf.content = base + content
                elif mode == "prepend":
                    pf.content = content + base
                else:
                    pf.content = content
                pf.name = path
                if language: pf.language = language

            if created and mode in {"append", "prepend"}:
                # For new files, append/prepend are equivalent to replace.
                pf.content = content

            db.session.commit()

            # Invalidate embedding cache if callback present
            inv = getattr(ctx, "invalidate_project_cache", None)
            if callable(inv):
                try: inv(project.id)
                except Exception: pass

            _register_change(
                ctx,
                "create" if created else "update",
                path,
                persisted=True,
                content=content,
                language=pf.language or language,
                render_url=render_url,
            )
            return {
                "ok": True, "scope": "project",
                "path": _norm(pf.name), "language": pf.language,
                "size": len(pf.content or ""), "created": created, "persisted": True, "mode": mode,
                "render_url": render_url,
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    ws = _get_ws(ctx)
    if ws is None:
        return {"ok": False, "error": "No writable workspace attached."}
    created = path not in ws and path.lower() not in {k.lower() for k in ws}
    existing = ws.get(path) or {}
    base_content = existing.get("content") or ""
    if mode == "append":
        next_content = base_content + content
    elif mode == "prepend":
        next_content = content + base_content
    else:
        next_content = content

    if created and mode in {"append", "prepend"}:
        next_content = content

    ws[path] = {
        "path": path,
        "content": next_content,
        "language": language,
        "trust_id": existing.get("trust_id"),
        "trust_scope": existing.get("trust_scope"),
    }
    _register_change(
        ctx,
        "create" if created else "update",
        path,
        persisted=False,
        content=next_content,
        language=language,
        trust_id=ws[path].get("trust_id"),
        trust_scope=ws[path].get("trust_scope"),
        render_url=render_url,
    )
    return {
        "ok": True, "scope": "workspace",
        "path": path, "language": language,
        "size": len(next_content), "created": created, "persisted": False, "mode": mode,
        "render_url": render_url,
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
                "Read file content by exact relative path. "
                "Supports paginated reads with offset/max_chars for large files. "
                "Always read a file before modifying it to avoid overwriting unrelated code."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path to read."},
                    "offset": {"type": "integer", "description": "0-based start character offset.", "default": 0},
                    "max_chars": {"type": "integer", "description": "Maximum characters to return in this read window.", "default": 120000},
                },
                "required": ["path"],
            },
            execute=_read_file,
            tags=["workspace", "fs"],
        ),
        Tool(
            name="write_file",
            description=(
                "Create or update a file in the active project or workspace. "
                "Supports replace (default), append, and prepend modes."
            ),
            input_schema={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Relative file path."},
                    "content": {"type": "string", "description": "Complete file content."},
                    "language": {"type": "string", "description": "Language label (optional)."},
                    "mode": {
                        "type": "string",
                        "enum": ["replace", "append", "prepend"],
                        "default": "replace",
                        "description": "Write mode: replace existing content, append to end, or prepend to beginning.",
                    },
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
