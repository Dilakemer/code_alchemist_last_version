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

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

function escapeForInlineJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtmlText(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getChatWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, options: ChatViewOptions): string {
  const cspSource = webview.cspSource;
  const nonce = getNonce();
    const inlineStateJson = escapeForInlineJson({
        selectedModel: options.selectedModel,
        modelOptions: options.modelOptions,
    });
    const modelOptionsMarkup = options.modelOptions
        .map((opt) => {
            const selectedAttr = opt.value === options.selectedModel ? ' selected' : '';
            return `<option value="${escapeHtmlText(opt.value)}"${selectedAttr}>${escapeHtmlText(opt.label)}</option>`;
        })
        .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src ${cspSource} 'nonce-${nonce}' https://cdn.jsdelivr.net; font-src ${cspSource}; img-src ${cspSource} https:;">
    <style nonce="${nonce}">
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
            --margin-right-sm: 4px;
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

        /* ── Health Indicator ── */
        .health-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 600;
            padding: 4px 10px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            color: var(--text-muted);
            transition: all 0.3s ease;
        }
        .health-indicator.online {
            color: #34d399;
            background: rgba(52, 211, 153, 0.08);
            border-color: rgba(52, 211, 153, 0.2);
        }
        .health-indicator.connecting {
            color: #fbbf24;
            background: rgba(251, 191, 36, 0.08);
            border-color: rgba(251, 191, 36, 0.2);
        }
        .health-indicator.offline {
            color: #f87171;
            background: rgba(248, 113, 113, 0.08);
            border-color: rgba(248, 113, 113, 0.2);
        }
        .health-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
            box-shadow: 0 0 8px currentColor;
        }
        .health-indicator.online .health-dot { animation: none; }
        .health-indicator.connecting .health-dot { animation: pulseHealth 1.5s infinite; }
        @keyframes pulseHealth {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
        }

        .reconnect-area {
            display: none;
            padding: 10px;
            text-align: center;
            background: rgba(248, 113, 113, 0.05);
            border-top: 1px solid rgba(248, 113, 113, 0.1);
        }
        .reconnect-area.visible {
            display: block;
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
            padding: 8px 10px;
            background: rgba(0,0,0,0.2);
            border-radius: var(--radius-md);
            display: flex;
            flex-direction: column;
            gap: 6px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .trace-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 11.5px;
            color: var(--text-muted);
            line-height: 1.4;
        }
        .trace-icon-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: rgba(148, 163, 184, 0.9);
            margin-top: 4px;
            flex: 0 0 auto;
        }
        .trace-item.active {
            color: var(--text-main);
        }
        .trace-item.active .trace-icon-dot {
            background: #22d3ee;
        }
        .trace-main {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 5px;
        }
        .trace-tool {
            font-weight: 600;
        }
        .trace-badge {
            border: 1px solid var(--border);
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 1px 5px;
            font-size: 10.5px;
            color: #93c5fd;
        }
        .trace-sub {
            margin-top: 2px;
            color: var(--text-muted);
            font-size: 10.5px;
            opacity: 0.9;
        }
        .trace-flex {
            flex: 1;
        }
        .mr-4 { margin-right: 4px; }
        .w-full { width: 100%; }
        .fs-11 { font-size: 11px; }

        /* ── Action Cards ── */
        .action-card {
            margin-top: 14px;
            background: rgba(30, 41, 59, 0.72);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .action-card.is-applied {
            border-color: rgba(16, 185, 129, 0.45);
            background: rgba(16, 185, 129, 0.08);
        }
        .action-card.is-rejected {
            border-color: rgba(239, 68, 68, 0.45);
            background: rgba(239, 68, 68, 0.08);
        }
        .action-card.is-error {
            border-color: rgba(248, 113, 113, 0.45);
            background: rgba(248, 113, 113, 0.08);
        }
        .action-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-main);
        }
        .action-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
        }
        .action-stats {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--text-muted);
        }
        .delta-plus {
            color: #34d399;
            font-weight: 700;
        }
        .delta-minus {
            color: #f87171;
            font-weight: 700;
        }
        .action-status {
            font-size: 11px;
            color: var(--text-muted);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .action-status[data-state="applied"] {
            color: #34d399;
        }
        .action-status[data-state="rejected"] {
            color: #f87171;
        }
        .action-status[data-state="error"] {
            color: #fca5a5;
        }
        .action-footer {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
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
        .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: var(--text-main);
            border: 1px solid var(--border);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.09);
        }
        .btn-danger {
            background: rgba(239, 68, 68, 0.14);
            color: #fecaca;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.2);
        }
        .btn:disabled {
            cursor: not-allowed;
            opacity: 0.65;
            transform: none;
            box-shadow: none;
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
            display: none !important;
        }

        .request-status {
            margin: 10px 20px 0;
            padding: 8px 10px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }

        .request-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #f59e0b;
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55);
            animation: pulseStatus 1.2s infinite;
        }

        .request-status.generating .request-status-dot {
            background: #22d3ee;
            box-shadow: 0 0 0 0 rgba(34, 211, 238, 0.55);
        }

        .request-status.error .request-status-dot {
            background: #f87171;
            animation: none;
        }

        @keyframes pulseStatus {
            0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
            70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
    </style>
</head>
<body>
    <div class="chat-header">
        <div class="header-left">
            <div id="health-indicator" class="health-indicator connecting">
                <div class="health-dot"></div>
                <span id="health-text">Connecting</span>
            </div>
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

    <div class="reconnect-area" id="reconnect-area">
        <button class="btn btn-secondary w-full fs-11" id="reconnect-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-4"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
            Bağlantıyı Yenile
        </button>
    </div>

    <div id="chat-container">
    </div>

    <div id="request-status" class="request-status hidden" aria-live="polite">
        <span class="request-status-dot"></span>
        <span id="request-status-text"></span>
    </div>

    <div class="input-area">
        <div class="input-container">
            <textarea id="chat-input" rows="3" placeholder="Sorunuzu sorun veya '/' ile komutları görün..."></textarea>
            <div class="input-footer">
                <div class="hint">Shift + Enter ile alt satıra geçin</div>
                <button class="btn btn-primary" id="send-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Gönder
                </button>
            </div>
            <div class="model-picker">
                <span>Model</span>
                <select id="model-select">${modelOptionsMarkup}</select>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js"></script>
    <script nonce="${nonce}">
        /**
         * ── CodeAlchemist Sidebar State Machine ──
         * This script implements a deterministic FSM with Dual Readiness and 
         * RequestId Authority to ensure UI synchronization and robustness.
         **/

        const initialState = ${inlineStateJson};
        const vscode = acquireVsCodeApi();
        let md;

        // Elements
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
        const requestStatus = document.getElementById('request-status');
        const requestStatusText = document.getElementById('request-status-text');

        // Application State (The Single Source of Truth)
        const appState = {
            // FSM Logic
            phase: 'IDLE',      // 'IDLE' | 'REQUEST_INITIATED' | 'REQUEST_STREAMING' | 'REQUEST_COMPLETED' | 'REQUEST_FAILED' | 'REQUEST_CANCELLED'
            health: 'connecting', // 'online' | 'offline' | 'connecting'
            requestId: '',      // Current active requestId authority
            statusText: '',
            
            // Boot Sequence Gating
            ready: {
                ui: false,
                provider: false
            },

            // Persistent Context
            chatSessions: [],
            activeSessionId: '',
            selectedModel: initialState.selectedModel || 'auto',
            historySearchTerm: '',

            // Stream state
            currentAiMessageElement: null,
            currentAiBubble: null,
            currentTraceContainer: null,
            currentFullText: ''
        };

        const MAX_SESSIONS = 30;
        const GREETING = \`Merhaba! Ben **CodeAlchemist Agent**. Kodunuzu inceleyebilir, dosya değişiklikleri yapabilir ve projelerinizde size eşlik edebilirim.

*Nasıl yardımcı olabilirim?*\`;

        // ── Deterministic FSM ──
        function dispatch(action) {
            logStateTransition(action);

            switch (action.type) {
                case 'BOOT_UI_READY':
                    appState.ready.ui = true;
                    break;
                case 'RECONCILE_SNAPSHOT':
                case 'RECONCILE_EVENT':
                    if (action.payload.requestId) {
                        appState.requestId = action.payload.requestId;
                    }
                    if (action.payload.phase) {
                        appState.phase = action.payload.phase;
                    }
                    if (action.payload.text) {
                        appState.statusText = action.payload.text;
                    }
                    if (action.type === 'RECONCILE_SNAPSHOT' || action.type === 'RECONCILE_EVENT') {
                        appState.ready.provider = true;
                    }
                    break;
                case 'UX_ASK':
                    if (appState.phase !== 'IDLE') return; // Guard
                    appState.phase = 'REQUEST_INITIATED';
                    appState.statusText = 'Working...';
                    break;
                case 'IDLE':
                    appState.phase = 'IDLE';
                    appState.statusText = '';
                    break;
                case 'HEALTH_UPDATE':
                    appState.health = action.payload;
                    appState.ready.provider = true;
                    break;
            }

            syncUi();
        }

        function logStateTransition(action) {
            console.log(\`[\${new Date().toISOString()}] ACTION: \${action.type} -> RequestId: \${appState.requestId} | Phase: \${appState.phase}\`);
        }

        /**
         * ── Pure Renderer ──
         * Toggles DOM states based on appState.
         **/
        function syncUi() {
            const isFullyReady = appState.ready.ui && appState.ready.provider;
            const isIdle = appState.phase === 'IDLE';
            const isOnline = appState.health === 'online';
            const canAttemptRequest = appState.health !== 'offline';

            // Gating interaction
            sendBtn.disabled = !isFullyReady || !isIdle || !canAttemptRequest;
            chatInput.disabled = !isFullyReady || !isIdle || !canAttemptRequest;
            chatInput.placeholder = isOnline ? "Sorunuzu sorun veya '/' ile komutları görün..." : "Bakım modunda veya çevrimdışı...";
            resetBtn.disabled = !isFullyReady;
            historyBtn.disabled = !isFullyReady;
            newChatBtn.disabled = !isFullyReady;

            // Status Bar Visibility
            if (isIdle || !isFullyReady) {
                requestStatus.classList.add('hidden');
            } else {
                requestStatus.classList.remove('hidden');
                requestStatus.classList.toggle('generating', appState.phase === 'REQUEST_STREAMING');
                requestStatus.classList.toggle('error', appState.phase === 'REQUEST_FAILED');
                requestStatusText.textContent = appState.statusText || getDefaultStatusText(appState.phase);
            }

            // Health Indicator UI
            const healthIndicator = document.getElementById('health-indicator');
            const healthText = document.getElementById('health-text');
            const reconnectArea = document.getElementById('reconnect-area');

            healthIndicator.className = \`health-indicator \${appState.health}\`;
            healthText.textContent = appState.health.charAt(0).toUpperCase() + appState.health.slice(1);
            
            if (appState.health === 'offline') {
                reconnectArea.classList.add('visible');
            } else {
                reconnectArea.classList.remove('visible');
            }
        }

        function getDefaultStatusText(phase) {
            switch(phase) {
                case 'REQUEST_INITIATED': return 'Working...';
                case 'REQUEST_STREAMING': return 'Generating...';
                case 'REQUEST_FAILED': return 'İstek başarısız oldu.';
                default: return 'Working...';
            }
        }

        // ── Boot Sequence ──
        function init() {
            setupMessageListener(); // Call this first to not miss early provider messages
            
            try {
                if (typeof window.markdownit === 'function') {
                    md = window.markdownit({ html: true, linkify: true, typographer: true });
                } else {
                    md = { render: (t) => t };
                }
            } catch (e) {
                console.error('Markdown-it failed:', e);
                md = { render: (t) => t };
            }

            loadInitialPersistentData();
            dispatch({ type: 'BOOT_UI_READY' });
            initModelPicker();
            renderActiveSession();
            renderHistory();
            vscode.postMessage({ command: 'webviewReady' });
            setTimeout(() => {
                if (!appState.ready.provider) {
                    appState.ready.provider = true;
                    syncUi();
                    vscode.postMessage({ command: 'webviewReady' });
                }
            }, 1500);
        }

        function setupMessageListener() {
            window.addEventListener('message', event => {
                const message = event.data;
                const rid = message.requestId;

                if (rid && appState.requestId && rid !== appState.requestId && message.command !== 'STATE_SNAPSHOT') {
                    console.warn(\`Ignoring message for stale requestId: \${rid}\`);
                    return;
                }

                switch (message.command) {
                    case 'STATE_SNAPSHOT':
                        dispatch({ type: 'RECONCILE_SNAPSHOT', payload: message });
                        break;
                    case 'STATE_EVENT':
                        dispatch({ type: 'RECONCILE_EVENT', payload: message });
                        break;
                    case 'HEALTH_STATUS':
                        dispatch({ type: 'HEALTH_UPDATE', payload: message.status });
                        break;
                    case 'stream_chunk':
                        updateAiMessage(message.text);
                        break;
                    case 'trace_step':
                        addTraceStep(message.tool, message.reasoning);
                        break;
                    case 'action_found':
                        handleActionFound(message.action);
                        break;
                    case 'action_result':
                        updateActionCard(message.actionId, message.status, message.message);
                        break;
                    case 'session_deleted':
                        deleteSession(message.sessionId);
                        break;
                }
            });
        }

        function nowIso() { return new Date().toISOString(); }

        function createSession() {
            const id = 'session-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            return { id, title: 'Yeni Sohbet', createdAt: nowIso(), updatedAt: nowIso(), pinned: false, messages: [] };
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
            return appState.chatSessions.find((s) => s.id === appState.activeSessionId) || null;
        }

        function persist() {
            vscode.setState({
                chatSessions: appState.chatSessions,
                activeSessionId: appState.activeSessionId,
                selectedModel: appState.selectedModel
            });
        }

        function loadInitialPersistentData() {
            const saved = vscode.getState() || {};
            appState.chatSessions = Array.isArray(saved.chatSessions) ? saved.chatSessions.map(normalizeSession) : [];
            appState.activeSessionId = typeof saved.activeSessionId === 'string' ? saved.activeSessionId : '';
            appState.selectedModel = typeof saved.selectedModel === 'string' ? saved.selectedModel : appState.selectedModel;

            if (appState.chatSessions.length === 0) {
                const s = createSession();
                appState.chatSessions.push(s);
                appState.activeSessionId = s.id;
                setDefaultGreetingIfNeeded(s);
            } else {
                const found = appState.chatSessions.some((s) => s.id === appState.activeSessionId);
                if (!found) appState.activeSessionId = appState.chatSessions[0].id;
                setDefaultGreetingIfNeeded(getActiveSession());
            }
        }

        function renderHistory() {
            historyList.innerHTML = '';
            const query = appState.historySearchTerm.trim().toLowerCase();
            const filtered = query
                ? appState.chatSessions.filter((s) => s.title.toLowerCase().includes(query) || s.messages.some(m => m.text.toLowerCase().includes(query)))
                : [...appState.chatSessions];

            const sorted = filtered.sort((a, b) => (b.pinned - a.pinned) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
            
            if (sorted.length === 0) {
                historyList.innerHTML = '<div class="history-empty">Henüz sohbet yok.</div>';
                return;
            }

            for (const session of sorted) {
                const item = document.createElement('div');
                item.className = 'history-item' + (session.id === appState.activeSessionId ? ' active' : '');
                item.innerHTML = \`
                    <div class="history-item-row">
                        <div class="history-main">
                            <div class="history-title">\${session.pinned ? '📌 ' : ''}\${escapeHtml(session.title)}</div>
                            <div class="history-meta"><span>\${session.updatedAt.split('T')[0]}</span></div>
                        </div>
                        <div class="history-actions">
                            <button class="history-action-btn pin-btn \${session.pinned ? 'pinned' : ''}" onclick="event.stopPropagation(); togglePinSession('\${session.id}')">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>
                            </button>
                            <button class="history-action-btn delete-btn" onclick="event.stopPropagation(); requestDeleteSession('\${session.id}', '\${escapeHtml(session.title)}')">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                        </div>
                    </div>\`;
                item.onclick = () => switchSession(session.id);
                historyList.appendChild(item);
            }
        }

        window.togglePinSession = (sid) => {
            const s = appState.chatSessions.find(x => x.id === sid);
            if (s) { s.pinned = !s.pinned; s.updatedAt = nowIso(); renderHistory(); persist(); }
        };

        window.requestDeleteSession = (sid, title) => {
            console.log(\`[CodeAlchemist] requestDeleteSession clicked: \${sid}\`);
            try {
                vscode.postMessage({ command: 'requestDeleteSession', sessionId: sid, title });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for requestDeleteSession:', e);
            }
        };

        function deleteSession(sid) {
            appState.chatSessions = appState.chatSessions.filter(s => s.id !== sid);
            if (appState.chatSessions.length === 0) {
                const s = createSession();
                setDefaultGreetingIfNeeded(s);
                appState.chatSessions.push(s);
                appState.activeSessionId = s.id;
            } else if (appState.activeSessionId === sid) {
                appState.activeSessionId = appState.chatSessions[0].id;
            }
            renderActiveSession();
            renderHistory();
            persist();
        }

        function switchSession(sid) {
            appState.activeSessionId = sid;
            historyDrawer.classList.remove('open');
            renderActiveSession();
            renderHistory();
            persist();
        }

        const DEFAULT_FALLBACK_MODELS = [
            { value: 'auto', label: 'Auto (Smart Model)' },
            { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
            { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' }
        ];

        function initModelPicker() {
            modelSelect.innerHTML = '';
            const options = (initialState.modelOptions && initialState.modelOptions.length > 0) 
                ? initialState.modelOptions 
                : DEFAULT_FALLBACK_MODELS;
            
            for (const opt of options) {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.label;
                el.selected = opt.value === appState.selectedModel;
                modelSelect.appendChild(el);
            }
            modelSelect.onchange = () => {
                appState.selectedModel = modelSelect.value;
                persist();
                vscode.postMessage({ command: 'setModel', model: appState.selectedModel });
            };
        }

        function escapeHtml(s) { 
            return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); 
        }

        function renderActiveSession() {
            chatContainer.innerHTML = '';
            appState.currentAiMessageElement = null;
            appState.currentAiBubble = null;
            appState.currentTraceContainer = null;
            appState.currentFullText = '';
            const session = getActiveSession();
            if (session) session.messages.forEach(m => addMessage(m.text, m.role, false));
        }

        function setDefaultGreetingIfNeeded(session) {
            if (session && session.messages.length === 0) {
                session.messages.push({ role: 'ai', text: GREETING, createdAt: nowIso() });
            }
        }

        function addMessage(text, role, shouldPersist = true) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + role;
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble markdown-body';
            if (role === 'user') bubble.textContent = text;
            else {
                bubble.innerHTML = md.render(text);
                appState.currentFullText = text;
                appState.currentAiMessageElement = msgDiv;
                appState.currentAiBubble = bubble;
            }
            msgDiv.appendChild(bubble);
            chatContainer.appendChild(msgDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            if (shouldPersist) {
                const session = getActiveSession();
                if (session) {
                    session.messages.push({ role, text, createdAt: nowIso() });
                    if (role === 'user' && session.title === 'Yeni Sohbet') session.title = text.slice(0, 40);
                    session.updatedAt = nowIso();
                    renderHistory();
                    persist();
                }
            }
            return bubble;
        }

        function updateAiMessage(chunk) {
            if (!appState.currentAiBubble) addMessage('', 'ai');
            appState.currentFullText += chunk;
            appState.currentAiBubble.innerHTML = md.render(appState.currentFullText);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            const session = getActiveSession();
            if (session && session.messages.length > 0) {
                const last = session.messages[session.messages.length - 1];
                if (last.role === 'ai') { last.text = appState.currentFullText; persist(); }
            }
        }

        function addTraceStep(tool, reasoning) {
            if (!appState.currentAiMessageElement) addMessage('', 'ai');
            if (!appState.currentTraceContainer) {
                appState.currentTraceContainer = document.createElement('div');
                appState.currentTraceContainer.className = 'trace-container';
                appState.currentAiMessageElement.appendChild(appState.currentTraceContainer);
            }
            const item = document.createElement('div');
            item.className = 'trace-item active';
            item.innerHTML = '<span class="trace-icon-dot"></span><div class="trace-flex"><div class="trace-main"><span class="trace-tool">' + escapeHtml(tool) + '</span></div><div class="trace-sub">' + escapeHtml(reasoning) + '</div></div>';
            const prev = appState.currentTraceContainer.querySelector('.active');
            if (prev) prev.classList.remove('active');
            appState.currentTraceContainer.appendChild(item);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function handleActionFound(action) {
            if (action.action === 'edit_file') addActionCard(action);
            else if (action.action === 'multi_edit') action.changes.forEach(c => addActionCard({ ...c, action: 'edit_file' }));
        }

        function addActionCard(action) {
            const cardId = 'card-' + Math.random().toString(36).slice(2, 9);
            const card = document.createElement('div');
            card.className = 'action-card';
            card.dataset.actionId = cardId;
            const renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
            card.innerHTML = '<div class="action-header"><div class="action-title"><span>File Change</span></div></div>' +
                '<div class="action-status">' + escapeHtml(action.file) + '</div>' +
                '<div class="action-footer">' +
                    '<button class="btn btn-primary action-keep-btn" onclick="resolveCard(\\\'' + cardId + '\\\', \\\'accept\\\')">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn" onclick="resolveCard(\\\'' + cardId + '\\\', \\\'reject\\\')">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn" onclick="previewAction(\\\'' + cardId + '\\\')">Preview</button>' +
                    renderBtn +
                '</div>';
            card._actionData = action;
            appState.currentAiMessageElement.appendChild(card);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        window.resolveCard = (cid, decision) => {
            console.log('[CodeAlchemist] resolveCard clicked: ' + cid + ' -> ' + decision);
            const card = document.querySelector('[data-action-id="' + cid + '"]');
            if (!card) {
                console.warn('[CodeAlchemist] resolveCard: Card ' + cid + ' not found.');
                return;
            }
            try {
                vscode.postMessage({ command: 'resolveAction', decision, action: card._actionData, actionId: cid });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for resolveCard:', e);
            }
        };

        window.previewAction = (cid) => {
            console.log('[CodeAlchemist] previewAction clicked: ' + cid);
            const card = document.querySelector('[data-action-id="' + cid + '"]');
            if (!card) {
                console.warn('[CodeAlchemist] previewAction: Card ' + cid + ' not found.');
                return;
            }
            try {
                vscode.postMessage({ command: 'applyAction', action: card._actionData });
            } catch (e) {
                console.error('[CodeAlchemist] postMessage failed for previewAction:', e);
            }
        };

        function updateActionCard(aid, status, msg) {
            console.log('[CodeAlchemist] updateActionCard: ' + aid + ' -> ' + status);
            const card = document.querySelector('[data-action-id="' + aid + '"]');
            if (!card) return;
            card.querySelector('.action-status').textContent = msg || status;
            card.className = 'action-card ' + (status === 'applied' ? 'is-applied' : status === 'rejected' ? 'is-rejected' : status === 'reverted' ? '' : 'is-error');
            
            if (status === 'applied') {
                const footer = card.querySelector('.action-footer');
                footer.innerHTML = '<button class="btn btn-secondary" onclick="resolveCard(\\\'' + aid + '\\\', \\\'undo\\\')">Undo</button>';
                const action = card._actionData;
                if (action && action.render_url) {
                    footer.innerHTML += '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>';
                }
            } else if (status === 'reverted') {
                const action = card._actionData;
                const renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
                card.querySelector('.action-footer').innerHTML = 
                    '<button class="btn btn-primary action-keep-btn" onclick="resolveCard(\\\'' + aid + '\\\', \\\'accept\\\')">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn" onclick="resolveCard(\\\'' + aid + '\\\', \\\'reject\\\')">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn" onclick="previewAction(\\\'' + aid + '\\\')">Preview</button>' +
                    renderBtn;
            } else {
                card.querySelectorAll('button').forEach(b => b.disabled = true);
            }
        }

        function sendMsg() {
            const text = chatInput.value.trim();
            if (!text || appState.phase !== 'IDLE') return;
            addMessage(text, 'user');
            chatInput.value = '';
            dispatch({ type: 'UX_ASK' });
            vscode.postMessage({ command: 'ask', text, model: appState.selectedModel });
        }

        if (sendBtn) {
            sendBtn.onclick = sendMsg;
        }
        if (chatInput) {
            chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
        }
        if (newChatBtn) {
            newChatBtn.onclick = () => {
            const s = createSession();
            setDefaultGreetingIfNeeded(s);
            appState.chatSessions.unshift(s);
            appState.activeSessionId = s.id;
            renderActiveSession();
            renderHistory();
            persist();
            };
        }
        if (resetBtn) {
            resetBtn.onclick = () => {
            const s = getActiveSession();
            if (s) { s.messages = []; setDefaultGreetingIfNeeded(s); s.title='Yeni Sohbet'; renderActiveSession(); renderHistory(); persist(); }
            };
        }
        if (historyBtn && historyDrawer && historySearch) {
            historyBtn.onclick = () => { historyDrawer.classList.toggle('open'); if(historyDrawer.classList.contains('open')) historySearch.focus(); };
        }
        if (historySearch) {
            historySearch.oninput = () => { appState.historySearchTerm = historySearch.value; renderHistory(); };
        }

        const reconnectBtn = document.getElementById('reconnect-btn');
        if (reconnectBtn) {
            reconnectBtn.onclick = () => {
                dispatch({ type: 'HEALTH_UPDATE', payload: 'connecting' });
                vscode.postMessage({ command: 'healthCheck' });
            };
        }

        init();
    </script>
</body>
</html>`;
}
