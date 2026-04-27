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
        .command-card {
            margin-top: 14px;
            background: #111;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
            font-family: 'Fira Code', monospace;
        }
        .command-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .command-body {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        .command-icon-bullet {
            width: 6px;
            height: 6px;
            background: #444;
            border-radius: 50%;
            margin-top: 6px;
            flex-shrink: 0;
        }
        .command-text {
            flex-grow: 1;
            font-size: 13px;
            color: #ccc;
            white-space: pre-wrap;
            word-break: break-all;
            line-height: 1.4;
        }
        .command-actions {
            display: flex;
            gap: 10px;
            flex-shrink: 0;
        }
        .command-btn {
            background: none;
            border: none;
            color: #777;
            cursor: pointer;
            padding: 4px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .command-btn:hover {
            color: #fff;
            transform: scale(1.1);
        }
        .command-btn svg {
            width: 18px;
            height: 18px;
        }
        .command-output {
            margin-top: 4px;
            padding: 8px 12px;
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
            font-size: 12px;
            color: #f1c40f;
            display: none;
            border-left: 2px solid #f1c40f;
        }
        .command-output.visible {
            display: block;
        }
        .payment-card {
            margin-top: 14px;
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.3);
            border-radius: var(--radius-md);
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            text-align: center;
            animation: bounceIn 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) 0.2s both;
        }
        @keyframes bounceIn {
            0% { opacity: 0; transform: scale(0.3); }
            50% { opacity: 1; transform: scale(1.05); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); }
        }
        .payment-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            font-size: 14px;
            font-weight: 700;
            color: #fbbf24;
        }
        .payment-header svg {
            filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
        }
        .payment-desc {
            font-size: 12.5px;
            color: var(--text-main);
            line-height: 1.5;
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

        /* ── Sidebar Global Header ── */
        .header-title {
            font-size: 15px;
            font-weight: 700;
            margin-left: 10px;
        }

        .header-center {
            flex: 1;
            display: flex;
            justify-content: center;
        }

        .balance-chip {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(217, 70, 239, 0.15));
            border: 1px solid rgba(139, 92, 246, 0.3);
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            color: #d8b4fe;
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.1);
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .balance-chip:hover {
            border-color: rgba(139, 92, 246, 0.6);
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.2);
        }

        .balance-chip.verifying {
            opacity: 0.72;
            border-color: rgba(148, 163, 184, 0.35);
            box-shadow: none;
        }

        .auth-sync-indicator {
            padding: 4px 9px;
            border-radius: 999px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            background: rgba(148, 163, 184, 0.08);
            color: #cbd5f5;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            animation: pulseAuthSync 1.6s ease-in-out infinite;
        }

        @keyframes pulseAuthSync {
            0% { opacity: 0.6; transform: translateY(0); }
            50% { opacity: 1; transform: translateY(-1px); }
            100% { opacity: 0.6; transform: translateY(0); }
        }

        .balance-icon {
            color: #fbbf24;
            filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.4));
        }

        .header-actions {
            display: flex;
            gap: 6px;
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
        .btn-hidden {
            opacity: 0;
            pointer-events: none;
        }
        .send-stop-slot {
            position: relative;
            width: 114px;
            height: 36px;
        }
        .send-stop-slot .btn {
            position: absolute;
            inset: 0;
            transition: opacity 0.16s ease;
        }
        .btn-icon-square {
            width: 36px;
            height: 36px;
            padding: 0;
            border-radius: 8px;
            flex: 0 0 36px;
        }
        .send-stop-slot .btn-icon-square {
            width: 100%;
            height: 100%;
            flex: none;
            border-radius: 6px;
        }
        .btn-icon-square svg {
            width: 14px;
            height: 14px;
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

        .request-status.syncing .request-status-dot {
            background: #a78bfa;
            box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55);
        }

        @keyframes pulseStatus {
            0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); }
            70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
            100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        /* ── Auth Gate ── */
        .auth-gate {
            position: absolute;
            inset: 0;
            top: 54px; /* Header height */
            z-index: 100;
            background: var(--vscode-sideBar-background);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
            text-align: center;
            backdrop-filter: blur(10px);
            background-image: radial-gradient(circle at center, rgba(139, 92, 246, 0.1), transparent);
            transition: opacity 0.4s ease, visibility 0.4s;
        }

        .auth-gate.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .auth-icon {
            width: 64px;
            height: 64px;
            margin-bottom: 24px;
            padding: 16px;
            border-radius: 50%;
            background: rgba(139, 92, 246, 0.1);
            color: var(--primary);
            border: 1px solid var(--primary-glow);
            box-shadow: 0 0 20px var(--primary-glow);
        }

        .auth-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            background: linear-gradient(to right, #8b5cf6, #d946ef);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .auth-desc {
            font-size: 13px;
            color: var(--text-muted);
            margin-bottom: 30px;
            line-height: 1.5;
            max-width: 240px;
        }

        .auth-error {
            margin-top: 12px;
            font-size: 12px;
            color: #f87171;
            background: rgba(248, 113, 113, 0.1);
            padding: 8px 12px;
            border-radius: 8px;
            border: 1px solid rgba(248, 113, 113, 0.2);
            display: none;
        }

        .auth-error.visible {
            display: block;
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
        <div class="header-center">
            <div id="auth-sync-indicator" class="auth-sync-indicator hidden">Yenileniyor</div>
            <div id="balance-chip" class="balance-chip">
                <svg class="balance-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                <span id="balance-amount">0</span>
            </div>
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
            <button class="icon-btn" id="logout-btn" title="Çıkış Yap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
        </div>
    </div>

    <div id="auth-gate" class="auth-gate">
        <div class="auth-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <div class="auth-title">CodeAlchemist'e Hoş Geldiniz</div>
        <div class="auth-desc">Chat ve Agent özelliklerini kullanmak için giriş yapmanız gerekmektedir.</div>
        <button class="btn btn-primary" id="login-btn" style="padding: 12px 24px; font-size: 14px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-4"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Giriş Yap
        </button>
        <div id="auth-error" class="auth-error"></div>
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
                <div style="display:flex; gap:8px;">
                    <div class="send-stop-slot">
                        <button class="btn btn-secondary btn-icon-square btn-hidden" id="stop-btn" title="Yanıtı Durdur" aria-label="Yanıtı Durdur">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"></rect></svg>
                        </button>
                        <button class="btn btn-primary" id="send-btn" title="Gönder" aria-label="Gönder">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                            Gönder
                        </button>
                    </div>
                </div>
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
        const stopBtn = document.getElementById('stop-btn');
        const resetBtn = document.getElementById('reset-btn');
        const historyBtn = document.getElementById('history-btn');
        const newChatBtn = document.getElementById('new-chat-btn');
        const historyDrawer = document.getElementById('history-drawer');
        const historyList = document.getElementById('history-list');
        const historySearch = document.getElementById('history-search');
        const modelSelect = document.getElementById('model-select');
        const requestStatus = document.getElementById('request-status');
        const requestStatusText = document.getElementById('request-status-text');
        const authSyncIndicator = document.getElementById('auth-sync-indicator');
        let authRefreshTimeoutId = null;
        let hasReceivedAuthStatus = false;

        // Application State (The Single Source of Truth)
        const appState = {
            // FSM Logic
            phase: 'IDLE',      // 'IDLE' | 'REQUEST_INITIATED' | 'REQUEST_STREAMING' | 'REQUEST_COMPLETED' | 'REQUEST_FAILED' | 'REQUEST_CANCELLED'
            health: 'connecting', // 'online' | 'offline' | 'connecting'
            requestId: '',      // Current active requestId authority
            statusText: '',
            isAuthenticated: false,
            balance: 0,
            purchaseUrl: '',
            authError: '',
            isVerifying: false,
            reconnecting: false,
            
            // Boot Sequence Gating
            ready: {
                ui: false,
                provider: false
            },

            // Persistent Context
            chatSessions: [],
            activeSessionId: '',
            currentUserKey: '',
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

        function clearAuthRefreshTimeout() {
            if (authRefreshTimeoutId) {
                clearTimeout(authRefreshTimeoutId);
                authRefreshTimeoutId = null;
            }
        }

        function requestAuthRefresh() {
            vscode.postMessage({ command: 'refreshAuthStatus' });
        }

        function scheduleAuthRefreshTimeout() {
            clearAuthRefreshTimeout();
            if (!appState.isVerifying) {
                return;
            }

            authRefreshTimeoutId = setTimeout(() => {
                if (!appState.isVerifying) {
                    return;
                }

                appState.reconnecting = true;
                appState.authError = 'Oturum doğrulaması gecikti. Yeniden bağlanılıyor...';
                syncUi();
                persist({ skipRemote: true });
                requestAuthRefresh();
            }, 3000);
        }

        function getAuthSyncStatusText() {
            return appState.reconnecting
                ? 'Oturum yeniden bağlanıyor...'
                : 'Oturum doğrulanıyor...';
        }

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
                        if (appState.phase === 'IDLE') {
                            appState.requestId = '';
                        }
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
                    appState.requestId = ''; // Clear stale ID to allow new request events
                    appState.phase = 'REQUEST_INITIATED';
                    appState.statusText = 'Working...';
                    break;
                case 'IDLE':
                    appState.phase = 'IDLE';
                    appState.statusText = '';
                    appState.requestId = ''; // Clear authority
                    break;
                case 'HEALTH_UPDATE':
                    appState.health = action.payload;
                    appState.ready.provider = true;
                    break;
                case 'AUTH_UPDATE':
                    hasReceivedAuthStatus = true;
                    appState.isAuthenticated = action.payload.isAuthenticated;
                    appState.balance = typeof action.payload.balance === 'number' ? action.payload.balance : 0;
                    appState.purchaseUrl = typeof action.payload.purchaseUrl === 'string' ? action.payload.purchaseUrl : '';
                    appState.authError = typeof action.payload.error === 'string' ? action.payload.error : '';
                    appState.isVerifying = Boolean(action.payload.isVerifying);
                    appState.reconnecting = Boolean(action.payload.reconnecting);
                    appState.currentUserKey = typeof action.payload.userKey === 'string' ? action.payload.userKey : appState.currentUserKey;
                    appState.ready.provider = true;
                    if (appState.isVerifying) {
                        scheduleAuthRefreshTimeout();
                    } else {
                        clearAuthRefreshTimeout();
                    }
                    persist({ skipRemote: true });
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
            const isBusy = !isIdle;
            const isAuthSettling = appState.isVerifying || appState.reconnecting;

            // Gating interaction
            const canChat = isFullyReady && isIdle && canAttemptRequest && appState.isAuthenticated && !isAuthSettling;
            sendBtn.disabled = !canChat;
            chatInput.disabled = !canChat;
            if (stopBtn) {
                stopBtn.disabled = !isFullyReady || !isBusy;
                stopBtn.classList.toggle('btn-hidden', !isBusy);
            }
            sendBtn.classList.toggle('btn-hidden', isBusy);
            chatInput.placeholder = isAuthSettling
                ? "Oturum yenileniyor..."
                : (isOnline ? "Sorunuzu sorun veya '/' ile komutları görün..." : "Bakım modunda veya çevrimdışı...");
            resetBtn.disabled = !isFullyReady;
            historyBtn.disabled = !isFullyReady;
            newChatBtn.disabled = !isFullyReady;

            // Status Bar Visibility
            if (!isAuthSettling && (isIdle || !isFullyReady)) {
                requestStatus.classList.add('hidden');
            } else {
                requestStatus.classList.remove('hidden');
                requestStatus.classList.toggle('syncing', isAuthSettling);
                requestStatus.classList.toggle('generating', !isAuthSettling && appState.phase === 'REQUEST_STREAMING');
                requestStatus.classList.toggle('error', !isAuthSettling && appState.phase === 'REQUEST_FAILED');
                requestStatusText.textContent = isAuthSettling
                    ? getAuthSyncStatusText()
                    : (appState.statusText || getDefaultStatusText(appState.phase));
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

            // Auth Gate Overlay
            const authGate = document.getElementById('auth-gate');
            const authError = document.getElementById('auth-error');
            
            const shouldKeepAuthGateHidden = appState.isAuthenticated || appState.isVerifying || appState.reconnecting;

            if (shouldKeepAuthGateHidden) {
                authGate.classList.add('hidden');
                authError.classList.remove('visible');
            } else {
                authGate.classList.remove('hidden');
                if (appState.authError) {
                    authError.textContent = appState.authError;
                    authError.classList.add('visible');
                } else {
                    authError.classList.remove('visible');
                }
            }

            // Balance UI
            const balanceAmount = document.getElementById('balance-amount');
            if (balanceAmount) {
                balanceAmount.textContent = appState.balance.toLocaleString();
            }

            if (authSyncIndicator) {
                authSyncIndicator.textContent = appState.reconnecting ? 'Yeniden bağlanıyor' : 'Yenileniyor';
                authSyncIndicator.classList.toggle('hidden', !appState.isAuthenticated || !isAuthSettling);
            }

            const balanceChip = document.getElementById('balance-chip');
            if (balanceChip) {
                balanceChip.classList.toggle('verifying', appState.isAuthenticated && isAuthSettling);
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
                if (!hasReceivedAuthStatus || appState.isVerifying) {
                    if (appState.isAuthenticated) {
                        appState.reconnecting = true;
                        syncUi();
                        persist({ skipRemote: true });
                    }
                    requestAuthRefresh();
                }
            }, 3000);
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
                    case 'AUTH_STATUS':
                        dispatch({ type: 'AUTH_UPDATE', payload: message });
                        break;
                    case 'LOAD_PERSISTED_STATE':
                        applyPersistedChatState(message.state, message.userKey);
                        break;
                    case 'HISTORY_LIST':
                        handleHistoryList(message.sessions);
                        break;
                    case 'SESSION_DETAILS':
                        handleSessionDetails(message.sessionId, message.messages);
                        break;
                    case 'SESSION_LINKED':
                        linkSessionToConversation(message.sessionId, message.conversationId);
                        break;
                    case 'PURGE_STATE':
                        purgeState();
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
            return { id, title: 'Yeni Sohbet', createdAt: nowIso(), updatedAt: nowIso(), pinned: false, messages: [], backendConversationId: '' };
        }

        function normalizeSession(raw) {
            return {
                id: typeof raw?.id === 'string' ? raw.id : ('session-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
                title: typeof raw?.title === 'string' && raw.title.trim() ? raw.title : 'Yeni Sohbet',
                createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : nowIso(),
                updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : nowIso(),
                pinned: Boolean(raw?.pinned),
                messages: Array.isArray(raw?.messages) ? raw.messages : [],
                backendConversationId: typeof raw?.backendConversationId === 'string' ? raw.backendConversationId : '',
                isServerSession: Boolean(raw?.isServerSession),
            };
        }

        function getActiveSession() {
            return appState.chatSessions.find((s) => s.id === appState.activeSessionId) || null;
        }

        function ensureSessionState() {
            if (appState.chatSessions.length > MAX_SESSIONS) {
                appState.chatSessions = appState.chatSessions.slice(0, MAX_SESSIONS);
            }

            if (appState.chatSessions.length === 0) {
                const s = createSession();
                appState.chatSessions.push(s);
                appState.activeSessionId = s.id;
                setDefaultGreetingIfNeeded(s);
                return;
            }

            const found = appState.chatSessions.some((s) => s.id === appState.activeSessionId);
            if (!found) {
                appState.activeSessionId = appState.chatSessions[0].id;
            }

            setDefaultGreetingIfNeeded(getActiveSession());
        }

        function buildPersistedChatState() {
            return {
                chatSessions: appState.chatSessions.map(session => ({
                    id: session.id,
                    title: session.title,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt,
                    pinned: Boolean(session.pinned),
                    messages: Array.isArray(session.messages) ? session.messages : [],
                    backendConversationId: session.backendConversationId || ''
                })),
                activeSessionId: appState.activeSessionId
            };
        }

        function scheduleRemotePersist() {
            if (!appState.currentUserKey || !appState.isAuthenticated) {
                return;
            }

            if (window.__codeAlchemistPersistTimer) {
                clearTimeout(window.__codeAlchemistPersistTimer);
            }

            window.__codeAlchemistPersistTimer = setTimeout(() => {
                if (appState.currentUserKey && appState.isAuthenticated) {
                    vscode.postMessage({ command: 'persistChatState', state: buildPersistedChatState() });
                }
                window.__codeAlchemistPersistTimer = null;
            }, 150);
        }

        function persist(options = {}) {
            const skipRemote = Boolean(options.skipRemote);
            vscode.setState({
                selectedModel: appState.selectedModel,
                isAuthenticated: appState.isAuthenticated,
                balance: appState.balance,
                purchaseUrl: appState.purchaseUrl,
                authError: appState.authError,
                isVerifying: appState.isVerifying,
                reconnecting: appState.reconnecting,
                currentUserKey: appState.currentUserKey
            });

            if (!skipRemote) {
                scheduleRemotePersist();
            }
        }

        function applyPersistedChatState(state, userKey) {
            appState.currentUserKey = typeof userKey === 'string' ? userKey : '';
            appState.chatSessions = Array.isArray(state?.chatSessions) ? state.chatSessions.map(normalizeSession) : [];
            appState.activeSessionId = typeof state?.activeSessionId === 'string' ? state.activeSessionId : '';
            ensureSessionState();
            renderActiveSession();
            renderHistory();
            persist({ skipRemote: true });
        }

        function loadInitialPersistentData() {
            const saved = vscode.getState() || {};
            appState.selectedModel = typeof saved.selectedModel === 'string' ? saved.selectedModel : appState.selectedModel;
            appState.isAuthenticated = Boolean(saved.isAuthenticated);
            appState.balance = typeof saved.balance === 'number' ? saved.balance : 0;
            appState.purchaseUrl = typeof saved.purchaseUrl === 'string' ? saved.purchaseUrl : '';
            appState.authError = typeof saved.authError === 'string' ? saved.authError : '';
            appState.isVerifying = Boolean(saved.isVerifying);
            appState.reconnecting = Boolean(saved.reconnecting);
            appState.currentUserKey = typeof saved.currentUserKey === 'string' ? saved.currentUserKey : '';
            appState.chatSessions = [];
            appState.activeSessionId = '';
            ensureSessionState();

            if (appState.isAuthenticated) {
                appState.isVerifying = true;
                appState.reconnecting = false;
                appState.ready.provider = true;
                scheduleAuthRefreshTimeout();
            } else {
                appState.isVerifying = false;
                appState.reconnecting = false;
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
                            <button class="history-action-btn pin-btn \${session.pinned ? 'pinned' : ''}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z"/></svg>
                            </button>
                            <button class="history-action-btn delete-btn">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
                            </button>
                        </div>
                    </div>\`;

                const pinBtn = item.querySelector('.pin-btn');
                if (pinBtn) {
                    pinBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        window.togglePinSession(session.id);
                    });
                }

                const deleteBtn = item.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (event) => {
                        event.stopPropagation();
                        window.requestDeleteSession(session.id, session.title);
                    });
                }

                item.onclick = () => switchSession(session.id);
                historyList.appendChild(item);
            }
        }

        window.togglePinSession = (sid) => {
            const s = appState.chatSessions.find(x => x.id === sid);
            if (s) { s.pinned = !s.pinned; s.updatedAt = nowIso(); renderHistory(); persist(); }
        };

        function handleHistoryList(sessions) {
            // Merge with local sessions or replace
            // For per-user isolation, we mainly rely on sync from server
            const serverSessions = sessions.map(s => normalizeSession({
                id: s.title, // Use title as ID because that's what we use in local sessions
                title: s.title,
                createdAt: s.updatedAt,
                updatedAt: s.updatedAt,
                pinned: s.pinned,
                backendConversationId: typeof s.id === 'number' || typeof s.id === 'string' ? String(s.id) : '',
                isServerSession: true
            }));

            // Smart merge: keep local sessions that aren't on server yet, but prefer server data
            serverSessions.forEach(ss => {
                const idx = appState.chatSessions.findIndex(ls => ls.id === ss.id);
                if (idx !== -1) {
                    appState.chatSessions[idx] = { ...appState.chatSessions[idx], ...ss };
                } else {
                    appState.chatSessions.push(ss);
                }
            });

            renderHistory();
            persist();
        }

        function handleSessionDetails(sessionId, messages) {
            const s = appState.chatSessions.find(x => x.id === sessionId);
            if (s) {
                s.messages = messages.map(m => ({
                    role: m.role,
                    text: m.text,
                    createdAt: m.createdAt
                }));
                if (appState.activeSessionId === sessionId) {
                    renderActiveSession();
                }
                persist();
            }
        }

        function linkSessionToConversation(sessionId, conversationId) {
            const session = appState.chatSessions.find(x => x.id === sessionId);
            if (!session) {
                return;
            }

            session.backendConversationId = typeof conversationId === 'string' ? conversationId : '';
            session.isServerSession = false;
            persist();
        }

        function purgeState() {
            clearAuthRefreshTimeout();
            if (window.__codeAlchemistPersistTimer) {
                clearTimeout(window.__codeAlchemistPersistTimer);
                window.__codeAlchemistPersistTimer = null;
            }
            appState.currentUserKey = '';
            appState.chatSessions = [];
            const s = createSession();
            setDefaultGreetingIfNeeded(s);
            appState.chatSessions.push(s);
            appState.activeSessionId = s.id;
            appState.isAuthenticated = false;
            appState.balance = 0;
            appState.purchaseUrl = '';
            appState.authError = 'Logged out.';
            appState.isVerifying = false;
            appState.reconnecting = false;
            renderActiveSession();
            renderHistory();
            persist({ skipRemote: true });
        }

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
            
            const session = getActiveSession();
            if (session && session.isServerSession && session.messages.length === 0) {
                // Fetch details if it's a server session we haven't loaded yet
                vscode.postMessage({ command: 'loadSession', sessionId: sid });
            }

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
            // AI yanıtı ise, sistem mesajı veya prompt izi içeren satırları temizle
            if (role === 'ai') {
                const lines = text.split(/\r?\n/);
                const filtered = lines.filter(line => {
                    const l = line.trim();
                    if (
                        l.startsWith('The user') ||
                        l.startsWith('Acknowledge') ||
                        l.startsWith('This could be a mistake') ||
                        l.startsWith('Offer assistance') ||
                        l.startsWith("User's first input") ||
                        l.startsWith("Assistant's first response") ||
                        l.startsWith("User's second input") ||
                        l.startsWith("Assistant's second response") ||
                        l.startsWith("User's third input") ||
                        l.startsWith('This could be') ||
                        l.startsWith('Acknowledge') ||
                        l.startsWith('Is there anything else') ||
                        l.startsWith('Hello again') ||
                        l.startsWith('Hello! Hello again') ||
                        l.startsWith('Hello! Welcome back')
                    ) return false;
                    return true;
                });
                text = filtered.join('\n').trim();
            }
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message ' + role;
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble markdown-body';
            if (role === 'user') {
                bubble.textContent = text;
            } else {
                // AI yanıtı düz metin olarak gösterilsin, markdown veya stil işaretleri olmadan
                bubble.textContent = text;
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
            else if (action.action === 'run_command') addCommandCard(action);
            else if (action.action === 'payment') addPaymentCard(action);
        }

        function bindActionCardButtons(card, cardId) {
            const keepBtn = card.querySelector('.action-keep-btn');
            if (keepBtn) {
                keepBtn.addEventListener('click', () => window.resolveCard(cardId, 'accept'));
            }

            const discardBtn = card.querySelector('.action-discard-btn');
            if (discardBtn) {
                discardBtn.addEventListener('click', () => window.resolveCard(cardId, 'reject'));
            }

            const previewBtn = card.querySelector('.action-preview-btn');
            if (previewBtn) {
                previewBtn.addEventListener('click', () => window.previewAction(cardId));
            }

            const undoBtn = card.querySelector('.action-undo-btn');
            if (undoBtn) {
                undoBtn.addEventListener('click', () => window.resolveCard(cardId, 'undo'));
            }
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
                    '<button class="btn btn-primary action-keep-btn">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn">Preview</button>' +
                    renderBtn +
                '</div>';
            card._actionData = action;
            bindActionCardButtons(card, cardId);
            appState.currentAiMessageElement.appendChild(card);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            if (appState.currentAiBubble) {
                appState.currentAiBubble.appendChild(card);
            } else {
                appState.currentAiMessageElement.appendChild(card);
            }
        }

        function addCommandCard(action) {
            const cardId = 'cmd-' + Math.random().toString(36).slice(2, 9);
            const card = document.createElement('div');
            card.className = 'command-card';
            card.dataset.actionId = cardId;
            card.innerHTML = \`
                <div class="command-header">
                    <span>Terminal Komutu</span>
                </div>
                <div class="command-body">
                    <div class="command-icon-bullet"></div>
                    <div class="command-text">\${escapeHtml(action.command)}</div>
                </div>
                <div class="command-actions" style="justify-content: flex-end; margin-top: 8px;">
                    <button class="btn btn-primary run-btn" style="padding: 4px 12px; font-size: 11px;">Onayla</button>
                    <button class="btn btn-secondary discard-btn" style="padding: 4px 12px; font-size: 11px;">Reddet</button>
                    <button class="command-btn popout-btn" title="Yeni Terminalde Aç" style="margin-left: 8px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                </div>
                <div class="command-output"></div>
            \`;
            card._actionData = action;
            
            const runBtn = card.querySelector('.run-btn');
            runBtn.addEventListener('click', () => {
                const output = card.querySelector('.command-output');
                output.textContent = '> Komut onaylandı, çalıştırılıyor...';
                output.classList.add('visible');
                runBtn.disabled = true;
                const dBtn = card.querySelector('.discard-btn');
                if (dBtn) dBtn.disabled = true;
                window.resolveCard(cardId, 'accept');
            });

            const discardBtn = card.querySelector('.discard-btn');
            discardBtn.addEventListener('click', () => {
                card.remove();
            });

            const popoutBtn = card.querySelector('.popout-btn');
            popoutBtn.addEventListener('click', () => {
                vscode.postMessage({ command: 'runCommand', actionId: cardId, command: action.command, cwd: action.cwd, newTerminal: true });
            });

            if (appState.currentAiBubble) {
                appState.currentAiBubble.appendChild(card);
            } else {
                appState.currentAiMessageElement.appendChild(card);
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        function addPaymentCard(action) {
            const cardId = 'pay-' + Math.random().toString(36).slice(2, 9);
            const card = document.createElement('div');
            card.className = 'payment-card';
            card.dataset.actionId = cardId;
            card.innerHTML = \`
                <div class="payment-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
                    <span>Yetersiz Token</span>
                </div>
                <div class="payment-desc">\${escapeHtml(action.message || 'Maalesef işleminiz için yeterli token bulunmuyor. Devam etmek için bakiye yükleyebilirsiniz.')}</div>
                <div class="action-footer" style="justify-content: center;">
                    <button class="btn btn-primary action-pay-btn" style="background: #fbbf24; color: #000;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="mr-4"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        Bakiye Yükle
                    </button>
                    <button class="btn btn-secondary action-discard-btn">Kapat</button>
                </div>
            \`;
            
            card.querySelector('.action-pay-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'openPurchase' });
            });

            card.querySelector('.action-discard-btn').addEventListener('click', () => {
                card.remove();
            });

            if (appState.currentAiBubble) {
                appState.currentAiBubble.appendChild(card);
            } else {
                appState.currentAiMessageElement.appendChild(card);
            }
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

            // Command Card özel durumu
            if (card && card.classList.contains('command-card')) {
                const output = card.querySelector('.command-output');
                if (output) {
                    output.textContent = msg;
                    output.classList.add('visible');
                    if (status === 'applied') output.style.color = '#2ecc71';
                    else if (status === 'error') output.style.color = '#e74c3c';
                }
                return;
            }
            card.querySelector('.action-status').textContent = msg || status;
            card.className = 'action-card ' + (status === 'applied' ? 'is-applied' : status === 'rejected' ? 'is-rejected' : status === 'reverted' ? '' : 'is-error');
            
            if (status === 'applied') {
                const footer = card.querySelector('.action-footer');
                footer.innerHTML = '<button class="btn btn-secondary action-undo-btn">Undo</button>';
                const action = card._actionData;
                if (action && action.render_url) {
                    footer.innerHTML += '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>';
                }
                bindActionCardButtons(card, aid);
            } else if (status === 'reverted') {
                const action = card._actionData;
                const renderBtn = action.render_url ? '<a class="btn btn-secondary" href="' + action.render_url + '" target="_blank">Render</a>' : '';
                card.querySelector('.action-footer').innerHTML = 
                    '<button class="btn btn-primary action-keep-btn">Keep</button>' +
                    '<button class="btn btn-secondary action-discard-btn">Discard</button>' +
                    '<button class="btn btn-secondary action-preview-btn">Preview</button>' +
                    renderBtn;
                bindActionCardButtons(card, aid);
            } else {
                card.querySelectorAll('button').forEach(b => b.disabled = true);
            }
        }

        function sendMsg() {
            const text = chatInput.value.trim();
            if (!text || appState.phase !== 'IDLE' || appState.isVerifying || appState.reconnecting) return;
            const session = getActiveSession();
            if (!session) return;
            addMessage(text, 'user');
            // Start a fresh AI container for this request before streaming begins.
            addMessage('', 'ai');
            chatInput.value = '';
            dispatch({ type: 'UX_ASK' });
            vscode.postMessage({
                command: 'ask',
                text,
                model: appState.selectedModel,
                sessionId: session.id,
                conversationId: session.backendConversationId || undefined
            });
        }

        if (sendBtn) {
            sendBtn.onclick = sendMsg;
        }
        if (stopBtn) {
            stopBtn.onclick = () => {
                vscode.postMessage({ command: 'stopAsk' });
            };
        }
        if (chatInput) {
            chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
        }
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = () => {
                vscode.postMessage({ command: 'login' });
            };
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
            if (s) {
                s.messages = [];
                s.title = 'Yeni Sohbet';
                s.updatedAt = nowIso();
                s.backendConversationId = '';
                s.isServerSession = false;
                setDefaultGreetingIfNeeded(s);
                renderActiveSession();
                renderHistory();
                persist();
            }
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

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                vscode.postMessage({ command: 'logout' });
            };
        }

        const balanceChip = document.getElementById('balance-chip');
        if (balanceChip) {
            balanceChip.onclick = () => {
                vscode.postMessage({ command: 'openPurchase' });
            };
        }

        init();
    </script>
</body>
</html>`;
}
