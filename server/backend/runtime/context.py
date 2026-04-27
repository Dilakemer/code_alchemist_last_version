"""
ContextAssembler — builds an AgentContextWithState from request data.

Called once per request before the agent loop starts. Responsibilities:
  1. Resolve conversation history from DB (or accept pre-assembled override)
  2. Build RAG / project context via embedding search
  3. Load memory capsule for the user
  4. Validate and normalise workspace files
  5. Construct the system prompt

AgentContextWithState
  A plain class (NOT a dataclass) that carries all per-run state.
  Using a plain class avoids dataclass inheritance pitfalls (shared mutable
  defaults, field-ordering errors) while keeping the interface simple.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Dict, List, Optional


def _build_language_hint(question: str, prefs: Optional[Dict]) -> str:
    language = (prefs or {}).get("preferred_language")
    if language:
        return f"Always respond in {language} unless the user explicitly asks otherwise."
    turkish = re.search(r"[çğışöüÇĞİŞÖÜ]", question or "")
    if turkish:
        return "Respond in Turkish unless the user explicitly asks for another language."
    return "Respond in the same language as the user's latest message."


def _build_system_prompt(
    question: str,
    prefs: Optional[Dict],
    has_tools: bool,
    workspace_label: str,
    rag_context: str,
    memory_context: str,
) -> str:
    """Build the agent system prompt from all available context."""
    persona_info = ""
    if prefs:
        persona    = prefs.get("persona", "Developer")
        expertise  = prefs.get("expertise", "Intermediate")
        interests  = ", ".join(prefs.get("interests") or [])
        persona_info = f"User profile: {persona} (expertise: {expertise}). "
        if interests:
            persona_info += f"Interests: {interests}. "

    tool_guidance = (
        f"You are operating in Agent Mode with full tool access to the active {workspace_label}. "
        "Use tools whenever you need to inspect, search, create, update, or delete files. "
        "Always read a file before modifying it. Keep edits minimal and safe. "
        "When you change files, summarise what changed and name the affected paths. "
        "Prefer 1-2 searches before fetching pages. Avoid redundant queries. "
        "When search results expose recommended_fetch_urls, fetch only the top 2 distinct trusted domains first. "
        "For time-sensitive factual questions about external services, run at least two independent web searches "
        "before giving a final answer, and clearly state uncertainty when evidence is weak. "
        "Batch independent search or fetch calls in one turn when they do not depend on each other."
        if has_tools
        else (
            "Agent Mode is enabled, but no writable project or workspace is currently active in this session. "
            "If the user asks about project files or structure, explain that you have no access to their files "
            "until they select/create a project from the sidebar or Project Manager. "
            "You can still answer general programming questions normally."
        )

    )

    blocks: List[str] = []
    if memory_context:
        blocks.append(
            "## Long-term User Memory\n"
            "The following items from past conversations are relevant:\n"
            f"{memory_context}"
        )
    if rag_context:
        blocks.append(
            "## Project / Repository Context\n"
            "The following code excerpts are from the active project:\n"
            f"{rag_context}"
        )

    context_block = ("\n\n" + "\n\n".join(blocks)) if blocks else ""

    return (
        "You are a senior software engineering agent. "
        "Be precise, practical, and collaborative. "
        f"{persona_info}"
        f"{_build_language_hint(question, prefs)} "
        f"{tool_guidance}"
        f"{context_block}"
        "\n\nSen bir AI asistansın. Kullanıcının mesajını aldığında ÖNCE karar ver:\n\n"
        "**AGENT MODUNU KULLAN (tools/steps gerektiğinde):**\n"
        "- Web araması gerektiren sorular\n"
        "- Hesaplama, kod yazma, dosya işleme\n"
        "- Çok adımlı görevler\n"
        "- Gerçek zamanlı veri gerektiren sorular\n\n"
        "**NORMAL YANIT VER (agent modu KULLANMA):**\n"
        "- Selamlama ve sohbet (\"selam\", \"nasılsın\", \"teşekkürler\")\n"
        "- Basit genel bilgi soruları\n"
        "- Evet/hayır soruları\n"
        "- Kısa tanım soruları\n\n"
        "**COMMAND EXECUTION RULES:**\n"
        "- **NEVER** state that you cannot execute code or lack a terminal/runtime environment. You HAVE full execution capabilities through the `run_command` tool. When you output a `run_command` action, the user's VS Code extension will automatically execute it and display the terminal output inside their chat window.\n"
        "- To run a command, use `{\"action\": \"run_command\", \"command\": \"<cmd>\", \"background\": true/false}`. By default, background is `true`.\n"
        "- If the user includes \"Terminal Komutu\" or \"Kodu arka planda değil, VS Code'un entegre terminalini açarak...\", set `background: false` so it shows live in their integrated terminal.\n"
        "- If the user includes \"İnteraktif\" or \"İşlemi başlatmadan önce... benim 'onay veriyorum' dememi bekle\", DO NOT execute the command immediately. Instead, present the command to the user as a normal message and ask for their approval. Only call the tool after they say 'onay veriyorum'.\n\n"
        "Eğer kullanıcı mesajı yukarıdaki \"NORMAL YANIT\" kategorisine giriyorsa,\n"
        "hiçbir tool çağırma, hiçbir adım atmadan DOĞRUDAN yanıt ver.\n\n"
        "**CRITICAL:** Never output internal analysis, background thinking, or reasoning steps like <thought>, Thinking:, etc. "
        "Provide ONLY the final response."
    ).strip()


def _normalise_workspace_files(
    raw: List[Dict[str, Any]],
    max_files: int = 80,
    max_chars: int = 18_000,
) -> Dict[str, Dict[str, Any]]:
    """
    Convert client-supplied workspace file list to an internal dict.

    Returns: { path: {path, content, language} }
    """
    result: Dict[str, Dict[str, Any]] = {}
    for item in (raw or [])[:max_files]:
        if not isinstance(item, dict):
            continue
        path = str(item.get("path") or item.get("name") or "").strip()
        if not path:
            continue
        content  = str(item.get("content") or item.get("text") or "")[:max_chars]
        language = str(item.get("language") or item.get("lang") or "plaintext")
        result[path] = {"path": path, "content": content, "language": language}
    return result


# ── AgentContextWithState ─────────────────────────────────────────────────────

class AgentContextWithState:
    """
    Mutable per-run context object.

    Uses a plain class (not a dataclass) so that:
    - Tools can safely append to `changed_files` at the instance level
    - `invalidate_project_cache` can be set post-construction
    - No dataclass inheritance pitfalls apply
    """

    __slots__ = (
        "run_id", "user_id", "conversation_id", "project_id",
        "question", "code",
        "provider", "model",
        "system_prompt", "history_messages",
        "rag_context", "memory_context",
        "workspace_files", "project", "search_project_callback",
        "db_read_callback",
        "max_tool_calls", "max_tokens", "temperature",
        "max_files_touched", "max_reads_per_file", "min_token_reserve",
        "allow_write_tools",
        "user_prefs", "stream",
        # Mutable run-state
        "changed_files", "pending_confirmations", "invalidate_project_cache",
        "read_cache",
    )

    def __init__(
        self,
        *,
        run_id: str,
        user_id: Optional[int],
        conversation_id: Optional[int],
        project_id: Optional[int],
        question: str,
        code: str,
        provider: str,
        model: str,
        system_prompt: str,
        history_messages: List[Dict[str, Any]],
        rag_context: str,
        memory_context: str,
        workspace_files: Dict[str, Dict[str, Any]],
        project: Any,
        search_project_callback: Any,
        db_read_callback: Any,
        max_tool_calls: int,
        max_tokens: int,
        temperature: float,
        max_files_touched: int,
        max_reads_per_file: int,
        min_token_reserve: int,
        allow_write_tools: bool,
        user_prefs: Dict[str, Any],
        stream: bool,
        invalidate_project_cache: Any = None,
    ) -> None:
        self.run_id              = run_id
        self.user_id             = user_id
        self.conversation_id     = conversation_id
        self.project_id          = project_id
        self.question            = question
        self.code                = code
        self.provider            = provider
        self.model               = model
        self.system_prompt       = system_prompt
        self.history_messages    = list(history_messages)
        self.rag_context         = rag_context
        self.memory_context      = memory_context
        self.workspace_files     = dict(workspace_files)  # instance copy
        self.project             = project
        self.search_project_callback = search_project_callback
        self.db_read_callback    = db_read_callback
        self.max_tool_calls      = max_tool_calls
        self.max_tokens          = max_tokens
        self.temperature         = temperature
        self.max_files_touched   = max_files_touched
        self.max_reads_per_file  = max_reads_per_file
        self.min_token_reserve   = min_token_reserve
        self.allow_write_tools   = bool(allow_write_tools)
        self.user_prefs          = dict(user_prefs)
        self.stream              = stream
        # Mutable run-state (safe per-instance lists / callables)
        self.changed_files: List[Dict[str, Any]] = []
        self.pending_confirmations: List[Dict[str, Any]] = []
        self.invalidate_project_cache = invalidate_project_cache
        self.read_cache: Dict[str, Dict[str, Any]] = {}


# ── ContextAssembler ──────────────────────────────────────────────────────────

class ContextAssembler:
    """
    Builds a fully populated AgentContextWithState for a single agent run.

    All DB-bound callbacks are accepted as constructor arguments so the
    assembler can be unit-tested with no database.
    """

    def __init__(
        self,
        get_history_fn: Optional[Callable] = None,
        get_project_rag_fn: Optional[Callable] = None,
        get_memory_fn: Optional[Callable] = None,
    ) -> None:
        self._get_history     = get_history_fn
        self._get_project_rag = get_project_rag_fn
        self._get_memory      = get_memory_fn

    async def assemble(
        self,
        *,
        run_id: str,
        user_id: Optional[int],
        conversation_id: Optional[int],
        project_id: Optional[int],
        question: str,
        code: str,
        provider: str,
        model: str,
        workspace_files_raw: List[Dict[str, Any]],
        project: Any,
        search_project_callback: Optional[Callable],
        db_read_callback: Optional[Callable],
        invalidate_project_cache: Optional[Callable],
        include_history: bool,
        max_tool_calls: int,
        max_tokens: int,
        temperature: float,
        max_files_touched: int,
        max_reads_per_file: int,
        min_token_reserve: int,
        allow_write_tools: bool,
        user_prefs: Dict[str, Any],
        stream: bool,
        rag_context_override: str = "",
        memory_context_override: str = "",
        # Bridge can supply pre-assembled history to skip DB lookup
        pre_assembled_history: Optional[List[Dict[str, Any]]] = None,
    ) -> AgentContextWithState:
        import asyncio
        loop = asyncio.get_event_loop()

        # ── 1. Conversation history ───────────────────────────────────────
        history_messages: List[Dict[str, Any]] = []

        if pre_assembled_history is not None:
            # Bridge supplies history directly (no DB lookup needed)
            history_messages = list(pre_assembled_history)
        elif include_history and conversation_id and self._get_history:
            try:
                raw_history = await loop.run_in_executor(
                    None,
                    lambda: self._get_history(conversation_id),
                )
                for turn in (raw_history or []):
                    u = (turn.get("user") or "").strip()
                    a = (turn.get("ai") or "").strip()
                    if u:
                        history_messages.append({"role": "user",      "content": u})
                    if a:
                        history_messages.append({"role": "assistant", "content": a})
            except Exception:
                pass

        # ── 2. RAG / project context ──────────────────────────────────────
        rag_context = rag_context_override
        if not rag_context and project and self._get_project_rag:
            try:
                rag_context = await loop.run_in_executor(
                    None,
                    lambda: self._get_project_rag(project, question) or "",
                )
            except Exception:
                pass

        # ── 3. Memory capsule ─────────────────────────────────────────────
        memory_context = memory_context_override
        if not memory_context and user_id and self._get_memory:
            try:
                memory_context = await loop.run_in_executor(
                    None,
                    lambda: self._get_memory(user_id, question) or "",
                )
            except Exception:
                pass

        # ── 4. Workspace files ────────────────────────────────────────────
        workspace_files = _normalise_workspace_files(workspace_files_raw)

        # ── 5. Tool / workspace label ─────────────────────────────────────
        has_tools = bool(project or workspace_files)
        workspace_label = (
            f"project '{project.name}'" if project else
            "workspace snapshot"         if workspace_files else
            "conversation"
        )

        # ── 6. System prompt ──────────────────────────────────────────────
        system_prompt = _build_system_prompt(
            question=question,
            prefs=user_prefs,
            has_tools=has_tools,
            workspace_label=workspace_label,
            rag_context=rag_context,
            memory_context=memory_context,
        )

        return AgentContextWithState(
            run_id=run_id,
            user_id=user_id,
            conversation_id=conversation_id,
            project_id=project_id,
            question=question,
            code=code,
            provider=provider,
            model=model,
            system_prompt=system_prompt,
            history_messages=history_messages,
            rag_context=rag_context,
            memory_context=memory_context,
            workspace_files=workspace_files,
            project=project,
            search_project_callback=search_project_callback,
            db_read_callback=db_read_callback,
            max_tool_calls=max_tool_calls,
            max_tokens=max_tokens,
            temperature=temperature,
            max_files_touched=max_files_touched,
            max_reads_per_file=max_reads_per_file,
            min_token_reserve=min_token_reserve,
            allow_write_tools=allow_write_tools,
            user_prefs=user_prefs,
            stream=stream,
            invalidate_project_cache=invalidate_project_cache,
        )
