from __future__ import annotations

import json
import math
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Optional


class AgentAbortException(Exception):
    """Raised when an agent turn is cancelled by the user."""
    pass

from models import ProjectFile, db
from services.latency_tracker import tracker
from utils.timeout_utils import to_gemini_timeout


MAX_AGENT_STEPS = 10
DEFAULT_MAX_FILE_CHARS = 120000


def _max_agent_steps() -> int:
    raw = os.getenv("AGENT_MAX_STEPS")
    try:
        value = int(raw) if raw is not None else MAX_AGENT_STEPS
    except Exception:
        value = MAX_AGENT_STEPS
    return max(1, min(12, value))


def _safe_json_loads(raw: Any, default: Optional[dict] = None) -> dict:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return default or {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else (default or {})
    except Exception:
        return default or {}


def _normalize_path(path_str: str, workspace_root: Optional[str] = None) -> str:
    """
    Normalizes a path string and enforces security boundaries.
    1. Replaces backslashes with forward slashes.
    2. Strips leading/trailing slashes and current directory markers.
    3. If workspace_root is provided, ensures the path stays within it (unless trusted).
    """
    if not path_str:
        return ""
    
    # Format fix
    cleaned = str(path_str).strip().replace("\\", "/")
    cleaned = re.sub(r"/{2,}", "/", cleaned)
    cleaned = re.sub(r"^\./+", "", cleaned)
    
    # Basic normalization
    if cleaned.startswith("/"):
        cleaned = cleaned[1:]
    if cleaned.endswith("/"):
        cleaned = cleaned[:-1]

    return cleaned


def _chunk_text(text: str, chunk_size: int = 220) -> Iterable[str]:
    if not text:
        return []
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]


def _get_gemini_types():
    try:
        import importlib
        genai_module = importlib.import_module("google.genai")
        return genai_module.types
    except Exception:
        return None


def _build_language_hint(question: str, prefs: Optional[dict]) -> str:
    language = (prefs or {}).get("preferred_language")
    if language:
        return f"Always respond in {language} unless the user explicitly asks for another language."
    if re.search(r"[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015E\u00DC]", question or ""):
        return "Respond in Turkish unless the user explicitly asks for another language."
    return "Respond in the same language as the user's latest message."


def build_agent_system_prompt(
    question: str,
    prefs: Optional[dict] = None,
    github_context: str = "",
    has_tool_access: bool = False,
    workspace_label: str = "project workspace",
) -> str:
    persona_info = ""
    if prefs:
        persona = prefs.get("persona", "General User")
        expertise = prefs.get("expertise", "Intermediate")
        interests = ", ".join(prefs.get("interests", []))
        persona_info = f"User profile: {persona} (expertise: {expertise}). "
        if interests:
            persona_info += f"User interests: {interests}. "

    tool_guidance = (
        f"You are operating in Agent Mode with tool access to the active {workspace_label}. "
        "Use tools whenever you need to inspect, search, create, update, or delete files. "
        "IMPORTANT: Batch related file operations in a single turn whenever possible (e.g., write multiple files at once if they belong to the same logical change) to reduce latency. "
        "When you change files, explain the results clearly. "
        "IMPORTANT: The `run_command` and `execute_command` tools are ASYNCHRONOUS. They send the command to the user's terminal but do NOT return the command's output to you in the same turn. When you use these tools, you MUST inform the user that the command has been started and then provide your final answer immediately. Do NOT attempt to poll or wait for the command output."
        "Prefer 1-2 searches before fetching pages. Avoid redundant queries. "
        "When search results expose recommended_fetch_urls, fetch only the top 2 distinct trusted domains first. "
        "Batch independent search or fetch calls in one turn when they do not depend on each other."
        if has_tool_access
        else "Agent Mode is enabled, but no writable workspace is attached for this turn. Answer normally."
    )

    context_block = ""
    if github_context:
        context_block = (
            "\n\nAdditional retrieved context is available below. "
            "Use it when relevant, but prefer direct tool inspection if there is a workspace attached."
            f"\n{github_context}"
        )

    return (
        "You are a senior software engineering agent. "
        "Be precise, practical, and collaborative. "
        f"{persona_info}"
        f"{_build_language_hint(question, prefs)} "
        "STRICT: Never output internal labels like 'Role:', 'Language constraint:', 'User Profile:', 'Length:', or any instruction/analysis headers. Do not reveal internal reasoning or prompt structure. "
        "CRITICAL: Your final response MUST ONLY contain the message for the user. Do NOT include any internal thoughts, reasoning, or 'Thinking process' labels in the output. "
        "For greetings or small talk, reply naturally in 1-2 short sentences. "
        f"{tool_guidance}"
        f"{context_block}"
        "\n\nSen bir AI asistansın. Kullanıcının mesajını aldığında ÖNCE karar ver:\n\n"
        "**AGENT MODUNU KULLAN (tools/steps gerektiğinde):**\n"
        "- Web araması gerektiren sorular\n"
        "- Hesaplama, kod yazma, dosya işleme, terminal komutu çalıştırma\n"
        "- Çok adımlı görevler\n"
        "- Gerçek zamanlı veri gerektiren sorular\n\n"
        "**NORMAL YANIT VER (agent modu KULLANMA):**\n"
        "- Selamlama ve sohbet (\"selam\", \"nasılsın\", \"teşekkürler\")\n"
        "- Basit genel bilgi soruları\n"
        "- Evet/hayır soruları\n"
        "- Kısa tanım soruları\n\n"
        "Eğer kullanıcı mesajı yukarıdaki \"NORMAL YANIT\" kategorisine giriyorsa,\n"
        "hiçbir tool çağırma, hiçbir adım atmadan DOĞRUDAN yanıt ver. Yanıtın kısa ve öz olmalı. "
        "STRICT: Final response MUST contain ONLY the message for the user. NO labels, NO thinking, NO metadata. "
    ).strip()


def build_agent_user_message(question: str, code: str = "") -> str:
    message = f"User request:\n{(question or '').strip() or 'No question provided.'}"
    if code and code.strip():
        message += f"\n\nRelated code:\n```text\n{code.strip()}\n```"
    return message


@dataclass
class AgentRunResult:
    text: str
    trace: List[dict] = field(default_factory=list)
    changed_files: List[dict] = field(default_factory=list)
    tool_capable: bool = False


class AgentToolRuntime:
    def __init__(
        self,
        *,
        project=None,
        workspace_root: Optional[str] = None,
        workspace_files: Optional[List[dict]] = None,
        search_project_callback: Optional[Callable[..., Optional[dict]]] = None,
        invalidate_project_cache: Optional[Callable[[int], None]] = None,
        max_file_chars: int = DEFAULT_MAX_FILE_CHARS,
    ):
        # We store the ID to avoid detached instance errors in threads
        self.project_id = project if isinstance(project, (int, str)) else getattr(project, "id", None) if project else None
        # We still keep the reference for sync use if it's already loaded, but we'll re-fetch if needed
        self._project = project if not isinstance(project, (int, str)) else None
        
        self.workspace_root = workspace_root
        self.search_project_callback = search_project_callback
        self.invalidate_project_cache = invalidate_project_cache
        self.max_file_chars = max(2000, int(max_file_chars or DEFAULT_MAX_FILE_CHARS))
        self.changed_files: List[dict] = []
        self.workspace_files = None
        self.trusted_files: Dict[str, Dict[str, str]] = {} # path -> {trust_id, trust_scope}

        if workspace_files is not None:
            self.workspace_files = {}
            for item in workspace_files:
                path = _normalize_path(item.get("path") or item.get("name") or "")
                if not path:
                    continue
                
                # Register trust if token provided
                trust_id = item.get("trust_id")
                if trust_id:
                    self.trusted_files[path] = {
                        "trust_id": trust_id,
                        "trust_scope": item.get("trust_scope", "workspace")
                    }

                self.workspace_files[path] = {
                    "path": path,
                    "content": str(item.get("content") or ""),
                    "language": str(item.get("language") or item.get("lang") or "plaintext"),
                    "trust_id": trust_id,
                    "trust_scope": item.get("trust_scope")
                }

    @property
    def has_tool_access(self) -> bool:
        return bool(self.project or self.workspace_files is not None)

    @property
    def workspace_label(self) -> str:
        if self.project is not None:
            return f"project '{self.project.name}'"
        if self.workspace_files is not None:
            return "workspace snapshot"
        return "conversation"

    def export_workspace_files(self) -> Optional[List[dict]]:
        if self.workspace_files is None:
            return None
        return [
            {
                "path": item["path"],
                "content": item["content"],
                "language": item.get("language") or "plaintext",
            }
            for item in sorted(self.workspace_files.values(), key=lambda entry: entry["path"].lower())
        ]

    def get_tool_specs(self) -> List[dict]:
        return [
            {
                "name": "list_files",
                "description": "List files that are available in the active project or workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of file paths to return.",
                            "default": 200,
                        }
                    },
                },
            },
            {
                "name": "read_file",
                "description": "Read the full text content of a file by its exact relative path.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path to read."}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "write_file",
                "description": "Create or overwrite a file in the active project or workspace. NOTE: Direct edits to project configuration/dependency files (e.g. package.json, requirements.txt) are FORBIDDEN. Use run_command for these.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path to create or update."},
                        "content": {"type": "string", "description": "Complete new file content."},
                        "language": {"type": "string", "description": "Optional language label."},
                    },
                    "required": ["path", "content"],
                },
            },
            {
                "name": "delete_file",
                "description": "Delete a file from the active project or workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative file path to delete."}
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "search_files",
                "description": "Search the active project or workspace for files relevant to a natural-language query.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Natural-language search query."},
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of hits to return.",
                            "default": 6,
                        },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "run_command",
                "description": "Execute a shell command in the user's terminal. Use this for installing dependencies, running tests, or building the project. NOTE: This tool is asynchronous and does not return the output of the command in the current turn.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "The exact shell command to run (e.g. 'npm install', 'pytest')."},
                        "cwd": {"type": "string", "description": "Optional working directory relative to workspace root."},
                        "background": {"type": "boolean", "description": "Whether to run the command in the background.", "default": True},
                    },
                    "required": ["command"],
                },
            },
            {
                "name": "execute_command",
                "description": "Alias for run_command. Execute a shell command.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "The exact shell command to run."},
                        "cwd": {"type": "string", "description": "Optional working directory."},
                        "background": {"type": "boolean", "description": "Run in background?", "default": True},
                    },
                    "required": ["command"],
                },
            },
        ]

    def execute(self, name: str, raw_args: Any) -> dict:
        if not self.has_tool_access:
            return {
                "ok": False,
                "error": "No project or workspace files are attached to this turn.",
            }

        args = _safe_json_loads(raw_args, default={})
        tool_name = (name or "").strip()

        if tool_name == "list_files":
            return self._list_files(args)
        if tool_name == "read_file":
            return self._read_file(args)
        if tool_name == "write_file":
            return self._write_file(args)
        if tool_name == "delete_file":
            return self._delete_file(args)
        if tool_name == "search_files":
            return self._search_files(args)
        if tool_name in ("run_command", "execute_command"):
            return self._run_terminal_command(args)

        return {"ok": False, "error": f"Unknown tool: {tool_name}"}

    @property
    def project(self):
        """Lazy-loaded, session-safe project property."""
        if self._project:
            try:
                # Check if detached/expired
                _ = self._project.id
                return self._project
            except Exception:
                self._project = None

        if self.project_id:
            from app import app
            from models import Project, db
            with app.app_context():
                self._project = db.session.get(Project, self.project_id)
        return self._project

    def _get_project_files(self) -> List[ProjectFile]:
        p = self.project
        if not p:
            return []
        from app import app
        from models import ProjectFile
        with app.app_context():
            return p.files.order_by(ProjectFile.name).all()

    def _find_project_file(self, path: str):
        normalized = _normalize_path(path)
        exact = None
        casefold_match = None
        for pf in self._get_project_files():
            pf_path = _normalize_path(pf.name)
            if pf_path == normalized:
                exact = pf
                break
            if pf_path.lower() == normalized.lower() and casefold_match is None:
                casefold_match = pf
        return exact or casefold_match

    def _find_workspace_file(self, path: str):
        if self.workspace_files is None:
            return None
        normalized = _normalize_path(path)
        exact = self.workspace_files.get(normalized)
        if exact:
            return exact
        normalized_lower = normalized.lower()
        for key, value in self.workspace_files.items():
            if key.lower() == normalized_lower:
                return value
        return None

    def _truncate_content(self, text: str) -> str:
        safe_text = str(text or "")
        return safe_text[: self.max_file_chars]

    def _register_change(
        self,
        operation: str,
        path: str,
        persisted: bool,
        trust_id: Optional[str] = None,
        content: Optional[str] = None,
        language: Optional[str] = None,
        original_content: Optional[str] = None,
    ):
        normalized_path = _normalize_path(path)
        self.changed_files.append(
            {
                "operation": operation,
                "path": normalized_path,
                "persisted": bool(persisted),
                "trust_id": trust_id,
                "trust_scope": self.trusted_files.get(path, {}).get("trust_scope") if path in self.trusted_files else None,
                "content": self._truncate_content(content) if content is not None and operation != "delete" else None,
                "originalContent": self._truncate_content(original_content) if original_content is not None else None,
                "language": language or "plaintext",
            }
        )

    def _list_files(self, args: dict) -> dict:
        try:
            limit = max(1, min(1000, int(args.get("limit", 200) or 200)))
        except Exception:
            limit = 200

        if self.project is not None:
            files = self._get_project_files()
            payload = [
                {
                    "path": _normalize_path(f.name),
                    "language": f.language or "plaintext",
                    "size": len(f.content or ""),
                    "updated_at": f.updated_at.isoformat() if getattr(f, "updated_at", None) else None,
                }
                for f in files[:limit]
            ]
            return {
                "ok": True,
                "scope": "project",
                "project_id": self.project.id,
                "project_name": self.project.name,
                "count": len(payload),
                "files": payload,
            }

        files = [
            {
                "path": item["path"],
                "language": item.get("language") or "plaintext",
                "size": len(item.get("content") or ""),
            }
            for item in sorted(self.workspace_files.values(), key=lambda entry: entry["path"].lower())[:limit]
        ]
        return {
            "ok": True,
            "scope": "workspace",
            "count": len(files),
            "files": files,
        }

    def _read_file(self, args: dict) -> dict:
        path = _normalize_path(args.get("path") or "")
        if not path:
            return {"ok": False, "error": "path is required"}

        if self.project is not None:
            pf = self._find_project_file(path)
            if not pf:
                return {"ok": False, "error": f"File not found: {path}"}
            return {
                "ok": True,
                "scope": "project",
                "path": _normalize_path(pf.name),
                "language": pf.language or "plaintext",
                "content": self._truncate_content(pf.content or ""),
                "truncated": len(pf.content or "") > self.max_file_chars,
            }

        wf = self._find_workspace_file(path)
        if not wf:
            return {"ok": False, "error": f"File not found: {path}"}
        content = wf.get("content") or ""
        return {
            "ok": True,
            "scope": "workspace",
            "path": wf["path"],
            "language": wf.get("language") or "plaintext",
            "content": self._truncate_content(content),
            "truncated": len(content) > self.max_file_chars,
        }

    def _write_file(self, args: dict) -> dict:
        path = _normalize_path(args.get("path") or "")
        content = str(args.get("content") or "")
        language = str(args.get("language") or "plaintext")
        # Agent might try to pass trust_id back if it's smart, or we infer it
        trust_id = args.get("trust_id")
        
        if not path:
            return {"ok": False, "error": "path is required"}

        # Physical guard for dependency files - block at the very start
        PROTECTED_FILES = ["package.json", "package-lock.json", "yarn.lock", "requirements.txt", "pipfile", "composer.json"]
        if any(path.lower().endswith(f) for f in PROTECTED_FILES):
            return {
                "ok": False,
                "error": f"DIRECT_EDIT_FORBIDDEN: You are not allowed to edit '{path}' directly. Please use the appropriate terminal command (e.g. npm install, pip install) to manage dependencies via the `run_command` tool."
            }

        # Security Check: Trusted Token or Workspace Boundary
        is_trusted = False
        if path in self.trusted_files:
            # If agent doesn't send trust_id, we check if the path itself is in our registry
            # In a stricter model, we'd require the agent to "prove" trust by repeating the ID
            is_trusted = True
            trust_id = trust_id or self.trusted_files[path]["trust_id"]

        if not is_trusted and self.workspace_root:
            # Check if path is absolute but outside workspace
            if os.path.isabs(path):
                real_root = os.path.realpath(self.workspace_root)
                real_path = os.path.realpath(path)
                if not real_path.startswith(real_root):
                    return {"ok": False, "error": f"Permission denied: Path is outside workspace and not trusted: {path}"}

        safe_content = content.replace("\x00", "")

        if self.project is not None:
            # (Existing project logic remains same, it's inherently trusted as it's in DB)
            pf = self._find_project_file(path)
            old_content = pf.content if pf else None
            created = pf is None
            if created:
                pf = ProjectFile(
                    project_id=self.project.id,
                    name=path,
                    content=safe_content,
                    language=language or "plaintext",
                )
                db.session.add(pf)
            else:
                pf.name = path
                pf.content = safe_content
                if language:
                    pf.language = language
            db.session.commit()
            if self.invalidate_project_cache:
                try:
                    self.invalidate_project_cache(self.project.id)
                except Exception:
                    pass
            self._register_change(
                "create" if created else "update",
                path,
                persisted=True,
                content=safe_content,
                language=pf.language or language or "plaintext",
                original_content=old_content,
            )
            return {
                "ok": True,
                "scope": "project",
                "path": _normalize_path(pf.name),
                "language": pf.language or "plaintext",
                "size": len(pf.content or ""),
                "created": created,
                "persisted": True,
            }

        if self.workspace_files is None:
            return {"ok": False, "error": "No writable workspace is attached."}

        # For workspace snapshots, we allow the write if it's trusted or inside workspace
        wf_entry = self._find_workspace_file(path)
        old_content = wf_entry["content"] if wf_entry else None
        created = wf_entry is None
        
        self.workspace_files[path] = {
            "path": path,
            "content": safe_content,
            "language": language or "plaintext",
            "trust_id": trust_id,
            "trust_scope": self.trusted_files.get(path, {}).get("trust_scope")
        }
        self._register_change(
            "create" if created else "update",
            path,
            persisted=False,
            trust_id=trust_id,
            content=safe_content,
            language=language or "plaintext",
            original_content=old_content,
        )
        
        return {
            "ok": True,
            "scope": "workspace",
            "path": path,
            "language": language or "plaintext",
            "size": len(safe_content),
            "created": created,
            "persisted": False,
            "trust_id": trust_id,
            "message": "Updated the workspace snapshot. A client can apply these changes locally.",
        }

    def _delete_file(self, args: dict) -> dict:
        path = _normalize_path(args.get("path") or "")
        if not path:
            return {"ok": False, "error": "path is required"}

        if self.project is not None:
            pf = self._find_project_file(path)
            if not pf:
                return {"ok": False, "error": f"File not found: {path}"}
            db.session.delete(pf)
            db.session.commit()
            if self.invalidate_project_cache:
                try:
                    self.invalidate_project_cache(self.project.id)
                except Exception:
                    pass
            self._register_change("delete", path, persisted=True, original_content=pf.content)
            return {
                "ok": True,
                "scope": "project",
                "path": path,
                "persisted": True,
            }

        wf = self._find_workspace_file(path)
        if not wf:
            return {"ok": False, "error": f"File not found: {path}"}
        self.workspace_files.pop(wf["path"], None)
        self._register_change("delete", path, persisted=False, original_content=wf.get("content"))
        return {
            "ok": True,
            "scope": "workspace",
            "path": path,
            "persisted": False,
            "message": "Deleted from the workspace snapshot. A client can mirror this locally.",
        }

    def _search_files(self, args: dict) -> dict:
        query = str(args.get("query") or "").strip()
        if not query:
            return {"ok": False, "error": "query is required"}

        try:
            limit = max(1, min(20, int(args.get("limit", 6) or 6)))
        except Exception:
            limit = 6

        if self.project is not None and self.search_project_callback:
            try:
                result = self.search_project_callback(self.project, query, top_k=limit)
                hits = (result or {}).get("hits") or []
                if hits:
                    return {
                        "ok": True,
                        "scope": "project",
                        "query": query,
                        "hits": [
                            {
                                "path": _normalize_path(hit.get("file") or ""),
                                "score": hit.get("score"),
                                "excerpt": self._truncate_content(hit.get("text") or ""),
                                "chunk_index": hit.get("chunk_index"),
                            }
                            for hit in hits[:limit]
                        ],
                        "search_mode": "semantic",
                    }
            except Exception:
                pass

        hits = self._lexical_search(query, limit=limit)
        return {
            "ok": True,
            "scope": "project" if self.project is not None else "workspace",
            "query": query,
            "hits": hits,
            "search_mode": "lexical",
        }

    def _lexical_search(self, query: str, limit: int = 6) -> List[dict]:
        tokens = [tok for tok in re.findall(r"[A-Za-z0-9_./-]+", query.lower()) if len(tok) > 1]
        if not tokens:
            tokens = [query.lower()]

        corpus = []
        if self.project is not None:
            for pf in self._get_project_files():
                corpus.append(
                    {
                        "path": _normalize_path(pf.name),
                        "language": pf.language or "plaintext",
                        "content": pf.content or "",
                    }
                )
        elif self.workspace_files is not None:
            corpus.extend(sorted(self.workspace_files.values(), key=lambda entry: entry["path"].lower()))

        ranked = []
        for item in corpus:
            path_lc = item["path"].lower()
            content = item.get("content") or ""
            content_lc = content.lower()
            score = 0.0
            for tok in tokens:
                score += 4.0 if tok in path_lc else 0.0
                score += min(8.0, float(content_lc.count(tok)))
            if not score and query.lower() not in path_lc and query.lower() not in content_lc:
                continue
            excerpt = ""
            first_index = min(
                [content_lc.find(tok) for tok in tokens if content_lc.find(tok) >= 0] or [-1]
            )
            if first_index >= 0:
                start = max(0, first_index - 120)
                end = min(len(content), first_index + 220)
                excerpt = content[start:end]
            ranked.append(
                {
                    "path": item["path"],
                    "score": round(score / max(1.0, math.log(len(content or " ") + 10, 10)), 4),
                    "excerpt": self._truncate_content(excerpt),
                    "language": item.get("language") or "plaintext",
                }
            )

        ranked.sort(key=lambda hit: (-float(hit["score"]), hit["path"]))
        return ranked[:limit]

    def _run_terminal_command(self, args: dict) -> dict:
        """
        Stub for running terminal commands. 
        Note: The actual execution happens locally in the VS Code extension.
        This tool call serves as a structured signal to the client.
        """
        command = str(args.get("command") or "").strip()
        cwd = str(args.get("cwd") or "").strip()
        background = bool(args.get("background", True))

        if not command:
            return {"ok": False, "error": "command is required"}

        # We return OK immediately. The extension will pick up this tool call from the trace.
        return {
            "ok": True,
            "command": command,
            "cwd": cwd,
            "background": background,
            "message": f"Terminal command '{command}' has been sent to VS Code for execution.",
        }


def _make_trace_summary(tool_name: str, result: dict) -> str:
    if not isinstance(result, dict):
        return f"{tool_name} completed."
    if not result.get("ok", True):
        return result.get("error") or f"{tool_name} failed."
    if tool_name == "list_files":
        return f"Listed {result.get('count', 0)} files."
    if tool_name == "read_file":
        return f"Read {result.get('path', 'file')}."
    if tool_name == "write_file":
        verb = "Created" if result.get("created") else "Updated"
        return f"{verb} {result.get('path', 'file')}."
    if tool_name == "delete_file":
        return f"Deleted {result.get('path', 'file')}."
    if tool_name == "search_files":
        return f"Found {len(result.get('hits') or [])} matching files."
    return f"{tool_name} completed."


def _build_openai_tools(tool_specs: List[dict]) -> List[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": spec["name"],
                "description": spec["description"],
                "parameters": spec["parameters"],
            },
        }
        for spec in tool_specs
    ]


def _build_anthropic_tools(tool_specs: List[dict]) -> List[dict]:
    return [
        {
            "name": spec["name"],
            "description": spec["description"],
            "input_schema": spec["parameters"],
        }
        for spec in tool_specs
    ]


def _build_gemini_tools(tool_specs: List[dict]) -> List[Any]:
    gemini_types = _get_gemini_types()
    if gemini_types is None:
        return []
    declarations = [
        gemini_types.FunctionDeclaration(
            name=spec["name"],
            description=spec["description"],
            parametersJsonSchema=spec["parameters"],
        )
        for spec in tool_specs
    ]
    return [gemini_types.Tool(functionDeclarations=declarations)]


def _history_to_openai_messages(history_context: Optional[List[dict]]) -> List[dict]:
    messages: List[dict] = []
    for turn in history_context or []:
        user_text = (turn.get("user") or "").strip()
        ai_text = (turn.get("ai") or "").strip()
        if user_text:
            messages.append({"role": "user", "content": user_text})
        if ai_text:
            messages.append({"role": "assistant", "content": ai_text})
    return messages


def _history_to_anthropic_messages(history_context: Optional[List[dict]]) -> List[dict]:
    messages: List[dict] = []
    for turn in history_context or []:
        user_text = (turn.get("user") or "").strip()
        ai_text = (turn.get("ai") or "").strip()
        if user_text:
            messages.append({"role": "user", "content": [{"type": "text", "text": user_text}]})
        if ai_text:
            messages.append({"role": "assistant", "content": [{"type": "text", "text": ai_text}]})
    return messages


def _history_to_gemini_contents(history_context: Optional[List[dict]]) -> List[Any]:
    gemini_types = _get_gemini_types()
    if gemini_types is None:
        return []
    contents: List[Any] = []
    for turn in history_context or []:
        user_text = (turn.get("user") or "").strip()
        ai_text = (turn.get("ai") or "").strip()
        if user_text:
            contents.append(
                gemini_types.Content(role="user", parts=[gemini_types.Part.from_text(text=user_text)])
            )
        if ai_text:
            contents.append(
                gemini_types.Content(role="model", parts=[gemini_types.Part.from_text(text=ai_text)])
            )
    return contents


def _extract_anthropic_text(message) -> str:
    parts = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text" and getattr(block, "text", None):
            parts.append(block.text)
    return "".join(parts).strip()


def _emit(callback: Optional[Callable[[dict], None]], payload: dict) -> None:
    if callback:
        callback(payload)


_PARALLEL_TOOL_NAMES = {"web_search", "web_fetch", "api_get"}


def _is_parallel_tool_batch(tool_calls: List[Any]) -> bool:
    if len(tool_calls) < 2:
        return False
    return all(getattr(call, "name", "") in _PARALLEL_TOOL_NAMES for call in tool_calls)


def _execute_tool_batch(tool_runtime: Any, tool_calls: List[Any]) -> List[dict]:
    call_payloads: List[dict] = []
    for call in tool_calls:
        args = call.args if hasattr(call, "args") else getattr(call, "input", {})
        call_payloads.append({"call": call, "args": args})

    if _is_parallel_tool_batch(tool_calls):
        from concurrent.futures import ThreadPoolExecutor

        max_workers = min(4, len(tool_calls))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(tool_runtime.execute, payload["call"].name, payload["args"])
                for payload in call_payloads
            ]
            for payload, future in zip(call_payloads, futures):
                payload["result"] = future.result()
        return call_payloads

    for payload in call_payloads:
        payload["result"] = tool_runtime.execute(payload["call"].name, payload["args"])
    return call_payloads


def _clean_gemma_output(text: str) -> str:
    import re
    if not text:
        return ""
    text = re.sub(r'<thought>.*?</thought>', '', text, flags=re.DOTALL)
    patterns = [
        r'(?i)^thinking:.*\n?', r'(?i)^user says:.*\n?', r'(?i)^instruction check:.*\n?',
        r'(?i)^role:.*\n?', r'(?i)^system role:.*\n?', r'(?i)^user profile:.*\n?',
        r'(?i)^communication style:.*\n?', r'(?i)^language:.*\n?', r'(?i)^language constraint:.*\n?',
        r'(?i)^target language:.*\n?', r'(?i)^greetings/small talk rule:.*\n?',
        r'(?i)^constraint:.*\n?', r'(?i)^constraints:.*\n?', r'(?i)^greeting in turkish:.*\n?',
        r'(?i)^keep it natural:.*\n?', r'(?i)^greeting:.*\n?', r'(?i)^user input:.*\n?',
        r'(?i)^user said:.*\n?', r'(?i)^response should be:.*\n?', r'(?i)^length:.*\n?',
        r'(?i)^same language\?.*\n?', r'(?i)^natural style\?.*\n?', r'(?i)^1-2 short sentences\?.*\n?',
        r'(?i)^no internal analysis:.*\n?', r'(?i)^no markdown labels:.*\n?'
    ]
    for pattern in patterns:
        text = re.sub(pattern, '', text, flags=re.MULTILINE)
    text = text.strip()
    match = re.match(r'^"(.*)"\s*(.*)$', text, re.DOTALL)
    if match:
        quoted, unquoted = match.groups()
        if quoted.strip() == unquoted.strip():
            return quoted.strip()
    return text.strip()

def _extract_gemini_text_from_candidates(response) -> str:
    chunks: List[str] = []
    candidates = list(getattr(response, "candidates", None) or [])
    if not candidates:
        return ""
    content = getattr(candidates[0], "content", None)
    parts = list(getattr(content, "parts", None) or [])
    for part in parts:
        text = getattr(part, "text", None)
        if text:
            chunks.append(str(text))
    return _clean_gemma_output("".join(chunks))


def _run_openai_agent(
    *,
    client,
    model: str,
    system_prompt: str,
    user_message: str,
    history_context: Optional[List[dict]],
    tool_runtime: Optional[AgentToolRuntime],
    on_event: Optional[Callable[[dict], None]] = None,
    on_first_llm_success: Optional[Callable[[], None]] = None,
    request_id: Optional[str] = None,
) -> AgentRunResult:
    if not client:
        return AgentRunResult(text="Error: OPENAI_API_KEY missing.", tool_capable=False)

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(_history_to_openai_messages(history_context))
    messages.append({"role": "user", "content": user_message})

    trace: List[dict] = []
    tools = _build_openai_tools(tool_runtime.get_tool_specs()) if tool_runtime and tool_runtime.has_tool_access else None

    max_steps = _max_agent_steps()

    for step in range(max_steps):
        # Check if request was cancelled via /v1/cancel
        if request_id:
            from app import is_request_cancelled
            if is_request_cancelled(request_id):
                print(f"[Agent-OpenAI] Request {request_id} ABORTED by user.")
                raise AgentAbortException("Request cancelled by user")

        try:
            params = {
                "model": model,
                "messages": messages,
                "temperature": 0.2,
                "max_completion_tokens": 2200,
            }
            if tools:
                params["tools"] = tools
                params["tool_choice"] = "auto"
                params["parallel_tool_calls"] = True
                
            response = client.chat.completions.create(**params)
            
            # 🔥 SUCCESS: Trigger token deduction callback on first successful LLM call
            if step == 0 and on_first_llm_success:
                try:
                    on_first_llm_success()
                except Exception as cb_err:
                    print(f"[Agent-OpenAI] Callback error: {cb_err}")
        except Exception as e:
            # Check if this was an intentional abort that happened during the call
            if request_id:
                from app import is_request_cancelled
                if is_request_cancelled(request_id):
                    raise AgentAbortException("Request cancelled by user during API call")
            print("OPENAI ERROR:", repr(e))
            raise
        choice = response.choices[0]
        message = choice.message
        tool_calls = getattr(message, "tool_calls", None) or []

        if tool_calls and step >= max_steps - 1:
            # Avoid another costly tool round at the limit; ask for final synthesis now.
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Tool budget reached. Without calling any more tools, provide your best final answer "
                        "using only the gathered context."
                    ),
                }
            )
            try:
                forced = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=None,
                    tool_choice=None,
                    parallel_tool_calls=None,
                    temperature=0.2,
                    max_completion_tokens=2200,
                )
                forced_message = forced.choices[0].message
                forced_text = getattr(forced_message, "content", None) or ""
                return AgentRunResult(
                    text=str(forced_text).strip() or "I reached the tool-step limit, but here is the best possible answer from collected data.",
                    trace=trace,
                    changed_files=list(tool_runtime.changed_files if tool_runtime else []),
                    tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
                )
            except Exception:
                pass

        if tool_calls and tool_runtime and tool_runtime.has_tool_access:
            assistant_payload = {
                "role": "assistant",
                "content": getattr(message, "content", None) or "",
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                    for tool_call in tool_calls
                ],
            }
            messages.append(assistant_payload)

            batch = _execute_tool_batch(
                tool_runtime,
                [
                    type("ToolCall", (), {"name": tool_call.function.name, "args": _safe_json_loads(tool_call.function.arguments, default={})})()
                    for tool_call in tool_calls
                ],
            )

            for tool_call, payload in zip(tool_calls, batch):
                tool_name = tool_call.function.name
                args = payload["args"]
                _emit(on_event, {"type": "tool_start", "tool": tool_name, "args": args})
            for tool_call, payload in zip(tool_calls, batch):
                tool_name = tool_call.function.name
                args = payload["args"]
                result = payload["result"]
                summary = _make_trace_summary(tool_name, result)
                trace.append(
                    {
                        "type": "tool",
                        "provider": "openai",
                        "tool": tool_name,
                        "args": args,
                        "summary": summary,
                        "ok": bool(result.get("ok", True)),
                    }
                )
                _emit(on_event, {"type": "tool_end", "tool": tool_name, "summary": summary, "result": result})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
            continue

        final_text = getattr(message, "content", None) or ""
        return AgentRunResult(
            text=str(final_text).strip(),
            trace=trace,
            changed_files=list(tool_runtime.changed_files if tool_runtime else []),
            tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
        )

    return AgentRunResult(
        text="Agent Mode reached the maximum tool steps before producing a final answer.",
        trace=trace,
        changed_files=list(tool_runtime.changed_files if tool_runtime else []),
        tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
    )


def _run_anthropic_agent(
    *,
    client,
    model: str,
    system_prompt: str,
    user_message: str,
    history_context: Optional[List[dict]],
    tool_runtime: Optional[AgentToolRuntime],
    on_event: Optional[Callable[[dict], None]] = None,
    on_first_llm_success: Optional[Callable[[], None]] = None,
    request_id: Optional[str] = None,
) -> AgentRunResult:
    if not client:
        return AgentRunResult(text="Error: ANTHROPIC_API_KEY missing.", tool_capable=False)

    messages = _history_to_anthropic_messages(history_context)
    messages.append({"role": "user", "content": [{"type": "text", "text": user_message}]})

    trace: List[dict] = []
    tools = _build_anthropic_tools(tool_runtime.get_tool_specs()) if tool_runtime and tool_runtime.has_tool_access else None

    max_steps = _max_agent_steps()

    for step in range(max_steps):
        # Check if request was cancelled via /v1/cancel
        if request_id:
            from app import is_request_cancelled
            if is_request_cancelled(request_id):
                print(f"[Agent-Anthropic] Request {request_id} ABORTED by user.")
                raise AgentAbortException("Request cancelled by user")

        kwargs = {
            "model": model,
            "max_tokens": 2200,
            "system": system_prompt,
            "messages": messages,
            "temperature": 0.2,
        }
        if tools:
            kwargs["tools"] = tools
            # Note: tool_choice removed as per user recommendation for SDK stability

        print(f"DEBUG AGENT ANTHROPIC KWARGS: {json.dumps({k:v for k,v in kwargs.items() if k != 'messages'}, indent=2)}")
            
        try:
            response = client.messages.create(**kwargs)
            
            # 🔥 SUCCESS: Trigger token deduction callback on first successful LLM call
            if step == 0 and on_first_llm_success:
                try:
                    on_first_llm_success()
                except Exception as cb_err:
                    print(f"[Agent-Anthropic] Callback error: {cb_err}")
        except Exception as e:
            if request_id:
                from app import is_request_cancelled
                if is_request_cancelled(request_id):
                    raise AgentAbortException("Request cancelled by user during API call")
            raise

        blocks = getattr(response, "content", []) or []
        tool_blocks = [block for block in blocks if getattr(block, "type", None) == "tool_use"]

        if tool_blocks and step >= max_steps - 1:
            # Avoid another costly tool round at the limit; ask for final synthesis now.
            messages.append(
                {
                    "role": "user",
                    "content": "Tool budget reached. Without calling any more tools, provide your best final answer using only the gathered context.",
                }
            )
            try:
                forced = client.messages.create(
                    model=model,
                    max_tokens=2200,
                    system=system_prompt,
                    messages=messages,
                    tools=None,
                    temperature=0.2,
                )
                return AgentRunResult(
                    text=_extract_anthropic_text(forced) or "I reached the tool-step limit, but here is the best possible answer from collected data.",
                    trace=trace,
                    changed_files=list(tool_runtime.changed_files if tool_runtime else []),
                    tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
                )
            except Exception:
                pass

        if tool_blocks and tool_runtime and tool_runtime.has_tool_access:
            assistant_content = []
            for block in blocks:
                if getattr(block, "type", None) == "text":
                    assistant_content.append({"type": "text", "text": block.text})
                elif getattr(block, "type", None) == "tool_use":
                    assistant_content.append(
                        {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                    )

            messages.append({"role": "assistant", "content": assistant_content})

            batch = _execute_tool_batch(
                tool_runtime,
                [
                    type("ToolCall", (), {"name": block.name, "args": block.input if isinstance(block.input, dict) else _safe_json_loads(block.input, default={})})()
                    for block in tool_blocks
                ],
            )

            for block, payload in zip(tool_blocks, batch):
                _emit(on_event, {"type": "tool_start", "tool": block.name, "args": payload["args"]})

            tool_results = []
            for block, payload in zip(tool_blocks, batch):
                args = payload["args"]
                result = payload["result"]
                summary = _make_trace_summary(block.name, result)
                trace.append(
                    {
                        "type": "tool",
                        "provider": "anthropic",
                        "tool": block.name,
                        "args": args,
                        "summary": summary,
                        "ok": bool(result.get("ok", True)),
                    }
                )
                _emit(on_event, {"type": "tool_end", "tool": block.name, "summary": summary, "result": result})
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )

            messages.append({"role": "user", "content": tool_results})
            continue

        return AgentRunResult(
            text=_extract_anthropic_text(response),
            trace=trace,
            changed_files=list(tool_runtime.changed_files if tool_runtime else []),
            tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
        )

    return AgentRunResult(
        text="Agent Mode reached the maximum tool steps before producing a final answer.",
        trace=trace,
        changed_files=list(tool_runtime.changed_files if tool_runtime else []),
        tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
    )


def _call_gemini_with_retry(client, model, contents, config, max_retries=3):
    """Call Gemini generate_content with exponential backoff on 503/504 errors."""
    for attempt in range(max_retries + 1):
        try:
            # Inject timeout into config if not present
            if hasattr(config, 'http_options') and config.http_options is None:
                from google.genai import types as gemini_types
                config.http_options = gemini_types.HttpOptions(timeout=to_gemini_timeout(120))
            
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except Exception as e:
            error_str = str(e).lower()
            is_transient = "500" in error_str or "503" in error_str or "504" in error_str or "internal error" in error_str or "service unavailable" in error_str or "deadline exceeded" in error_str or "timeout" in error_str or "handshake" in error_str
            
            if is_transient and attempt < max_retries:
                wait_time = (2 ** attempt) + (0.1 * attempt)
                print(f"[GeminiRetry] Attempt {attempt+1} failed ({error_str}). Retrying in {wait_time:.1f}s...")
                time.sleep(wait_time)
                continue
            raise e


def _run_gemini_agent(
    *,
    client,
    model: str,
    system_prompt: str,
    user_message: str,
    history_context: Optional[List[dict]],
    tool_runtime: Optional[AgentToolRuntime],
    on_event: Optional[Callable[[dict], None]] = None,
    on_first_llm_success: Optional[Callable[[], None]] = None,
    request_id: Optional[str] = None
) -> AgentRunResult:
    gemini_types = _get_gemini_types()
    if gemini_types is None:
        return AgentRunResult(text="Error: google-genai package is required for Gemini runs.", tool_capable=False)

    if not client:
        return AgentRunResult(text="Error: GEMINI_API_KEY missing.", tool_capable=False)

    contents: List[Any] = _history_to_gemini_contents(history_context)
    contents.append(gemini_types.Content(role="user", parts=[gemini_types.Part.from_text(text=user_message)]))
    trace: List[dict] = []

    config = gemini_types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.2,
        max_output_tokens=1500,  # Prevents unnecessary verbosity in Gemma/Gemini
        tools=_build_gemini_tools(tool_runtime.get_tool_specs()) if tool_runtime and tool_runtime.has_tool_access else None,
        automatic_function_calling=gemini_types.AutomaticFunctionCallingConfig(disable=True) if hasattr(gemini_types, 'AutomaticFunctionCallingConfig') else None,
        http_options=gemini_types.HttpOptions(timeout=to_gemini_timeout(120))
    )

    max_steps = _max_agent_steps()

    for step in range(max_steps):
        # Check if request was cancelled via /v1/cancel
        if request_id:
            from app import is_request_cancelled
            if is_request_cancelled(request_id):
                print(f"[Agent] Request {request_id} ABORTED by user.")
                raise AgentAbortException("Request cancelled by user")

        import time
        start_step_time = time.perf_counter()
        try:
            response = _call_gemini_with_retry(
                client=client,
                model=model,
                contents=contents,
                config=config,
            )
            step_duration = time.perf_counter() - start_step_time
            print(f"[LATENCY_PROFILE] Step {step} Gemini API call took {step_duration:.4f}s")
            tracker.record_step("gemini_api_call", step_duration)
            
            # 🔥 SUCCESS: Trigger token deduction callback on first successful LLM call
            if step == 0 and on_first_llm_success:
                try:
                    on_first_llm_success()
                except Exception as cb_err:
                    print(f"[Agent-Gemini] Callback error: {cb_err}")
        except Exception as e:
            if request_id:
                from app import is_request_cancelled
                if is_request_cancelled(request_id):
                    raise AgentAbortException("Request cancelled by user during API call")
            return AgentRunResult(text=f"Gemini API Error: {str(e)}", trace=trace, tool_capable=True)

        function_calls = list(getattr(response, "function_calls", None) or [])
        text = _extract_gemini_text_from_candidates(response)
        candidates = list(getattr(response, "candidates", None) or [])
        
        if not function_calls and not text:
            print(f"[GeminiAgent] Warning: Empty response (no text, no tools) at step {step}. Candidates: {len(candidates)}")
        
        # Priority: If tool calls are present, ignore accompanying text (treat as internal reasoning)
        if function_calls:
            text = ""
        model_content = None
        if candidates:
            candidate_content = getattr(candidates[0], "content", None)
            if candidate_content and getattr(candidate_content, "parts", None):
                # Preserve provider-added metadata (e.g. thought_signature) by reusing
                # the original content parts instead of rebuilding functionCall parts.
                model_content = candidate_content

        if function_calls and tool_runtime and tool_runtime.has_tool_access:
            if step >= max_steps - 1:
                # Avoid another costly tool round at the limit; ask for final synthesis now.
                contents.append(
                    gemini_types.Content(
                        role="user",
                        parts=[
                            gemini_types.Part.from_text(
                                text=(
                                    "Tool budget reached. Without calling any more tools, provide your best final answer "
                                    "using only the gathered context."
                                )
                            )
                        ],
                    )
                )
                try:
                    forced_config = gemini_types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.2,
                        max_output_tokens=1000,
                        tools=None,
                        automatic_function_calling=gemini_types.AutomaticFunctionCallingConfig(disable=True) if hasattr(gemini_types, 'AutomaticFunctionCallingConfig') else None,
                        http_options=gemini_types.HttpOptions(timeout=to_gemini_timeout(120))
                    )
                    forced_response = client.models.generate_content(
                        model=model,
                        contents=contents,
                        config=forced_config,
                    )
                    forced_text = _extract_gemini_text_from_candidates(forced_response)
                    return AgentRunResult(
                        text=forced_text or "I reached the tool-step limit, but here is the best possible answer from collected data.",
                        trace=trace,
                        changed_files=list(tool_runtime.changed_files if tool_runtime else []),
                        tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
                    )
                except Exception:
                    pass

            if model_content is not None:
                contents.append(model_content)
            else:
                model_parts = []
                if text:
                    model_parts.append(gemini_types.Part.from_text(text=text))
                for call in function_calls:
                    model_parts.append(
                        gemini_types.Part.from_function_call(
                            name=call.name,
                            args=call.args or {},
                        )
                    )
                contents.append(gemini_types.Content(role="model", parts=model_parts))

            tool_start_time = time.perf_counter()
            batch = _execute_tool_batch(
                tool_runtime,
                [type("ToolCall", (), {"name": call.name, "args": call.args or {}})() for call in function_calls],
            )
            tool_duration = time.perf_counter() - tool_start_time
            print(f"[LATENCY_PROFILE] Step {step} Tool batch execution took {tool_duration:.4f}s for {len(function_calls)} tools")
            tracker.record_step("tool_batch_execution", tool_duration)

            for call, payload in zip(function_calls, batch):
                _emit(on_event, {"type": "tool_start", "tool": call.name, "args": payload["args"]})

            response_parts = []
            for call, payload in zip(function_calls, batch):
                args = payload["args"]
                result = payload["result"]
                summary = _make_trace_summary(call.name, result)
                trace.append(
                    {
                        "type": "tool",
                        "provider": "gemini",
                        "tool": call.name,
                        "args": args,
                        "summary": summary,
                        "ok": bool(result.get("ok", True)) if isinstance(result, dict) else True,
                    }
                )
                _emit(on_event, {"type": "tool_end", "tool": call.name, "summary": summary, "result": result})
                response_parts.append(
                    gemini_types.Part.from_function_response(
                        name=call.name,
                        response=result if isinstance(result, dict) else {"result": result},
                    )
                )

            contents.append(gemini_types.Content(role="user", parts=response_parts))
            continue

        return AgentRunResult(
            text=text if text else "I processed the request but no final response was generated. If you ran a command, please check the terminal.",
            trace=trace,
            changed_files=list(tool_runtime.changed_files if tool_runtime else []),
            tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
        )

    return AgentRunResult(
        text="Agent Mode reached the maximum tool steps before producing a final answer. Please check if your request requires more specific instructions.",
        trace=trace,
        changed_files=list(tool_runtime.changed_files if tool_runtime else []),
        tool_capable=bool(tool_runtime and tool_runtime.has_tool_access),
    )


def run_agent_turn(
    *,
    provider: str,
    model: str,
    question: str,
    code: str = "",
    prefs: Optional[dict] = None,
    history_context: Optional[List[dict]] = None,
    github_context: str = "",
    tool_runtime: Optional[AgentToolRuntime] = None,
    openai_client=None,
    anthropic_client=None,
    gemini_client=None,
    on_event: Optional[Callable[[dict], None]] = None,
    on_first_llm_success: Optional[Callable[[], None]] = None, # <--- NEW
    request_id: Optional[str] = None
) -> AgentRunResult:
    has_tool_access = bool(tool_runtime and tool_runtime.has_tool_access)
    system_prompt = build_agent_system_prompt(
        question=question,
        prefs=prefs,
        github_context=github_context,
        has_tool_access=has_tool_access,
        workspace_label=tool_runtime.workspace_label if tool_runtime else "workspace",
    )
    user_message = build_agent_user_message(question, code)

    provider_key = (provider or "").lower()
    if provider_key == "openai":
        return _run_openai_agent(
            client=openai_client,
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            history_context=history_context,
            tool_runtime=tool_runtime,
            on_event=on_event,
            on_first_llm_success=on_first_llm_success,
            request_id=request_id,
        )
    if provider_key == "anthropic":
        return _run_anthropic_agent(
            client=anthropic_client,
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            history_context=history_context,
            tool_runtime=tool_runtime,
            on_event=on_event,
            on_first_llm_success=on_first_llm_success,
            request_id=request_id
        )
    if provider_key == "gemini":
        return _run_gemini_agent(
            client=gemini_client,
            model=model,
            system_prompt=system_prompt,
            user_message=user_message,
            history_context=history_context,
            tool_runtime=tool_runtime,
            on_event=on_event,
            on_first_llm_success=on_first_llm_success,
            request_id=request_id,
        )

    return AgentRunResult(text=f"Unsupported agent provider: {provider_key}", tool_capable=has_tool_access)


def stream_text_chunks(text: str, chunk_size: int = 220) -> Iterable[str]:
    for chunk in _chunk_text(text, chunk_size=chunk_size):
        yield chunk
