/**
 * Chat Provider - Implements the WebviewViewProvider for the sidebar chat.
 *
 * Handles:
 *  - Rendering the Chat UI.
 *  - Relaying messages between UI and API Client.
 *  - Extracting and applying AI actions.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { getChatWebviewContent } from './chatView.js';
import { getWorkspaceContext, getWorkspaceRoot } from './workspaceContext.js';
import { sendAskRequest, getBackendStatus, deriveEndpointRoot, getHistory, getConversationHistory, getVscodeOtp, cancelAskRequest } from './apiClient.js';
import { parseAiActions, validateFilePath, applyFileEdit, applyMultiEdit } from './actionHandler.js';
import { showDiffAndConfirm, showMultiDiffAndConfirm } from './diffPreview.js';
import type { AskRequestPayload, AiAction } from './types.js';
import type { WorkspaceContext } from './workspaceContext.js';
import { HealthMonitor } from './healthMonitor.js';

type SidebarModelOption = {
  value: string;
  label: string;
};

type AuthBroadcastOverrides = {
  isAuthenticated?: boolean;
  balance?: number;
  purchaseUrl?: string;
  error?: string;
  isVerifying?: boolean;
  reconnecting?: boolean;
};

type PersistedChatMessage = {
  role: 'user' | 'ai';
  text: string;
  createdAt: string;
};

type PersistedChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  messages: PersistedChatMessage[];
  backendConversationId?: string;
};

type PersistedChatState = {
  chatSessions: PersistedChatSession[];
  activeSessionId: string;
};

const CHAT_STATE_STORAGE_KEY_PREFIX = 'codeAlchemist.chatState.byUser.v1';
const CHAT_STATE_MAX_SESSIONS = 30;

const SIDEBAR_MODEL_OPTIONS: SidebarModelOption[] = [
  { value: 'auto', label: 'Auto (Smart Model)' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (New)' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT (Agent)' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT (Agent)' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus' },
];

function buildCodeContext(question: string, wsContext: WorkspaceContext): string {
  if (wsContext.selectedCode?.trim()) {
    return wsContext.selectedCode;
  }

  const qLower = (question || '').toLowerCase();
  const asksForFileContent = /(dosya|file|markdown|\.md|readme|icerik|içerik|oku|read|ozet|özet|ozetle|özetle|summarize|summarise)\b/.test(qLower);
  if (!asksForFileContent) {
    return '';
  }

  const normalizedActive = (wsContext.filePath || '').replace(/\\/g, '/');
  const normalizedRoot = (wsContext.workspaceRoot || '').replace(/\\/g, '/');
  const activeRelative =
    normalizedActive && normalizedRoot && normalizedActive.toLowerCase().startsWith((normalizedRoot + '/').toLowerCase())
      ? normalizedActive.slice(normalizedRoot.length + 1)
      : '';

  const activeSnapshot = wsContext.workspaceFiles.find((file) => {
    const candidate = (file.path || '').replace(/\\/g, '/');
    return Boolean(
      candidate && (
        candidate.toLowerCase() === normalizedActive.toLowerCase() ||
        (activeRelative && candidate.toLowerCase() === activeRelative.toLowerCase())
      )
    );
  });

  if (!activeSnapshot?.content) {
    return '';
  }

  return `Active file (${activeSnapshot.path}) content:\n${activeSnapshot.content}`;
}

function buildQuestionWithOutputConstraints(question: string, activeFilePath?: string): string {
  const q = question.trim();
  const qLower = q.toLowerCase();
  const asksForFileEdit =
    /(ekle|append|guncelle|güncelle|duzelt|düzelt|değiştir|degistir|yaz|sil|olustur|oluştur|insert|update|modify|edit|write|add)\b/.test(qLower) &&
    /(dosya|file|markdown|\.md|readme|sonuna|satir|satır|line|icerik|içerik)\b/.test(qLower);
  const asksDateAtEnd =
    (qLower.includes('sonuna') || qLower.includes('en sona') || qLower.includes('sona')) &&
    (qLower.includes('tarih') || qLower.includes('nisan') || qLower.includes('date'));

  const rules: string[] = [
    'Response rule: Return only the final user-facing answer. Do not include internal reasoning, tool chatter, scratchpad text, or meta lines like "let me check/read_file".',
  ];

  if (asksForFileEdit) {
    rules.push('Execution rule: This is a file-edit request. Do not explain steps. Use tools to perform the edit and return structured file changes (edit_file or multi_edit).');
    if (activeFilePath) {
      rules.push(`Execution rule: If the user did not provide a file path explicitly, target the active file: ${activeFilePath}.`);
    }
  }

  if (asksDateAtEnd) {
    rules.push('Output rule: Place the requested date line at the very end of the file content as the final line.');
  }

  return `${q}\n\n[${rules.join(' ')}]`;
}

function buildLocalDateAppendFallbackAction(question: string, activeFilePath: string, workspaceRoot: string, workspaceFiles: any[]): AiAction | null {
  const q = question.trim();
  const qLower = q.toLowerCase();
  const asksDateAtEnd =
    (qLower.includes('sonuna') || qLower.includes('en sona') || qLower.includes('sona') || qLower.includes('append')) &&
    (qLower.includes('tarih') || qLower.includes('date') || qLower.includes('bugünün') || qLower.includes('bugunun'));

  if (!asksDateAtEnd) {
    return null;
  }

  const fileMatch = q.match(/([A-Za-z0-9_./\\-]+\.md)\b/);
  let filePath = fileMatch ? fileMatch[1].replace(/\\/g, '/') : '';

  if (!filePath && activeFilePath) {
    const normalizedActive = activeFilePath.replace(/\\/g, '/');
    const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
    if (normalizedRoot && normalizedActive.toLowerCase().startsWith(normalizedRoot.toLowerCase() + '/')) {
      filePath = normalizedActive.slice(normalizedRoot.length + 1);
    } else {
      filePath = normalizedActive;
    }
  }

  if (!filePath) {
    return null;
  }

  const today = new Date();
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  let trust_id: string | undefined;
  if (workspaceFiles) {
    const match = workspaceFiles.find(f => f.path === filePath || (activeFilePath && f.path === activeFilePath.replace(/\\/g, '/')));
    if (match) trust_id = match.trust_id;
  }

  return {
    action: 'edit_file',
    file: filePath,
    operation: 'append',
    content: `${yyyy}-${mm}-${dd}`,
    trust_id
  };
}

async function readFileContentIfExists(filePath: string): Promise<{ exists: boolean; content: string }> {
  try {
    const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return { exists: true, content: new TextDecoder('utf-8').decode(raw) };
  } catch {
    return { exists: false, content: '' };
  }
}

function createLocalSessionId(): string {
  return `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export class CodeAlchemistChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-alchemist-chat';

  private _view?: vscode.WebviewView;
  private _isAskInFlight = false;
  private _activeRequestId: string = '';
  private _currentPhase: 'IDLE' | 'REQUEST_INITIATED' | 'REQUEST_STREAMING' | 'REQUEST_COMPLETED' | 'REQUEST_FAILED' | 'REQUEST_CANCELLED' = 'IDLE';
  private _trustMap: Map<string, string> = new Map(); // path -> trust_id
  private _activeAbortController?: AbortController;
  private _currentSessionId: string | undefined;
  private _currentUserIdentity: string = '';
  private _isAuthenticated: boolean = false;
  private _authError: string = '';
  private _balance: number = 0;
  private _purchaseUrl: string = '';
  private _isAuthVerifying: boolean = false;
  private _isAuthReconnecting: boolean = false;
  private _authRefreshRunId: number = 0;
  private _healthSub?: vscode.Disposable;
  private static _instances: Set<CodeAlchemistChatProvider> = new Set();

  public static refreshAll() {
    for (const inst of this._instances) {
      void inst.refreshAuthStatus();
    }
  }

  private _generateRequestId(): string {
    return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
  }

  private _normalizeUserIdentity(value?: string): string {
    return (value || '').trim().toLowerCase();
  }

  private _getChatStateStorageKey(userIdentity: string): string {
    const normalized = this._normalizeUserIdentity(userIdentity);
    const encoded = Buffer.from(normalized, 'utf8').toString('base64url');
    return `${CHAT_STATE_STORAGE_KEY_PREFIX}.${encoded}`;
  }

  private _createDefaultChatState(): PersistedChatState {
    const now = new Date().toISOString();
    const session: PersistedChatSession = {
      id: createLocalSessionId(),
      title: 'Yeni Sohbet',
      createdAt: now,
      updatedAt: now,
      pinned: false,
      messages: [],
    };

    return {
      chatSessions: [session],
      activeSessionId: session.id,
    };
  }

  private _sanitizePersistedChatState(raw: unknown): PersistedChatState {
    const source = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const sessions = Array.isArray(source.chatSessions) ? source.chatSessions : [];
    const normalizedSessions: PersistedChatSession[] = sessions
      .map((entry) => {
        const candidate = (entry && typeof entry === 'object') ? entry as Record<string, unknown> : {};
        const messages = Array.isArray(candidate.messages) ? candidate.messages : [];
        const normalizedMessages: PersistedChatMessage[] = messages
          .map((message) => {
            const item = (message && typeof message === 'object') ? message as Record<string, unknown> : {};
            const role = item.role === 'user' ? 'user' : item.role === 'ai' ? 'ai' : '';
            const text = typeof item.text === 'string' ? item.text : '';
            const createdAt = typeof item.createdAt === 'string' && item.createdAt.trim()
              ? item.createdAt
              : new Date().toISOString();

            if (!role) {
              return null;
            }

            return { role, text, createdAt };
          })
          .filter((message): message is PersistedChatMessage => Boolean(message));

        const id = typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id
          : createLocalSessionId();

        return {
          id,
          title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title : 'Yeni Sohbet',
          createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
            ? candidate.createdAt
            : new Date().toISOString(),
          updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
            ? candidate.updatedAt
            : new Date().toISOString(),
          pinned: Boolean(candidate.pinned),
          messages: normalizedMessages,
          backendConversationId: typeof candidate.backendConversationId === 'string' && candidate.backendConversationId.trim()
            ? candidate.backendConversationId
            : undefined,
        };
      })
      .filter((session) => Boolean(session))
      .slice(0, CHAT_STATE_MAX_SESSIONS);

    if (normalizedSessions.length === 0) {
      return this._createDefaultChatState();
    }

    const activeSessionId = typeof source.activeSessionId === 'string' && source.activeSessionId.trim()
      ? source.activeSessionId
      : normalizedSessions[0].id;

    return {
      chatSessions: normalizedSessions,
      activeSessionId: normalizedSessions.some((session) => session.id === activeSessionId)
        ? activeSessionId
        : normalizedSessions[0].id,
    };
  }

  private async _readPersistedChatState(userIdentity: string): Promise<PersistedChatState> {
    const key = this._getChatStateStorageKey(userIdentity);
    const raw = this._context.globalState.get<unknown>(key);
    return this._sanitizePersistedChatState(raw);
  }

  private async _writePersistedChatState(userIdentity: string, raw: unknown): Promise<void> {
    const normalized = this._normalizeUserIdentity(userIdentity);
    if (!normalized) {
      return;
    }

    const state = this._sanitizePersistedChatState(raw);
    const key = this._getChatStateStorageKey(normalized);
    await this._context.globalState.update(key, state);
  }

  private async _broadcastPersistedChatState(userIdentity?: string): Promise<void> {
    if (!this._view) {
      return;
    }

    const normalized = this._normalizeUserIdentity(userIdentity || this._currentUserIdentity) || 'local_guest';
    const state = await this._readPersistedChatState(normalized);
    await this._view.webview.postMessage({
      command: 'LOAD_PERSISTED_STATE',
      userKey: normalized,
      state,
    });
  }

  private async _handlePersistChatState(state: unknown): Promise<void> {
    const normalized = this._normalizeUserIdentity(this._currentUserIdentity) || 'local_guest';
    await this._writePersistedChatState(normalized, state);
  }

  private _broadcastSnapshot() {
    void this._postWebviewMessage({
      command: 'STATE_SNAPSHOT',
      requestId: this._activeRequestId,
      phase: this._currentPhase,
      health: HealthMonitor.getInstance().status,
      timestamp: Date.now()
    });
  }

  private _sendStateEvent(phase: typeof this._currentPhase, text?: string) {
    this._currentPhase = phase;
    void this._postWebviewMessage({
      command: 'STATE_EVENT',
      type: 'PHASE_TRANSITION',
      requestId: this._activeRequestId,
      phase: phase,
      text: text,
      timestamp: Date.now()
    });
  }

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    private readonly _output: vscode.OutputChannel,
  ) { 
    CodeAlchemistChatProvider._instances.add(this);
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    CodeAlchemistChatProvider._instances.add(this);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const healthMonitor = HealthMonitor.getInstance();
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const configuredModel = (cfg.get<string>('model') || '').trim();
    const selectedModel = this._resolveModel(configuredModel, 'auto');
    const html = getChatWebviewContent(webviewView.webview, this._extensionUri, {
      selectedModel,
      modelOptions: SIDEBAR_MODEL_OPTIONS,
      initialHealth: healthMonitor.status,
    });
    
    // DEBUG: Write HTML to file for inspection
    try {
      const debugPath = vscode.Uri.joinPath(this._extensionUri, 'webview_debug.html');
      await vscode.workspace.fs.writeFile(debugPath, Buffer.from(html, 'utf8'));
    } catch (e: any) {
      this._output.appendLine(`[Debug] Failed to write debug HTML: ${e.message}`);
    }

    webviewView.webview.html = html;

    this._broadcastSnapshot();
    void this._runAuthRefreshCycle();
    // ── Health Monitor Integration ─────────────────────────────


    // Push initial health state
    webviewView.webview.postMessage({
      command: 'HEALTH_STATUS',
      status: healthMonitor.status,
      timestamp: Date.now()
    });

    // Listen for health changes
    this._healthSub?.dispose();
    this._healthSub = healthMonitor.onStateChange((status) => {
      webviewView.webview.postMessage({
        command: 'HEALTH_STATUS',
        status: status,
        timestamp: Date.now()
      });
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'webviewReady':
          this._broadcastSnapshot();
          void this._runAuthRefreshCycle();
          // Await the health check first, then push the definitive status.
          // Without await, checkNow might silently skip firing if status hasn't
          // changed, leaving the webview permanently stuck on 'connecting'.
          healthMonitor.checkNow().then(() => {
            webviewView.webview.postMessage({
              command: 'HEALTH_STATUS',
              status: healthMonitor.status,
              timestamp: Date.now()
            });
          }).catch(() => {
            webviewView.webview.postMessage({
              command: 'HEALTH_STATUS',
              status: healthMonitor.status,
              timestamp: Date.now()
            });
          });
          break;

        case 'refreshAuthStatus':
          await this._runAuthRefreshCycle(true);
          break;
        case 'healthCheck':
          await healthMonitor.checkNow();
          webviewView.webview.postMessage({
            command: 'HEALTH_STATUS',
            status: healthMonitor.status,
            timestamp: Date.now()
          });
          break;
        case 'ask':
          if (typeof data.text !== 'string' || !data.text.trim()) {
            return;
          }
          await this._handleAsk(data.text, data.model, data.sessionId, data.conversationId);
          break;
        case 'persistChatState':
          await this._handlePersistChatState(data.state);
          break;
        case 'stopAsk':
          this._handleStopAsk();
          break;
        case 'applyAction':
          await this._handleApplyAction(data.action);
          break;
        case 'requestDeleteSession':
          await this._handleDeleteSession(data.sessionId, data.title);
          break;
        case 'resolveAction':
          await this._handleResolveAction(data.action, data.decision, data.actionId);
          break;
        case 'runCommand':
          await this._handleResolveAction({ action: 'run_command', command: data.command, cwd: data.cwd, newTerminal: data.newTerminal }, 'accept', data.actionId);
          break;
        case 'setModel':
          await this._handleSetModel(data.model);
          break;
        case 'login':
          await vscode.commands.executeCommand('codeAlchemist.login');
          break;
        case 'logout':
          await this._handleLogout();
          break;
        case 'fetchHistory':
          await this._syncHistory();
          break;
        case 'loadSession':
          await this._loadSessionDetails(data.sessionId);
          break;
        case 'log':
          this._output.appendLine(`[Webview] ${data.level || 'INFO'}: ${data.message}`);
          break;
        case 'openPurchase':
          await this._handleOpenPurchase();
          break;
      }
    });

    // Cleanup
    webviewView.onDidDispose(() => {
      this._healthSub?.dispose();
      this._healthSub = undefined;
      this._view = undefined;
      this._handleStopAsk(); // Abort in-flight requests
      CodeAlchemistChatProvider._instances.delete(this);
    });
  }

  private _setLoggedOutAuthState(message: string) {
    this._isAuthenticated = false;
    this._balance = 0;
    this._purchaseUrl = '';
    this._authError = message;
    this._currentUserIdentity = '';
  }

  private async _primeLocalAuthState(): Promise<void> {
    const hasKey = !!(await this._readApiKey());
    if (!hasKey) {
      this._setLoggedOutAuthState('Please login to continue.');
      return;
    }

    this._isAuthenticated = true;
    if (
      this._authError === 'Please login to continue.' ||
      this._authError === 'Logged out.'
    ) {
      this._authError = '';
    }
  }

  private async _runAuthRefreshCycle(reconnecting = false): Promise<void> {
    await this._primeLocalAuthState();
    this._isAuthVerifying = true;
    this._isAuthReconnecting = reconnecting;
    await this._broadcastAuthStatus();
    await this.refreshAuthStatus();

    if (this._isAuthVerifying) {
      this._isAuthVerifying = false;
      await this._broadcastAuthStatus();
    }
  }

  public async refreshAuthStatus() {
    const runId = ++this._authRefreshRunId;
    const apiKey = await this._readApiKey();
    const hasKey = !!apiKey;

    if (!hasKey) {
      this._setLoggedOutAuthState('Please login to continue.');
      this._isAuthVerifying = false;
      this._isAuthReconnecting = false;
      await this._broadcastAuthStatus();
      return;
    }

    this._isAuthenticated = true;
    if (
      this._authError === 'Please login to continue.' ||
      this._authError === 'Logged out.'
    ) {
      this._authError = '';
    }
    await this._broadcastAuthStatus();

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    if (!endpoint) {
      this._isAuthVerifying = false;
      this._isAuthReconnecting = true;
      this._authError = 'Endpoint yapılandırması eksik. Yeniden bağlanılıyor...';
      await this._broadcastAuthStatus();
      return;
    }

    try {
      const root = deriveEndpointRoot(endpoint);
      this._output.appendLine(`[Auth] Validating session at: ${root}/v1/status`);
      const status = await getBackendStatus(endpoint, apiKey);

      if (runId !== this._authRefreshRunId) {
        return;
      }

      if (status.status === 'unauthorized' || status.auth_state === 'unauthorized') {
        this._setLoggedOutAuthState('Oturum süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapın.');
        this._isAuthVerifying = false;
        this._isAuthReconnecting = false;
        await this._broadcastAuthStatus();
        return;
      }

      if (status.status === 'ok') {
        this._currentUserIdentity = this._normalizeUserIdentity(status.user);
        this._balance = status.balance ?? 0;
        this._purchaseUrl = status.purchase_url ?? '';
        this._isAuthenticated = true;
        this._authError = '';
        this._isAuthVerifying = false;
        this._isAuthReconnecting = false;
        this._output.appendLine(`[Auth] Updated local state: user=${status.user}, balance=${this._balance}`);
        await this._broadcastAuthStatus();
        await this._broadcastPersistedChatState(this._currentUserIdentity);
        return;
      }

      this._isAuthVerifying = false;
      this._isAuthReconnecting = true;
      this._authError = status.error
        ? `Oturum doğrulanamadı: ${status.error}`
        : 'Oturum doğrulaması gecikti. Yeniden bağlanılıyor...';
      await this._broadcastAuthStatus();
    } catch (err) {
      if (runId !== this._authRefreshRunId) {
        return;
      }

      this._output.appendLine(`[Auth] Background validation failed: ${err}`);
      console.warn('Background auth validation failed:', err);
      this._isAuthVerifying = false;
      this._isAuthReconnecting = true;
      this._authError = 'Oturum doğrulaması gecikti. Yeniden bağlanılıyor...';
      await this._broadcastAuthStatus();
    }
  }

  private async _handleLogout() {
    const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';
    await this._context.secrets.delete(API_KEY_SECRET_NAME);
    this._setLoggedOutAuthState('Logged out.');
    this._isAuthVerifying = false;
    this._isAuthReconnecting = false;
    this._currentSessionId = undefined;
    
    // Purge UI state in webview
    if (this._view) {
        this._view.webview.postMessage({ command: 'PURGE_STATE' });
    }
    
    CodeAlchemistChatProvider.refreshAll();
  }

  private async _syncHistory() {
    if (!this._view) return;
    const apiKey = await this._readApiKey();
    if (!apiKey) return;

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    if (!endpoint) return;

    try {
      const res = await getHistory(endpoint, apiKey);
      if (res.status === 'ok' && res.sessions) {
        this._view.webview.postMessage({
          command: 'HISTORY_LIST',
          sessions: res.sessions
        });
      }
    } catch (err) {
      console.error('Failed to sync history:', err);
    }
  }

  private async _loadSessionDetails(sessionId: string) {
    if (!this._view) return;
    const apiKey = await this._readApiKey();
    if (!apiKey) return;

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    if (!endpoint) return;

    try {
      const res = await getConversationHistory(endpoint, apiKey, sessionId);
      if (res.status === 'ok' && res.messages) {
        this._currentSessionId = sessionId;
        this._view.webview.postMessage({
          command: 'SESSION_DETAILS',
          sessionId,
          messages: res.messages
        });
      }
    } catch (err) {
      console.error('Failed to load session details:', err);
    }
  }

  private async _broadcastAuthStatus(overrides: AuthBroadcastOverrides = {}) {
    if (!this._view) return;

    const payload = {
      command: 'AUTH_STATUS',
      isAuthenticated: overrides.isAuthenticated ?? this._isAuthenticated,
      balance: overrides.balance ?? this._balance,
      purchaseUrl: overrides.purchaseUrl ?? this._purchaseUrl,
      error: overrides.error ?? this._authError,
      isVerifying: overrides.isVerifying ?? this._isAuthVerifying,
      reconnecting: overrides.reconnecting ?? this._isAuthReconnecting,
      userKey: this._currentUserIdentity,
      timestamp: Date.now()
    };

    try {
      const delivered = await this._view.webview.postMessage(payload);
      if (!delivered) {
        this._output.appendLine('[Auth] AUTH_STATUS was not delivered to the webview.');
      }
    } catch (err) {
      this._output.appendLine(`[Auth] Failed to broadcast auth status: ${String(err)}`);
    }
  }

  private async _postWebviewMessage(message: any): Promise<boolean> {
    if (!this._view) {
      return false;
    }
    try {
      return await this._view.webview.postMessage(message);
    } catch (err) {
      this._output.appendLine(`[Webview] postMessage failed: ${err}`);
      return false;
    }
  }

  private async _handleOpenPurchase() {
    if (this._purchaseUrl) {
        const apiKey = await this._readApiKey();
        const cfg = vscode.workspace.getConfiguration('codeAlchemist');
        const endpoint = (cfg.get<string>('endpoint') || '').trim();

        if (apiKey && endpoint) {
            this._output.appendLine('[Auth] Generating OTP for secure session transfer...');
            const otpRes = await getVscodeOtp(endpoint, apiKey);
            if (otpRes.status === 'ok') {
                const separator = this._purchaseUrl.includes('?') ? '&' : '?';
                const secureUrl = `${this._purchaseUrl}${separator}auth_otp=${otpRes.otp}`;
                await vscode.env.openExternal(vscode.Uri.parse(secureUrl));
                return;
            }
            this._output.appendLine(`[Auth] OTP generation failed: ${otpRes.error}. Falling back to standard URL.`);
        }

        await vscode.env.openExternal(vscode.Uri.parse(this._purchaseUrl));
    }
  }

  private async _handleAsk(
    text: string,
    modelOverride?: string,
    sessionId?: string,
    conversationId?: string,
  ) {
    if (!this._view) return;

    if (this._isAskInFlight) {
      this._view.webview.postMessage({
        command: 'stream_chunk',
        requestId: this._activeRequestId,
        text: '\n\n⏳ Önceki istek halen işleniyor. Lütfen tamamlanmasını bekleyin.',
      });
      return;
    }

    this._isAskInFlight = true;
    this._activeRequestId = this._generateRequestId();
    this._activeAbortController = new AbortController();
    this._sendStateEvent('REQUEST_INITIATED', 'Checking connection...');

    // ── Immediate Health Check ─────────────────────────────────
    const healthMonitor = HealthMonitor.getInstance();
    await healthMonitor.checkNow();

    if (healthMonitor.status === 'offline') {
      this._isAskInFlight = false;
      this._view.webview.postMessage({
        command: 'stream_chunk',
        requestId: this._activeRequestId,
        text: '\n\n❌ **Bağlantı Hatası:** Backend sunucusuna ulaşılamıyor. Lütfen yerel sunucunuzun (localhost:5000) çalıştığından emin olun.',
      });
      this._sendStateEvent('REQUEST_FAILED', 'Sunucu çevrimdışı.');
      return;
    }

    this._sendStateEvent('REQUEST_INITIATED', 'Working...');

    try {
      const cfg = vscode.workspace.getConfiguration('codeAlchemist');
      const apiKey = await this._readApiKey();
      const endpoint = (cfg.get<string>('endpoint') || '').trim();
      const configuredModel = (cfg.get<string>('model') || '').trim();
      const requestedModel = typeof modelOverride === 'string' ? modelOverride.trim() : '';
      const model = this._resolveModel(requestedModel, this._resolveModel(configuredModel, 'auto'));
      const agentMode = cfg.get<boolean>('agentMode') ?? true;
      const projectId = cfg.get<number>('projectId') ?? 0;
      const workspaceFileLimit = cfg.get<number>('workspaceFileLimit') ?? 20;

      if (!apiKey || !endpoint) {
        this._view.webview.postMessage({
          command: 'stream_chunk',
          requestId: this._activeRequestId,
          text: '\n\n❌ API Key veya Endpoint eksik. Lütfen ayarlardan kontrol edin.',
        });
        this._sendStateEvent('REQUEST_FAILED', 'Ayarlar eksik.');
        return;
      }

      // ── 💰 UI-Side Token Guard ────────────────────────────────
      if (this._isAuthenticated && this._balance <= 0) {
        this._view.webview.postMessage({
          command: 'action_found',
          requestId: this._activeRequestId,
          action: {
            action: 'payment',
            message: 'Bakiyeniz tükendiği için yeni istek yapamazsınız. Devam etmek için bakiye yüklemeniz gerekmektedir.'
          },
        });
        this._sendStateEvent('REQUEST_FAILED', 'Yetersiz bakiye.');
        return;
      }

      const wsContext = await getWorkspaceContext(workspaceFileLimit);

      // Update Trust Map for recovery
      this._trustMap.clear();
      wsContext.workspaceFiles.forEach(f => {
        this._trustMap.set(f.path, f.trust_id || '');
        // Also store absolute path if available for recovery
        const abs = path.resolve(wsContext.workspaceRoot, f.path);
        this._trustMap.set(abs.replace(/\\/g, '/'), f.trust_id || '');
        this._trustMap.set(abs, f.trust_id || '');
      });

      const preparedQuestion = buildQuestionWithOutputConstraints(text, wsContext.filePath || undefined);

      const payload: AskRequestPayload = {
        question: preparedQuestion,
        code: buildCodeContext(text, wsContext),
        model,
        agent_mode: agentMode,
        stream: !agentMode,
        allow_write_tools: true,
        include_previous_modules: true,
        file_path: wsContext.filePath || '',
        active_file: wsContext.filePath || '',
        workspace_root: wsContext.workspaceRoot || '',
        open_files: wsContext.openFiles || [],
        workspace_files: wsContext.workspaceFiles,
        conversation_id: typeof conversationId === 'string' && conversationId.trim()
          ? conversationId.trim()
          : this._currentSessionId,
        session_id: typeof sessionId === 'string' && sessionId.trim()
          ? sessionId.trim()
          : undefined,
        request_id: this._activeRequestId,
        client_context: {
          source: 'vscode-extension-sidebar',
          extension: 'code-alchemist',
          capabilities: {
            workspace_tools_preview: true,
            diff_preview: true,
            multi_edit: true,
          },
        },
      };

      if (Number.isFinite(projectId) && projectId > 0) {
        payload.project_id = projectId;
      }

      // Create a custom output-like stream for the webview
      const rid = this._activeRequestId;
      const mockOutput = {
        append: (chunk: string) => {
          if (this._currentPhase !== 'REQUEST_STREAMING') {
            this._sendStateEvent('REQUEST_STREAMING');
          }
          this._view?.webview.postMessage({ command: 'stream_chunk', requestId: rid, text: chunk });
        },
        appendLine: (line: string) => {
          if (this._currentPhase !== 'REQUEST_STREAMING') {
            this._sendStateEvent('REQUEST_STREAMING');
          }
          this._view?.webview.postMessage({ command: 'stream_chunk', requestId: rid, text: line + '\n' });
        },
        clear: () => { },
        show: () => { },
        hide: () => { },
        dispose: () => { },
        name: 'mock',
        replace: () => { }
      };

      const result = await sendAskRequest(
        endpoint,
        apiKey,
        payload,
        mockOutput as any,
        this._activeAbortController.signal,
        {
          preferJson: agentMode,
          onMeta: (meta) => {
            if (meta.balance !== undefined) {
              this._view?.webview.postMessage({
                command: 'UPDATE_BALANCE',
                balance: meta.balance,
                purchase_url: meta.purchase_url || ''
              });
            }
          }
        },
      );

      // 💰 Update local balance and broadcast to webview
      if (typeof result.balance === "number") {
        this._balance = result.balance;
        void this._broadcastAuthStatus();
      }

      // 📜 Update Session ID for continuous conversation
      if (result.raw?.conversation_id) {
        this._currentSessionId = String(result.raw.conversation_id);
        if (this._view && typeof sessionId === 'string' && sessionId.trim()) {
          this._view.webview.postMessage({
            command: 'SESSION_LINKED',
            sessionId: sessionId.trim(),
            conversationId: this._currentSessionId,
          });
        }
      }

      // Handle Trace Steps (Render timeline in sidebar)
      if (result.agentTrace && Array.isArray(result.agentTrace)) {
        for (const step of result.agentTrace) {
          this._view.webview.postMessage({
            command: 'trace_step',
            requestId: rid,
            tool: step.tool || 'Step',
            reasoning: step.reasoning || step.input || ''
          });
        }
      }

      // Detect Actions
      const action = parseAiActions(result.raw);
      const fallbackAction = action ?? buildLocalDateAppendFallbackAction(text, wsContext.filePath || '', wsContext.workspaceRoot || '', wsContext.workspaceFiles);

      if (fallbackAction) {
        if (!action) {
          this._view.webview.postMessage({
            command: 'stream_chunk',
            text: '\n\n[System]: Model aksiyon formatında dönmedi. İstek için lokal güvenli düzenleme aksiyonu hazırlandı.\n',
          });
        }

        const reviewAction = await this._buildReviewAction(wsContext.workspaceRoot || '', fallbackAction);
        this._view.webview.postMessage({
          command: 'action_found',
          requestId: rid,
          action: reviewAction,
        });
      }

    } catch (err: any) {
      // 🔄 Sync balance even on error/abort (Reactive fallback)
      void this.refreshAuthStatus();

      if (this._activeAbortController?.signal.aborted) {
        this._view.webview.postMessage({
          command: 'stream_chunk',
          requestId: this._activeRequestId,
          text: '\n\n⏹️ Yanıt durduruldu.',
        });

        // If the error object has a balance (from our 499 response), update it immediately
        if (err?.balance !== undefined) {
          this._balance = err.balance;
          void this._broadcastAuthStatus();
        }

        this._sendStateEvent('REQUEST_CANCELLED', 'Yanıt durduruldu.');
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      const balance = err?.balance;
      
      if (balance !== undefined) {
        this._balance = balance;
        void this._broadcastAuthStatus();
      }
      
      // Specialized handling for Insufficient Balance (HTTP 402)
      if (msg.includes('402')) {
        this._view.webview.postMessage({
          command: 'action_found',
          requestId: this._activeRequestId,
          action: {
            action: 'payment',
            message: msg.replace(/Backend returned 402: /i, '')
          },
        });
        this._sendStateEvent('REQUEST_FAILED', 'Yetersiz bakiye.');
      } else {
        this._view.webview.postMessage({
          command: 'stream_chunk',
          requestId: this._activeRequestId,
          text: `\n\n❌ Hata: ${msg === 'Backend error' ? 'Sunucu tarafında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin veya sistem yöneticisine başvurun.' : msg}`,
        });
        this._sendStateEvent('REQUEST_FAILED', 'İstek başarısız oldu.');
      }
    } finally {
      this._isAskInFlight = false;
      this._activeAbortController = undefined;
      this._sendStateEvent('IDLE');
    }
  }

  private async _handleStopAsk() {
    if (!this._isAskInFlight) {
      return;
    }
    
    // Capture the exact request that is being stopped to prevent race conditions
    const rid = this._activeRequestId;
    const abortCtrl = this._activeAbortController;
    
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = (cfg.get<string>('endpoint') || 'http://localhost:5000').trim();
    const apiKey = await this._readApiKey(); // Use await for reliable key access

    console.log(`[STOP] Manually stopping request: ${rid}`);
    
    // 🛑 Signal 1: Local cancellation
    abortCtrl?.abort();
    
    // 🛑 Signal 2: Backend cancellation
    if (rid && apiKey) {
        // Notify backend to kill the agent process
        await cancelAskRequest(endpoint, apiKey, rid).catch(e => console.error('[CANCEL] signal failed:', e));
        
        // Final sync: Pull balance after stop signal is confirmed processed by backend
        setTimeout(() => void this.refreshAuthStatus(), 500);
    }
  }

  private async _handleSetModel(modelValue: string) {
    const nextModel = this._resolveModel((modelValue || '').trim(), '');
    if (!nextModel) {
      return;
    }

    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('model', nextModel, vscode.ConfigurationTarget.Global);
  }

  private _resolveModel(candidate: string, fallback: string): string {
    const normalizedCandidate = (candidate || '').trim();
    if (normalizedCandidate && SIDEBAR_MODEL_OPTIONS.some((item) => item.value === normalizedCandidate)) {
      return normalizedCandidate;
    }

    const normalizedFallback = (fallback || '').trim();
    if (normalizedFallback && SIDEBAR_MODEL_OPTIONS.some((item) => item.value === normalizedFallback)) {
      return normalizedFallback;
    }

    return SIDEBAR_MODEL_OPTIONS[0]?.value || 'auto';
  }

  private async _handleDeleteSession(sessionId: string, title?: string) {
    if (!this._view || typeof sessionId !== 'string' || !sessionId.trim()) {
      console.warn('CodeAlchemist: requestDeleteSession called with invalid sessionId or missing view.');
      return;
    }

    const resolvedTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Yeni Sohbet';

    console.log(`CodeAlchemist: Confirmation request for session delete: ${sessionId} (${resolvedTitle})`);

    const choice = await vscode.window.showWarningMessage(
      `"${resolvedTitle}" sohbetini silmek istiyor musunuz?`,
      { modal: true },
      'Sil',
      'İptal',
    );

    if (choice !== 'Sil') {
      return;
    }

    this._view.webview.postMessage({
      command: 'session_deleted',
      sessionId,
    });
  }

  private async _buildReviewAction(workspaceRoot: string, action: AiAction): Promise<AiAction> {
    if (action.action === 'message') {
      return action;
    }

    if (action.action === 'multi_edit') {
      const changes = await Promise.all(action.changes.map(async (change) => {
        const absPath = path.resolve(workspaceRoot, change.file);
        const original = await readFileContentIfExists(absPath);
        return {
          ...change,
          originalContent: original.content,
          originalExists: original.exists,
        };
      }));
      return { action: 'multi_edit', changes };
    }

    if (action.action !== 'edit_file') {
      return action;
    }

    // Trust Recovery: If trust_id is missing, try to restore from map
    if (!action.trust_id) {
      const recoveredId = this._trustMap.get(action.file) || this._trustMap.get(action.file.replace(/\\/g, '/'));
      if (recoveredId) {
        action.trust_id = recoveredId;
      }
    }

    const absPath = path.resolve(workspaceRoot, action.file);
    const original = await readFileContentIfExists(absPath);
    return {
      ...action,
      originalContent: original.content,
      originalExists: original.exists,
    };
  }

  private async _handleResolveAction(action: AiAction, decision: string, actionId?: string) {
    if (!this._view) return;

    if (decision === 'reject') {
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'rejected',
        message: 'Reddedildi',
      });
      return;
    }

    if (action.action === 'run_command') {
      try {
        const cmd = action.command || (action as any).script || '';
        if (!cmd) throw new Error('Komut içeriği boş.');

        let terminal;
        if (action.newTerminal) {
           terminal = vscode.window.createTerminal({
              name: `CodeAlchemist (${new Date().toLocaleTimeString()})`,
              cwd: action.cwd
           });
        } else {
           terminal = vscode.window.terminals.find(t => t.name === 'CodeAlchemist (bash)');
           if (!terminal) {
             try {
               terminal = vscode.window.createTerminal({
                 name: 'CodeAlchemist (bash)',
                 shellPath: 'bash',
                 cwd: action.cwd
               });
             } catch (e) {
               terminal = vscode.window.createTerminal({
                 name: 'CodeAlchemist (bash)',
                 cwd: action.cwd
               });
             }
           }
        }
        
        terminal.show(true); // show and take focus
        terminal.sendText(cmd);
        
        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: 'applied',
          message: 'Komut bash terminaline gönderildi.',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: 'error',
          message: `Komut çalıştırılamadı: ${msg}`,
        });
      }
      return;
    }

    if (action.action !== 'edit_file') {
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'error',
        message: 'Bu aksiyon türü doğrudan kabul için desteklenmiyor.',
      });
      return;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'error',
        message: 'Workspace bulunamadı.',
      });
      return;
    }

    const validationError = validateFilePath(workspaceRoot, action.file, action.trust_id);
    if (validationError) {
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'error',
        message: validationError,
      });
      return;
    }

    try {
      const isUndo = decision === 'undo';
      const revertChange = isUndo
        ? {
          file: action.file,
          content: typeof action.originalContent === 'string' ? action.originalContent : '',
          operation: 'replace',
          trust_id: action.trust_id,
          trust_scope: action.trust_scope,
        }
        : {
          file: action.file,
          content: action.content,
          operation: action.operation,
          trust_id: action.trust_id,
          trust_scope: action.trust_scope,
        };

      if (isUndo && action.originalExists === false) {
        const absPath = path.resolve(workspaceRoot, action.file);
        await vscode.workspace.fs.delete(vscode.Uri.file(absPath), { recursive: false, useTrash: false });
        this._view.webview.postMessage({
          command: 'action_result',
          actionId,
          status: 'reverted',
          message: `Geri alındı: ${action.file}`,
        });
        return;
      }

      await applyFileEdit(workspaceRoot, {
        ...revertChange,
      });

      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: isUndo ? 'reverted' : 'applied',
        message: isUndo ? `Geri alındı: ${action.file}` : `Uygulandı: ${action.file}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._view.webview.postMessage({
        command: 'action_result',
        actionId,
        status: 'error',
        message: msg,
      });
    }
  }

  private async _handleApplyAction(action: AiAction) {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('CodeAlchemist: Workspace bulunamadı.');
      return;
    }

    if (action.action === 'multi_edit') {
      const validChanges = action.changes.filter(change => !validateFilePath(workspaceRoot, change.file, change.trust_id));
      if (validChanges.length === 0) {
        vscode.window.showErrorMessage('CodeAlchemist: Uygulanabilir dosya değişikliği bulunamadı.');
        return;
      }

      const reviewResult = await showMultiDiffAndConfirm(workspaceRoot, validChanges);
      if (reviewResult.approved.length === 0) {
        vscode.window.showInformationMessage('CodeAlchemist: Çoklu değişiklik uygulanmadı.');
        return;
      }

      const { succeeded, failed } = await applyMultiEdit(workspaceRoot, reviewResult.approved);
      if (succeeded.length > 0) {
        vscode.window.showInformationMessage(`CodeAlchemist: ${succeeded.length} dosyada değişiklik uygulandı.`);
      }
      if (failed.length > 0) {
        const first = failed[0];
        vscode.window.showErrorMessage(`CodeAlchemist: ${failed.length} dosya uygulanamadı. İlk hata: ${first.file} -> ${first.error}`);
      }
      return;
    }

    if (action.action !== 'edit_file') return;

    const validationError = validateFilePath(workspaceRoot, action.file, action.trust_id);
    if (validationError) {
      vscode.window.showErrorMessage(`CodeAlchemist: ${validationError}`);
      return;
    }

    const approved = await showDiffAndConfirm(workspaceRoot, action.file, action.content, action.operation);
    if (approved) {
      try {
        await applyFileEdit(workspaceRoot, {
          file: action.file,
          content: action.content,
          operation: action.operation,
          trust_id: action.trust_id,
          trust_scope: action.trust_scope,
        });
        vscode.window.showInformationMessage(`CodeAlchemist: Değişiklik uygulandı - ${action.file}`);
      } catch (err) {
        vscode.window.showErrorMessage(`CodeAlchemist: Uygulanırken hata oluştu - ${String(err)}`);
      }
    } else {
      vscode.window.showInformationMessage(`CodeAlchemist: Değişiklik reddedildi - ${action.file}`);
    }
  }

  private async _readApiKey(): Promise<string> {
    const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';
    return (await this._context.secrets.get(API_KEY_SECRET_NAME)) || '';
  }
}
