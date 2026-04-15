/**
 * Chat View - Generates the HTML/CSS/JS for the Sidebar Chat Webview.
 *
 * Design:
 *  - Premium "CodeAlchemist" aesthetic (dark, violet/indigo accents).
 *  - Real-time message streaming.
 *  - Visual "Agent Trace" timeline.
 *  - Interactive Action Cards (View Diff / Apply).
 */
import * as vscode from 'vscode';

type ChatViewModelOption = {
    value: string;
    label: string;
};

type ChatViewOptions = {
    selectedModel: string;
    modelOptions: ChatViewModelOption[];
};

function escapeForInlineJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function getChatWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, options: ChatViewOptions): string {
  const cspSource = webview.cspSource;
    const inlineStateJson = escapeForInlineJson({
        selectedModel: options.selectedModel,
        modelOptions: options.modelOptions,
    });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource} 'unsafe-inline' https://cdn.jsdelivr.net; font-src ${cspSource}; img-src ${cspSource} https:; script-src-elem ${cspSource} 'unsafe-inline' https://cdn.jsdelivr.net;">
    <style>
        :root {
            --primary: #8b5cf6;
            --primary-glow: rgba(139, 92, 246, 0.4);
            --bg: #0f172a;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border: rgba(255, 255, 255, 0.08);
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --radius-lg: 12px;
            --radius-md: 8px;
        }

        body {
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            background-image: radial-gradient(circle at top right, rgba(139, 92, 246, 0.05), transparent);
        }

        /* ── Header ── */
        .chat-header {
            padding: 14px 18px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(8px);
        }
        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header-title {
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: linear-gradient(to right, #8b5cf6, #d946ef);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 10px var(--primary-glow);
        }
        .reset-btn {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .reset-btn:hover {
            color: var(--text-main);
            background: rgba(255,255,255,0.05);
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .icon-btn {
            background: none;
            border: 1px solid transparent;
            color: var(--text-muted);
            cursor: pointer;
            padding: 5px;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            color: var(--text-main);
            border-color: var(--border);
            background: rgba(255, 255, 255, 0.04);
        }

        .history-drawer {
            position: absolute;
            top: 54px;
            left: 12px;
            right: 12px;
            max-height: 52vh;
            overflow-y: auto;
            z-index: 5;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            box-shadow: 0 12px 26px rgba(0, 0, 0, 0.45);
            display: none;
            flex-direction: column;
        }

        .history-drawer.open {
            display: flex;
        }

        .history-head {
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }

        .history-toolbar {
            padding: 10px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .history-search {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.04);
            color: var(--text-main);
            border-radius: 6px;
            padding: 7px 9px;
            font-family: inherit;
            font-size: 12px;
            outline: none;
        }

        .history-search:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 1px var(--primary-glow);
        }

        .history-list {
            display: flex;
            flex-direction: column;
        }

        .history-item {
            border: none;
            background: transparent;
            color: var(--text-main);
            text-align: left;
            width: 100%;
            padding: 10px 12px;
            cursor: pointer;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            transition: background 0.15s ease;
        }

        .history-item-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
        }

        .history-main {
            flex: 1;
            min-width: 0;
        }

        .history-actions {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: -2px;
        }

        .history-action-btn {
            border: 1px solid transparent;
            background: transparent;
            color: var(--text-muted);
            width: 22px;
            height: 22px;
            border-radius: 5px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
        }

        .history-action-btn:hover {
            color: var(--text-main);
            border-color: var(--border);
            background: rgba(255, 255, 255, 0.06);
        }

        .history-action-btn.pinned {
            color: #fbbf24;
        }

        .history-empty {
            padding: 14px 12px;
            color: var(--text-muted);
            font-size: 12px;
        }

        .history-item:hover {
            background: rgba(255, 255, 255, 0.04);
        }

        .history-item.active {
            background: rgba(139, 92, 246, 0.12);
            outline: 1px solid var(--primary-glow);
            outline-offset: -1px;
        }

        .history-title {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .history-meta {
            font-size: 10.5px;
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
        }

        /* ── Message List ── */
        #chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            scroll-behavior: smooth;
        }

        .message {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-width: 95%;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
            align-self: flex-end;
            align-items: flex-end;
        }
        .message.ai {
            align-self: flex-start;
        }

        .message-bubble {
            padding: 12px 16px;
            border-radius: var(--radius-lg);
            font-size: 13.5px;
            line-height: 1.6;
            word-wrap: break-word;
            position: relative;
        }
        .user .message-bubble {
            background: var(--primary);
            color: white;
            border-bottom-right-radius: 2px;
            box-shadow: 0 4px 12px var(--primary-glow);
        }
        .ai .message-bubble {
            background: var(--card-bg);
            color: var(--text-main);
            border-bottom-left-radius: 2px;
            border: 1px solid var(--border);
            backdrop-filter: blur(12px);
        }

        /* ── Agent Trace ── */
        .trace-container {
            margin-top: 10px;
            padding: 10px;
            background: rgba(0,0,0,0.15);
            border-radius: var(--radius-md);
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-left: 2px solid var(--primary);
        }
        .trace-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 11.5px;
            color: var(--text-muted);
            line-height: 1.4;
        }
        .trace-icon {
            font-size: 14px;
            margin-top: -2px;
        }
        .trace-item.active {
            color: var(--text-main);
        }

        /* ── Action Cards ── */
        .action-card {
            margin-top: 14px;
            background: rgba(139, 92, 246, 0.05);
            border: 1px solid var(--primary-glow);
            border-radius: var(--radius-md);
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .action-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-main);
        }
        .btn {
            padding: 8px 14px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .btn-primary {
            background: var(--primary);
            color: white;
        }
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px var(--primary-glow);
        }

        /* ── Input Area ── */
        .input-area {
            padding: 20px;
            border-top: 1px solid var(--border);
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(8px);
        }
        .input-container {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            padding: 12px;
            transition: border-color 0.2s;
        }
        .input-container:focus-within {
            border-color: var(--primary);
        }

        textarea {
            width: 100%;
            background: transparent;
            color: var(--text-main);
            border: none;
            font-family: inherit;
            font-size: 14px;
            resize: none;
            outline: none;
            box-sizing: border-box;
            min-height: 60px;
        }
        .input-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
        }
        .hint {
            font-size: 11px;
            color: var(--text-muted);
        }

        .model-picker {
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: var(--text-muted);
        }

        .model-picker select {
            flex: 1;
            min-width: 0;
            border: 1px solid var(--border);
            background: var(--vscode-dropdown-background, rgba(255, 255, 255, 0.04));
            color: var(--vscode-dropdown-foreground, var(--text-main));
            border-radius: 6px;
            padding: 6px 8px;
            font-family: inherit;
            font-size: 12px;
            outline: none;
            color-scheme: dark;
        }

        .model-picker select:focus {
            border-color: var(--vscode-focusBorder, var(--primary));
            box-shadow: 0 0 0 1px var(--primary-glow);
        }

        .model-picker select option {
            background: var(--vscode-dropdown-listBackground, var(--vscode-dropdown-background, #1f2937));
            color: var(--vscode-dropdown-foreground, #f1f5f9);
        }

        /* ── Markdown ── */
        .markdown-body pre {
            background: rgba(0,0,0,0.3);
            padding: 12px;
            border-radius: var(--radius-md);
            overflow-x: auto;
            margin: 10px 0;
            border: 1px solid var(--border);
        }
        .markdown-body code {
            font-family: 'Fira Code', var(--vscode-editor-font-family, monospace);
            font-size: 12.5px;
            color: #fca5a5;
            background: rgba(255,255,255,0.05);
            padding: 2px 4px;
            border-radius: 4px;
        }
        .markdown-body p { margin-top: 0; margin-bottom: 8px; }
        .markdown-body p:last-child { margin-bottom: 0; }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="chat-header">
        <div class="header-left">
            <div class="header-dot"></div>
            <div class="header-title">CodeAlchemist</div>
        </div>
        <div class="header-actions">
            <button class="icon-btn" id="history-btn" title="Sohbet Geçmişi">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
            </button>
            <button class="icon-btn" id="new-chat-btn" title="Yeni Sohbet">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </button>
            <button class="reset-btn" id="reset-btn" title="Sohbeti Sıfırla">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
        </div>
    </div>

    <div class="history-drawer" id="history-drawer">
        <div class="history-head">Sohbet Geçmişi</div>
        <div class="history-toolbar">
            <input id="history-search" class="history-search" type="text" placeholder="Geçmişte ara..." />
        </div>
        <div class="history-list" id="history-list"></div>
    </div>

    <div id="chat-container">
    </div>

    <div class="input-area">
        <div class="input-container">
            <textarea id="chat-input" rows="3" placeholder="Sorunuzu sorun veya '/' ile komutları görün..."></textarea>
            <div class="input-footer">
                <div class="hint">Shift + Enter ile alt satıra geçin</div>
                <button class="btn btn-primary" id="send-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Gönder
                </button>
            </div>
            <div class="model-picker">
                <span>Model</span>
                <select id="model-select"></select>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js"></script>
    <script>
        const initialState = ${inlineStateJson};
        const vscode = acquireVsCodeApi();
        let md;
        try {
            md = window.markdownit({
                html: true,
                linkify: true,
                typographer: true
            });
        } catch (e) {
            console.error('Markdown-it failed to load:', e);
            md = { render: (text) => text }; // Fallback to plain text
        }

        const chatContainer = document.getElementById('chat-container');
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const resetBtn = document.getElementById('reset-btn');
        const historyBtn = document.getElementById('history-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const historyDrawer = document.getElementById('history-drawer');
        const historyList = document.getElementById('history-list');
        const historySearch = document.getElementById('history-search');
        const modelSelect = document.getElementById('model-select');

        const MAX_SESSIONS = 30;
        const GREETING = "Merhaba! Ben **CodeAlchemist Agent**. Kodunuzu inceleyebilir, dosya değişiklikleri yapabilir ve projelerinizde size eşlik edebilirim.\\n\\n*Nasıl yardımcı olabilirim?*";

        let currentAiMessageElement = null;
        let currentAiBubble = null;
        let currentTraceContainer = null;
        let currentFullText = "";
        let chatSessions = [];
        let activeSessionId = '';
        let selectedModel = initialState.selectedModel || 'gemini-2.5-flash';
        let historySearchTerm = '';

        function nowIso() {
            return new Date().toISOString();
        }

        function createSession() {
            const id = 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            return {
                id,
                title: 'Yeni Sohbet',
                createdAt: nowIso(),
                updatedAt: nowIso(),
                pinned: false,
                messages: []
            };
        }

        function normalizeSession(raw) {
            return {
                id: typeof raw?.id === 'string' ? raw.id : ('session-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
                title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : 'Yeni Sohbet',
                createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : nowIso(),
                updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : nowIso(),
                pinned: Boolean(raw?.pinned),
                messages: Array.isArray(raw?.messages) ? raw.messages : [],
            };
        }

        function getActiveSession() {
            return chatSessions.find((s) => s.id === activeSessionId) || null;
        }

        function persist() {
            vscode.setState({
                chatSessions,
                activeSessionId,
                selectedModel
            });
        }

        function truncateTitle(text) {
            const clean = (text || '').replace(/\s+/g, ' ').trim();
            if (!clean) return 'Yeni Sohbet';
            return clean.length > 36 ? clean.slice(0, 36) + '…' : clean;
        }

        function formatDate(value) {
            const d = new Date(value);
            return d.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function renderHistory() {
            historyList.innerHTML = '';
            const query = historySearchTerm.trim().toLowerCase();
            const filtered = query
                ? chatSessions.filter((session) => {
                    const title = String(session.title || '').toLowerCase();
                    const text = (Array.isArray(session.messages) ? session.messages : [])
                        .map((m) => String(m.text || '').toLowerCase())
                        .join(' ');
                    return title.includes(query) || text.includes(query);
                })
                : [...chatSessions];

            const sorted = filtered.sort((a, b) => {
                if (Boolean(a.pinned) !== Boolean(b.pinned)) {
                    return a.pinned ? -1 : 1;
                }
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });

            if (sorted.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'history-empty';
                empty.textContent = query ? 'Arama ile eslesen sohbet bulunamadi.' : 'Henuz sohbet yok.';
                historyList.appendChild(empty);
                return;
            }

            for (const session of sorted) {
                const item = document.createElement('button');
                item.className = 'history-item' + (session.id === activeSessionId ? ' active' : '');
                const messageCount = Array.isArray(session.messages) ? session.messages.length : 0;
                item.innerHTML = \
                    '<div class="history-item-row">' +
                      '<div class="history-main">' +
                        '<div class="history-title">' + (session.pinned ? '📌 ' : '') + escapeHtml(session.title || 'Yeni Sohbet') + '</div>' +
                        '<div class="history-meta"><span>' + messageCount + ' mesaj</span><span>' + formatDate(session.updatedAt) + '</span></div>' +
                      '</div>' +
                      '<div class="history-actions">' +
                        '<button class="history-action-btn pin-btn ' + (session.pinned ? 'pinned' : '') + '" title="Sabitle">' +
                          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>' +
                        '</button>' +
                        '<button class="history-action-btn delete-btn" title="Sil">' +
                          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
                        '</button>' +
                      '</div>' +
                    '</div>';
                item.onclick = () => switchSession(session.id);

                const pinBtn = item.querySelector('.pin-btn');
                if (pinBtn) {
                    pinBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        togglePinSession(session.id);
                    };
                }

                const deleteBtn = item.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.onclick = (ev) => {
                        ev.stopPropagation();
                        deleteSession(session.id);
                    };
                }

                historyList.appendChild(item);
            }
        }

        function togglePinSession(sessionId) {
            const session = chatSessions.find((s) => s.id === sessionId);
            if (!session) return;
            session.pinned = !session.pinned;
            session.updatedAt = nowIso();
            renderHistory();
            persist();
        }

        function deleteSession(sessionId) {
            const idx = chatSessions.findIndex((s) => s.id === sessionId);
            if (idx < 0) return;
            const session = chatSessions[idx];
            const title = session && session.title ? session.title : 'Yeni Sohbet';
            const ok = confirm('"' + title + '" sohbetini silmek istiyor musunuz?');
            if (!ok) return;

            chatSessions.splice(idx, 1);

            if (chatSessions.length === 0) {
                startNewChat();
                return;
            }

            if (activeSessionId === sessionId) {
                activeSessionId = chatSessions[0].id;
                renderActiveSession();
            }

            renderHistory();
            persist();
        }

        function escapeHtml(str) {
            return (str || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }

        function clearUiConversation() {
            chatContainer.innerHTML = '';
            currentAiMessageElement = null;
            currentAiBubble = null;
            currentTraceContainer = null;
            currentFullText = '';
        }

        function renderActiveSession() {
            clearUiConversation();
            const session = getActiveSession();
            if (!session) return;
            for (const msg of session.messages) {
                addMessage(msg.text, msg.role, false);
            }
        }

        function setDefaultGreetingIfNeeded(session) {
            if (!session || session.messages.length > 0) return;
            session.messages.push({ role: 'ai', text: GREETING, createdAt: nowIso() });
            session.updatedAt = nowIso();
        }

        function switchSession(sessionId) {
            if (sessionId === activeSessionId) {
                historyDrawer.classList.remove('open');
                return;
            }
            activeSessionId = sessionId;
            renderActiveSession();
            renderHistory();
            persist();
            historyDrawer.classList.remove('open');
        }

        function startNewChat() {
            const session = createSession();
            setDefaultGreetingIfNeeded(session);
            chatSessions.unshift(session);
            if (chatSessions.length > MAX_SESSIONS) {
                chatSessions = chatSessions.slice(0, MAX_SESSIONS);
            }
            activeSessionId = session.id;
            renderActiveSession();
            renderHistory();
            persist();
        }

        function loadInitialState() {
            const saved = vscode.getState() || {};
            chatSessions = Array.isArray(saved.chatSessions) ? saved.chatSessions.map(normalizeSession) : [];
            activeSessionId = typeof saved.activeSessionId === 'string' ? saved.activeSessionId : '';
            selectedModel = typeof saved.selectedModel === 'string' ? saved.selectedModel : selectedModel;

            if (chatSessions.length === 0) {
                startNewChat();
                return;
            }

            const found = chatSessions.some((s) => s.id === activeSessionId);
            if (!found) {
                activeSessionId = chatSessions[0].id;
            }

            const active = getActiveSession();
            if (active) {
                setDefaultGreetingIfNeeded(active);
            }

            renderActiveSession();
            renderHistory();
            persist();
        }

        function initModelPicker() {
            modelSelect.innerHTML = '';
            for (const option of (initialState.modelOptions || [])) {
                const el = document.createElement('option');
                el.value = option.value;
                el.textContent = option.label;
                if (option.value === selectedModel) {
                    el.selected = true;
                }
                modelSelect.appendChild(el);
            }

            if (!modelSelect.value && modelSelect.options.length > 0) {
                modelSelect.options[0].selected = true;
                selectedModel = modelSelect.value;
            }

            modelSelect.onchange = () => {
                selectedModel = modelSelect.value;
                persist();
                vscode.postMessage({
                    command: 'setModel',
                    model: selectedModel
                });
            };
        }

        function addMessage(text, role, shouldPersist = true) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + role;
            
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble markdown-body';
            
            if (role === 'user') {
                bubble.innerText = text;
            } else {
                bubble.innerHTML = md.render(text);
                currentFullText = text;
            }
            
            msgDiv.appendChild(bubble);
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            if (role === 'ai') {
                currentAiMessageElement = msgDiv;
                currentAiBubble = bubble;
            }

            if (shouldPersist) {
                const session = getActiveSession();
                if (session) {
                    session.messages.push({ role, text, createdAt: nowIso() });
                    session.updatedAt = nowIso();
                    if (role === 'user' && session.title === 'Yeni Sohbet') {
                        session.title = truncateTitle(text);
                    }
                    renderHistory();
                    persist();
                }
            }
            return bubble;
        }

        function updateAiMessage(chunk) {
            if (!currentAiBubble) {
                addMessage('', 'ai');
            }
            currentFullText += chunk;
            currentAiBubble.innerHTML = md.render(currentFullText);
            chatContainer.scrollTop = chatContainer.scrollHeight;

            const session = getActiveSession();
            if (!session || session.messages.length === 0) return;
            const last = session.messages[session.messages.length - 1];
            if (last.role === 'ai') {
                last.text = currentFullText;
                session.updatedAt = nowIso();
                persist();
            }
        }

        function addTraceStep(tool, reasoning) {
            if (!currentAiMessageElement) return;

            if (!currentTraceContainer) {
                currentTraceContainer = document.createElement('div');
                currentTraceContainer.className = 'trace-container';
                currentAiMessageElement.appendChild(currentTraceContainer);
            }

            const item = document.createElement('div');
            item.className = 'trace-item active';
            item.innerHTML = \`<span class="trace-icon">🧬</span> <div style="flex:1"><b>\${tool}</b><br/><span style="opacity:0.8">\${reasoning || ''}</span></div>\`;
            
            const prev = currentTraceContainer.querySelector('.active');
            if (prev) prev.classList.remove('active');

            currentTraceContainer.appendChild(item);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function addActionCard(type, file, content, operation, trustId, trustScope) {
            const card = document.createElement('div');
            card.className = 'action-card';
            card.innerHTML = \`
                <div class="action-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
                    Önerilen Değişiklik: \${file}
                </div>
                <button class="btn btn-primary view-diff">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Değişikliği Önizle
                </button>
            \`;

            card.querySelector('.view-diff').onclick = () => {
                vscode.postMessage({
                    command: 'applyAction',
                    action: {
                        action: 'edit_file',
                        file: file,
                        content: content,
                        operation: operation,
                        trust_id: trustId,
                        trust_scope: trustScope,
                    }
                });
            };

            currentAiMessageElement.appendChild(card);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function sendMsg() {
            const text = chatInput.value.trim();
            if (!text) return;

            addMessage(text, 'user');
            chatInput.value = '';
            currentAiMessageElement = null;
            currentAiBubble = null;
            currentTraceContainer = null;
            currentFullText = "";

            vscode.postMessage({
                command: 'ask',
                text: text,
                model: selectedModel
            });
        }

        sendBtn.onclick = sendMsg;
        resetBtn.onclick = () => {
            const session = getActiveSession();
            if (!session) return;
            session.messages = [];
            session.title = 'Yeni Sohbet';
            setDefaultGreetingIfNeeded(session);
            renderActiveSession();
            renderHistory();
            persist();
        };

        historyBtn.onclick = () => {
            historyDrawer.classList.toggle('open');
            if (historyDrawer.classList.contains('open')) {
                historySearch.focus();
            }
        };

        newChatBtn.onclick = () => {
            startNewChat();
            historyDrawer.classList.remove('open');
        };

        historySearch.oninput = () => {
            historySearchTerm = historySearch.value || '';
            renderHistory();
        };

        chatInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMsg();
            }
        };

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'stream_chunk':
                    updateAiMessage(message.text);
                    break;
                case 'trace_step':
                    addTraceStep(message.tool, message.reasoning);
                    break;
                case 'action_found':
                    if (message.action.action === 'edit_file') {
                        addActionCard('edit', message.action.file, message.action.content, message.action.operation, message.action.trust_id, message.action.trust_scope);
                    } else if (message.action.action === 'multi_edit') {
                        message.action.changes.forEach(c => addActionCard('edit', c.file, c.content, c.operation, c.trust_id, c.trust_scope));
                    }
                    break;
            }
        });

        initModelPicker();
        loadInitialState();
    </script>
</body>
</html>`;
}
