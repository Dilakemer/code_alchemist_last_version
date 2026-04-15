"""
FastAPI application factory.

Creates the FastAPI app that:
  1. Runs the new Agent Mode system on /agent/* routes
  2. Forwards all other requests to the existing Flask WSGI app
     (mounted as an ASGI sub-app via asgiref.wsgi.WsgiToAsgi)

Start command (development):
    uvicorn backend.app_factory:create_app --factory --reload --port 5001

Start command (production / Render):
    uvicorn backend.app_factory:create_app --factory --host 0.0.0.0 --port $PORT --workers 2
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.agent_router import router as agent_router
from .runtime.core import AgentRuntime
from .tools.registry import create_default_registry


# ── Runtime singleton ──────────────────────────────────────────────────────────

_runtime: Optional[AgentRuntime] = None


def _get_or_create_runtime() -> AgentRuntime:
    """
    Lazily initialise the AgentRuntime singleton.

    Callbacks are wired to the existing Flask app's helpers so that the
    new runtime can share the DB session and embedding cache without
    duplicating logic.
    """
    global _runtime
    if _runtime is not None:
        return _runtime

    # Try to import Flask app helpers (may fail in standalone test mode)
    get_history_fn    = None
    get_project_rag   = None
    get_memory_fn     = None

    try:
        import sys
        import os
        # Ensure the server directory is on sys.path
        server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if server_dir not in sys.path:
            sys.path.insert(0, server_dir)

        from app import app as flask_app  # noqa: F401 — triggers DB init

        # History retrieval
        def _get_history(conversation_id: int):
            from models import History
            items = (
                History.query.filter_by(conversation_id=conversation_id)
                .order_by(History.timestamp.desc())
                .limit(5)
                .all()
            )
            items.reverse()
            return [{"user": h.user_question, "ai": h.ai_response} for h in items]

        get_history_fn = _get_history

        # Project RAG
        from app import build_project_context_for_question
        get_project_rag = build_project_context_for_question

        # Memory
        try:
            from utils.memory_utils import build_structured_memory_capsule
            from models import User, db

            def _get_memory(user_id: int, question: str):
                with flask_app.app_context():
                    user = db.session.get(User, user_id)
                    if not user:
                        return ""
                    return build_structured_memory_capsule(user=user, question=question, top_k=5) or ""

            get_memory_fn = _get_memory
        except Exception:
            pass

    except Exception as exc:
        print(f"[backend] Flask app integration skipped: {exc}")

    _runtime = AgentRuntime(
        tool_registry=create_default_registry(),
        get_history_fn=get_history_fn,
        get_project_rag_fn=get_project_rag,
        get_memory_fn=get_memory_fn,
    )
    return _runtime


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise the runtime before serving requests."""
    app.state.agent_runtime = _get_or_create_runtime()
    print(f"[backend] AgentRuntime ready. Providers: {app.state.agent_runtime.available_providers()}")
    print(f"[backend] Registered tools: {[t['name'] for t in app.state.agent_runtime.list_tools()]}")
    yield
    print("[backend] AgentRuntime shutting down.")


# ── App factory ────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    """
    FastAPI application factory.

    Called by Uvicorn via:
        uvicorn backend.app_factory:create_app --factory
    """
    app = FastAPI(
        title="CodeAlchemist Agent API",
        description=(
            "Agent Mode runtime for CodeAlchemist. "
            "Provides multi-model, tool-augmented, SSE-streaming agent runs."
        ),
        version="1.0.0",
        docs_url="/agent/docs",
        redoc_url="/agent/redoc",
        openapi_url="/agent/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Agent router ──────────────────────────────────────────────────────
    app.include_router(agent_router)

    # ── Mount legacy Flask app (optional; requires asgiref) ───────────────
    try:
        from asgiref.wsgi import WsgiToAsgi
        import sys
        server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if server_dir not in sys.path:
            sys.path.insert(0, server_dir)
        from app import app as flask_app
        asgi_flask = WsgiToAsgi(flask_app)
        app.mount("/", asgi_flask)
        print("[backend] Flask app mounted at / via WsgiToAsgi.")
    except ImportError:
        print(
            "[backend] asgiref not installed — Flask mount skipped. "
            "Install asgiref>=3.8.1 to run both apps in one process."
        )
    except Exception as exc:
        print(f"[backend] Flask mount failed: {exc}")

    return app
