/**
 * Chat Provider - Implements the WebviewViewProvider for the sidebar chat.
 *
 * Handles:
 *  - Rendering the Chat UI.
 *  - Relaying messages between UI and API Client.
 *  - Extracting and applying AI actions.
 */
import * as vscode from 'vscode';
import { getChatWebviewContent } from './chatView.js';
import { getWorkspaceContext, getWorkspaceRoot } from './workspaceContext.js';
import { sendAskRequest } from './apiClient.js';
import { parseAiActions, validateFilePath, applyFileEdit, applyMultiEdit } from './actionHandler.js';
import { showDiffAndConfirm, showMultiDiffAndConfirm } from './diffPreview.js';
import type { AskRequestPayload, AiAction } from './types.js';
import type { WorkspaceContext } from './workspaceContext.js';

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

  if (!asksDateAtEnd && !asksForFileEdit) {
    return q;
  }

  const rules: string[] = [];

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

function buildLocalDateAppendFallbackAction(question: string, activeFilePath: string, workspaceRoot: string): AiAction | null {
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

  return {
    action: 'edit_file',
    file: filePath,
    operation: 'append',
    content: `${yyyy}-${mm}-${dd}`,
  };
}

export class CodeAlchemistChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-alchemist-chat';

  private _view?: vscode.WebviewView;

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
    const selectedModel = cfg.get<string>('model') || 'gemini-2.5-flash';
    webviewView.webview.html = getChatWebviewContent(webviewView.webview, this._extensionUri, {
      selectedModel,
      modelOptions: SIDEBAR_MODEL_OPTIONS,
    });

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'ask':
          await this._handleAsk(data.text, data.model);
          break;
        case 'applyAction':
          await this._handleApplyAction(data.action);
          break;
        case 'setModel':
          await this._handleSetModel(data.model);
          break;
      }
    });

    // Cleanup
    webviewView.onDidDispose(() => {
      this._view = undefined;
    });
  }

  private async _handleAsk(text: string, modelOverride?: string) {
    if (!this._view) return;

    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const apiKey = await this._readApiKey();
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    const configuredModel = cfg.get<string>('model') || 'gemini-2.5-flash';
    const selectedModel = typeof modelOverride === 'string' && modelOverride.trim()
      ? modelOverride.trim()
      : configuredModel;
    const hasModel = SIDEBAR_MODEL_OPTIONS.some((item) => item.value === selectedModel);
    const model = hasModel ? selectedModel : configuredModel;
    const agentMode = cfg.get<boolean>('agentMode') ?? true;
    const projectId = cfg.get<number>('projectId') ?? 0;
    const workspaceFileLimit = cfg.get<number>('workspaceFileLimit') ?? 20;

    if (!apiKey || !endpoint) {
      this._view.webview.postMessage({
        command: 'stream_chunk',
        text: '\n\n❌ API Key veya Endpoint eksik. Lütfen ayarlardan kontrol edin.',
      });
      return;
    }

    const wsContext = await getWorkspaceContext(workspaceFileLimit);

    const preparedQuestion = buildQuestionWithOutputConstraints(text, wsContext.filePath || undefined);

    const payload: AskRequestPayload = {
      question: preparedQuestion,
      code: buildCodeContext(text, wsContext),
      model,
      agent_mode: agentMode,
      allow_write_tools: true,
      file_path: wsContext.filePath || '',
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

    try {
      this._view.webview.postMessage({
        command: 'stream_chunk',
        text: `[Debug] Request => endpoint: ${endpoint}, model: ${model}, agent_mode: ${String(agentMode)}\n`,
      });

      // Create a custom output-like stream for the webview
      const mockOutput = {
        append: (chunk: string) => this._view?.webview.postMessage({ command: 'stream_chunk', text: chunk }),
        appendLine: (line: string) => this._view?.webview.postMessage({ command: 'stream_chunk', text: line + '\n' }),
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
        name: 'mock',
        replace: () => {}
      };

      const result = await sendAskRequest(endpoint, apiKey, payload, mockOutput as any);

      const meta = result.meta || {};
      const selectedModel = String(meta['selected_model'] ?? meta['model'] ?? model);
      const provider = String(meta['agent_provider'] ?? meta['provider'] ?? 'unknown');
      const effectiveAgentMode = String(meta['agent_mode'] ?? agentMode);
      const toolCapable = String(meta['agent_tool_capable'] ?? 'unknown');
      const firstSseRaw = typeof meta['debug_first_sse_data_raw'] === 'string'
        ? meta['debug_first_sse_data_raw']
        : '';

      this._view.webview.postMessage({
        command: 'stream_chunk',
        text: `\n[Debug] Response => selected_model: ${selectedModel}, provider: ${provider}, agent_mode: ${effectiveAgentMode}, tool_capable: ${toolCapable}\n`,
      });

      if (firstSseRaw) {
        this._view.webview.postMessage({
          command: 'stream_chunk',
          text: `[Debug] First SSE data => ${firstSseRaw}\n`,
        });
      }

      // Handle Trace Steps (Render timeline in sidebar)
      if (result.agentTrace && Array.isArray(result.agentTrace)) {
        for (const step of result.agentTrace) {
          this._view.webview.postMessage({
            command: 'trace_step',
            tool: step.tool || 'Step',
            reasoning: step.reasoning || step.input || ''
          });
        }
      }

      // Detect Actions
      const action = parseAiActions(result.raw);
      const fallbackAction = action ?? buildLocalDateAppendFallbackAction(text, wsContext.filePath || '', wsContext.workspaceRoot || '');

      if (fallbackAction) {
        if (!action) {
          this._view.webview.postMessage({
            command: 'stream_chunk',
            text: '\n\n[System]: Model aksiyon formatında dönmedi. İstek için lokal güvenli düzenleme aksiyonu hazırlandı.\n',
          });
        }
        this._view.webview.postMessage({
          command: 'action_found',
          action: fallbackAction
        });
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._view.webview.postMessage({
        command: 'stream_chunk',
        text: `\n\n❌ Hata: ${msg}`,
      });
    }
  }

  private async _handleSetModel(modelValue: string) {
    const nextModel = (modelValue || '').trim();
    const isAllowed = SIDEBAR_MODEL_OPTIONS.some((item) => item.value === nextModel);
    if (!isAllowed) {
      return;
    }

    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('model', nextModel, vscode.ConfigurationTarget.Global);
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
    }
  }

  private async _readApiKey(): Promise<string> {
    const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';
    return (await this._context.secrets.get(API_KEY_SECRET_NAME)) || '';
  }
}
