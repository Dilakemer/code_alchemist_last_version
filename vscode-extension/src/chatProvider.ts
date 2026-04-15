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
import { sendAskRequest } from './apiClient.js';
import { parseAiActions, validateFilePath, applyFileEdit, applyMultiEdit } from './actionHandler.js';
import { showDiffAndConfirm, showMultiDiffAndConfirm } from './diffPreview.js';
import type { AskRequestPayload, AiAction } from './types.js';
import type { WorkspaceContext } from './workspaceContext.js';
import { HealthMonitor } from './healthMonitor.js';

type SidebarModelOption = {
  value: string;
  label: string;
};

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

export class CodeAlchemistChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-alchemist-chat';

  private _view?: vscode.WebviewView;
  private _isAskInFlight = false;
  private _activeRequestId: string = '';
  private _currentPhase: 'IDLE' | 'REQUEST_INITIATED' | 'REQUEST_STREAMING' | 'REQUEST_COMPLETED' | 'REQUEST_FAILED' | 'REQUEST_CANCELLED' = 'IDLE';
  private _trustMap: Map<string, string> = new Map(); // path -> trust_id
  private _activeAbortController?: AbortController;

  private _generateRequestId(): string {
      return 'req-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
  }

  private _broadcastSnapshot() {
      if (!this._view) return;
      this._view.webview.postMessage({
          command: 'STATE_SNAPSHOT',
          requestId: this._activeRequestId,
          phase: this._currentPhase,
          timestamp: Date.now()
      });
  }

  private _sendStateEvent(phase: typeof this._currentPhase, text?: string) {
      if (!this._view) return;
      this._currentPhase = phase;
      this._view.webview.postMessage({
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
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const configuredModel = (cfg.get<string>('model') || '').trim();
    const selectedModel = this._resolveModel(configuredModel, 'auto');
    webviewView.webview.html = getChatWebviewContent(webviewView.webview, this._extensionUri, {
      selectedModel,
      modelOptions: SIDEBAR_MODEL_OPTIONS,
    });

    // Broadcast initial state snapshot immediately
    this._broadcastSnapshot();

    // ── Health Monitor Integration ─────────────────────────────
    const healthMonitor = HealthMonitor.getInstance();
    
    // Push initial health state
    webviewView.webview.postMessage({
        command: 'HEALTH_STATUS',
        status: healthMonitor.status,
        timestamp: Date.now()
    });

    // Listen for health changes
    const healthSub = healthMonitor.onStateChange((status) => {
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
          webviewView.webview.postMessage({
            command: 'HEALTH_STATUS',
            status: healthMonitor.status,
            timestamp: Date.now()
          });
          void healthMonitor.checkNow().then(() => {
            webviewView.webview.postMessage({
              command: 'HEALTH_STATUS',
              status: healthMonitor.status,
              timestamp: Date.now()
            });
          });
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
          await this._handleAsk(data.text, data.model);
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
        case 'setModel':
          await this._handleSetModel(data.model);
          break;
      }
    });

    // Cleanup
    webviewView.onDidDispose(() => {
      healthSub.dispose();
      this._view = undefined;
    });
  }

  private async _handleAsk(text: string, modelOverride?: string) {
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
        file_path: wsContext.filePath || '',
        active_file: wsContext.filePath || '',
        workspace_root: wsContext.workspaceRoot || '',
        open_files: wsContext.openFiles || [],
        workspace_files: wsContext.workspaceFiles,
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
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
        name: 'mock',
        replace: () => {}
      };

      const result = await sendAskRequest(
        endpoint,
        apiKey,
        payload,
        mockOutput as any,
        this._activeAbortController.signal,
        { preferJson: agentMode },
      );

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

    } catch (err) {
      if (this._activeAbortController?.signal.aborted) {
        this._view.webview.postMessage({
          command: 'stream_chunk',
          requestId: this._activeRequestId,
          text: '\n\n⏹️ Yanıt durduruldu.',
        });
        this._sendStateEvent('REQUEST_CANCELLED', 'Yanıt durduruldu.');
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      this._view.webview.postMessage({
        command: 'stream_chunk',
        requestId: this._activeRequestId,
        text: `\n\n❌ Hata: ${msg}`,
      });
      this._sendStateEvent('REQUEST_FAILED', 'İstek başarısız oldu.');
    } finally {
      this._isAskInFlight = false;
      this._activeAbortController = undefined;
      this._sendStateEvent('IDLE');
    }
  }

  private _handleStopAsk() {
    if (!this._isAskInFlight) {
      return;
    }
    this._activeAbortController?.abort();
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
