/**
 * CodeAlchemist VS Code Extension — Main Entry Point
 *
 * This is the slim orchestrator that wires together all modules:
 *  - workspaceContext  → collects workspace awareness data
 *  - apiClient         → communicates with the backend
 *  - actionHandler     → parses and applies AI-driven file edits
 *  - diffPreview       → shows diff preview before applying changes
 *  - statusBar         → manages the status bar with busy indicator
 *
 * Commands:
 *  - codeAlchemist.setApiKey       → Set/clear API key in SecretStorage
 *  - codeAlchemist.ask             → Send question + workspace context to AI
 *  - codeAlchemist.selectModel     → QuickPick model selector
 *  - codeAlchemist.toggleAgentMode → Toggle Agent / Chat mode
 *  - codeAlchemist.applyChanges    → Manually apply last AI action (if any)
 */
import * as vscode from 'vscode';
import type { ModelDefinition, AskRequestPayload, AiAction, FileChange } from './types.js';
import { getWorkspaceContext, getWorkspaceRoot } from './workspaceContext.js';
import type { WorkspaceContext } from './workspaceContext.js';
import { sendAskRequest } from './apiClient.js';
import { parseAiActions, applyFileEdit, applyMultiEdit, validateFilePath } from './actionHandler.js';
import { showDiffAndConfirm, showMultiDiffAndConfirm, getPreviewProviderDisposable, disposePreviewProvider } from './diffPreview.js';
import { createStatusBar } from './statusBar.js';
import { CodeAlchemistChatProvider } from './chatProvider.js';
import { HealthMonitor } from './healthMonitor.js';

// ── Constants ───────────────────────────────────────────────────────

const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';

const AVAILABLE_MODELS: ModelDefinition[] = [
  { value: 'auto', label: 'Auto (Smart Model)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
  { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Fast)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (New)' },
  { value: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B IT (Agent)' },
  { value: 'gemma-4-31b-it', label: 'Gemma 4 31B IT (Agent)' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude 4.5 Opus' },
];

// ── API Key Management ──────────────────────────────────────────────

async function readApiKey(context: vscode.ExtensionContext): Promise<string> {
  const fromSecrets = (await context.secrets.get(API_KEY_SECRET_NAME))?.trim();
  if (fromSecrets) {
    return fromSecrets;
  }

  // Backward compatibility: migrate legacy key from settings to SecretStorage.
  const fromSettings = (vscode.workspace.getConfiguration('codeAlchemist').get<string>('apiKey') || '').trim();
  if (fromSettings) {
    await context.secrets.store(API_KEY_SECRET_NAME, fromSettings);
    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('apiKey', '', vscode.ConfigurationTarget.Global);
    return fromSettings;
  }

  return '';
}

// ── Agent Trace Logger ──────────────────────────────────────────────

function logAgentTrace(
  agentOutput: vscode.OutputChannel,
  trace: Array<Record<string, unknown>>,
  changedFiles: Array<Record<string, unknown>>,
): void {
  if (trace.length === 0 && changedFiles.length === 0) {
    return;
  }

  agentOutput.appendLine('');
  agentOutput.appendLine('═══════════════════════════════════════════════════');
  agentOutput.appendLine('  AGENT EXECUTION TRACE');
  agentOutput.appendLine('═══════════════════════════════════════════════════');
  agentOutput.appendLine('');

  if (trace.length > 0) {
    for (const entry of trace) {
      const step = entry.step ?? '?';
      const tool = entry.tool ?? 'unknown';
      const duration = entry.duration_ms ? ` (${entry.duration_ms}ms)` : '';
      agentOutput.appendLine(`  Step ${step}: ${tool}${duration}`);

      if (entry.reasoning) {
        agentOutput.appendLine(`    💭 ${entry.reasoning}`);
      }
      if (entry.input) {
        const inputStr = typeof entry.input === 'string' ? entry.input : JSON.stringify(entry.input);
        agentOutput.appendLine(`    📥 Input: ${inputStr.slice(0, 200)}${inputStr.length > 200 ? '...' : ''}`);
      }
      if (entry.output) {
        const outputStr = typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output);
        agentOutput.appendLine(`    📤 Output: ${outputStr.slice(0, 200)}${outputStr.length > 200 ? '...' : ''}`);
      }
      agentOutput.appendLine('');
    }
  }

  if (changedFiles.length > 0) {
    agentOutput.appendLine('  📁 Changed Files:');
    for (const file of changedFiles) {
      const filePath = file.file || file.path || 'unknown';
      const action = file.action || 'modified';
      agentOutput.appendLine(`    • ${filePath} (${action})`);
    }
    agentOutput.appendLine('');
  }

  agentOutput.appendLine('═══════════════════════════════════════════════════');
  agentOutput.appendLine('');
}

function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

function buildCodeContext(question: string, wsContext: WorkspaceContext): string {
  if (wsContext.selectedCode?.trim()) {
    return wsContext.selectedCode;
  }

  const qLower = (question || '').toLowerCase();
  const asksForFileContent = /(dosya|file|markdown|\.md|readme|icerik|içerik|oku|read|ozet|özet|ozetle|özetle|summarize|summarise)\b/.test(qLower);
  if (!asksForFileContent) {
    return '';
  }

  const normalizedActive = normalizePathForCompare(wsContext.filePath || '');
  const normalizedRoot = normalizePathForCompare(wsContext.workspaceRoot || '');
  const activeRelative = normalizedRoot && normalizedActive.startsWith(`${normalizedRoot}/`)
    ? normalizedActive.slice(normalizedRoot.length + 1)
    : '';

  const activeSnapshot = wsContext.workspaceFiles.find((file) => {
    const normalizedSnapshotPath = normalizePathForCompare(file.path || '');
    return normalizedSnapshotPath === normalizedActive ||
      (activeRelative && normalizedSnapshotPath === activeRelative);
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

// ── Action Execution ────────────────────────────────────────────────

/**
 * Handles an AI action — shows diff preview and applies changes if approved.
 */
async function executeAiAction(
  action: AiAction,
  workspaceRoot: string,
  output: vscode.OutputChannel,
): Promise<void> {
  if (action.action === 'message') {
    // Just a text message, nothing to apply
    return;
  }

  if (action.action === 'edit_file') {
    // ── Single file edit ──────────────────────────────────────────
    const validationError = validateFilePath(workspaceRoot, action.file, action.trust_id);
    if (validationError) {
      vscode.window.showErrorMessage(`CodeAlchemist: ${validationError}`);
      output.appendLine(`⚠️ Rejected file edit: ${validationError}`);
      return;
    }

    output.appendLine(`\n📝 AI suggests editing: ${action.file}`);
    output.appendLine('Opening diff preview...');

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
        output.appendLine(`✅ Applied changes to ${action.file}`);
        vscode.window.showInformationMessage(`CodeAlchemist: Applied changes to ${action.file}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        output.appendLine(`❌ Failed to apply changes: ${msg}`);
        vscode.window.showErrorMessage(`CodeAlchemist: Failed to write ${action.file}: ${msg}`);
      }
    } else {
      output.appendLine(`⏭️ User rejected changes to ${action.file}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Changes to ${action.file} were rejected.`);
    }

    return;
  }

  if (action.action === 'multi_edit') {
    // ── Multi-file edit ───────────────────────────────────────────
    const validChanges: FileChange[] = [];

    for (const change of action.changes) {
      const validationError = validateFilePath(workspaceRoot, change.file, change.trust_id);
      if (validationError) {
        vscode.window.showErrorMessage(`CodeAlchemist: Skipping ${change.file} — ${validationError}`);
        output.appendLine(`⚠️ Skipped unsafe path: ${change.file}`);
      } else {
        validChanges.push(change);
      }
    }

    if (validChanges.length === 0) {
      output.appendLine('⚠️ No valid file changes to apply.');
      vscode.window.showWarningMessage('CodeAlchemist: All proposed file paths were invalid.');
      return;
    }

    output.appendLine(`\n📝 AI suggests editing ${validChanges.length} file(s):`);
    for (const c of validChanges) {
      output.appendLine(`   • ${c.file}`);
    }
    output.appendLine('Opening diff preview...');

    const result = await showMultiDiffAndConfirm(workspaceRoot, validChanges);

    if (result.approved.length > 0) {
      const { succeeded, failed } = await applyMultiEdit(workspaceRoot, result.approved);

      for (const file of succeeded) {
        output.appendLine(`✅ Applied: ${file}`);
      }
      for (const f of failed) {
        output.appendLine(`❌ Failed: ${f.file} — ${f.error}`);
        vscode.window.showErrorMessage(`CodeAlchemist: Failed to write ${f.file}: ${f.error}`);
      }

      const total = succeeded.length + failed.length;
      vscode.window.showInformationMessage(
        `CodeAlchemist: Applied ${succeeded.length}/${total} file(s). ${result.rejected.length} rejected.`,
      );
    }

    if (result.cancelledAll) {
      output.appendLine('🚫 User cancelled all remaining changes.');
    }

    return;
  }
}

// ── Extension Activation ────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const moveChatToRightSidebar = async () => {
    const moveCommands = [
      'workbench.action.moveViewToSecondarySidebar',
      'workbench.action.moveViewToSecondarySideBar',
    ];

    for (const commandId of moveCommands) {
      try {
        await vscode.commands.executeCommand(commandId, { viewId: CodeAlchemistChatProvider.viewType });
        return true;
      } catch {
        // Try a second signature used by older command implementations.
      }

      try {
        await vscode.commands.executeCommand(commandId, CodeAlchemistChatProvider.viewType);
        return true;
      } catch {
        // Ignore and keep trying.
      }
    }

    return false;
  };

  // ── Output Channels ─────────────────────────────────────────────
  const output = vscode.window.createOutputChannel('CodeAlchemist');
  const agentOutput = vscode.window.createOutputChannel('CodeAlchemist Agent');

  // ── Status Bar ──────────────────────────────────────────────────
  const statusBar = createStatusBar(AVAILABLE_MODELS);
  context.subscriptions.push(statusBar.item);
  HealthMonitor.getInstance().setOutput(output);

  // ── Sidebar Chat Provider ─────────────────────────────────────
  const chatProvider = new CodeAlchemistChatProvider(context.extensionUri, context, output);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CodeAlchemistChatProvider.viewType, chatProvider)
  );

  if (!context.globalState.get<boolean>('codeAlchemist.sidebarMovedRight')) {
    void moveChatToRightSidebar().then(async (moved) => {
      if (moved) {
        await context.globalState.update('codeAlchemist.sidebarMovedRight', true);
      }
    });
  }

  // ── Diff Preview Provider ───────────────────────────────────────
  const previewDisposable = getPreviewProviderDisposable();
  if (previewDisposable) {
    context.subscriptions.push(previewDisposable);
  }

  // ── Track last action for manual re-apply ──────────────────────
  let lastAiAction: AiAction | null = null;

  // ── Configuration Change Listener ──────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('codeAlchemist.model') || e.affectsConfiguration('codeAlchemist.agentMode')) {
        statusBar.update();
      }
    }),
  );

  // ── Command: Set API Key ──────────────────────────────────────
  const setApiKeyCmd = vscode.commands.registerCommand('codeAlchemist.setApiKey', async () => {
    const current = (await context.secrets.get(API_KEY_SECRET_NAME)) || '';
    const next = await vscode.window.showInputBox({
      title: 'CodeAlchemist API Key',
      prompt: 'Paste your ca-... API key',
      password: true,
      value: current,
      ignoreFocusOut: true,
    });
    if (typeof next !== 'string') {
      return;
    }

    const trimmed = next.trim();
    if (!trimmed) {
      await context.secrets.delete(API_KEY_SECRET_NAME);
      vscode.window.showInformationMessage('CodeAlchemist API key removed from SecretStorage.');
      return;
    }

    await context.secrets.store(API_KEY_SECRET_NAME, trimmed);
    await vscode.workspace
      .getConfiguration('codeAlchemist')
      .update('apiKey', '', vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('CodeAlchemist API key saved in SecretStorage.');
  });

  // ── Command: Select Model ─────────────────────────────────────
  const selectModelCmd = vscode.commands.registerCommand('codeAlchemist.selectModel', async () => {
    const items: vscode.QuickPickItem[] = AVAILABLE_MODELS.map(m => ({
      label: m.label,
      description: m.value,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select CodeAlchemist Model',
    });

    if (selected) {
      await vscode.workspace
        .getConfiguration('codeAlchemist')
        .update('model', selected.description, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`CodeAlchemist model set to ${selected.label}`);
    }
  });

  // ── Command: Toggle Agent Mode ────────────────────────────────
  const toggleAgentModeCmd = vscode.commands.registerCommand('codeAlchemist.toggleAgentMode', async () => {
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const current = cfg.get<boolean>('agentMode') ?? true;
    await cfg.update('agentMode', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`CodeAlchemist Agent Mode: ${!current ? 'ON' : 'OFF'}`);
  });

  // ── Command: Ask ──────────────────────────────────────────────
  const askCmd = vscode.commands.registerCommand('codeAlchemist.ask', async () => {
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const apiKey = await readApiKey(context);
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    const agentMode = cfg.get<boolean>('agentMode') ?? true;
    const model = cfg.get<string>('model') || 'gemini-2.5-flash';
    const projectId = cfg.get<number>('projectId');
    const workspaceFileLimit = cfg.get<number>('workspaceFileLimit') ?? 20;

    // ── Validate config ─────────────────────────────────────────
    if (!apiKey) {
      vscode.window.showErrorMessage('CodeAlchemist: API key missing. Run "CodeAlchemist: Set API Key".');
      return;
    }
    if (!endpoint) {
      vscode.window.showErrorMessage('CodeAlchemist: Endpoint is empty. Set codeAlchemist.endpoint in Settings.');
      return;
    }

    // ── Collect workspace context ────────────────────────────────
    const wsContext = await getWorkspaceContext(workspaceFileLimit);

    // ── Get user question ────────────────────────────────────────
    const question = await vscode.window.showInputBox({
      title: 'Ask CodeAlchemist',
      prompt: wsContext.selectedCode ? 'Question (selected code will be included)' : 'Question',
      ignoreFocusOut: true,
    });
    if (!question) {
      return;
    }

    const preparedQuestion = buildQuestionWithOutputConstraints(question, wsContext.filePath);

    // ── Prepare output ───────────────────────────────────────────
    output.clear();
    output.show(true);
    output.appendLine(`POST ${endpoint}`);
    output.appendLine(`Model: ${model} | Agent: ${agentMode ? 'ON' : 'OFF'}`);
    output.appendLine('');
    output.appendLine(`Question: ${question}`);

    if (wsContext.selectedCode) {
      output.appendLine('');
      output.appendLine('--- Selected code ---');
      output.appendLine(wsContext.selectedCode);
      output.appendLine('---');
    }

    if (wsContext.filePath) {
      output.appendLine(`Active file: ${wsContext.filePath}`);
    }
    if (wsContext.openFiles.length > 0) {
      output.appendLine(`Open files: ${wsContext.openFiles.length}`);
    }

    output.appendLine('');
    output.appendLine('⏳ Waiting for response...');

    // ── Build request payload ────────────────────────────────────
    const payload: AskRequestPayload = {
      question: preparedQuestion,
      code: buildCodeContext(question, wsContext),
      model,
      agent_mode: agentMode,
      allow_write_tools: true,
      file_path: wsContext.filePath,
      active_file: wsContext.filePath,
      workspace_root: wsContext.workspaceRoot,
      open_files: wsContext.openFiles,
      workspace_files: wsContext.workspaceFiles,
      project_id: typeof projectId === 'number' && projectId > 0 ? projectId : undefined,
      client_context: {
        source: 'vscode-extension',
        extension: 'code-alchemist',
        capabilities: {
          workspace_tools_preview: true,
          diff_preview: true,
          multi_edit: true,
        },
      },
    };

    output.appendLine(`Workspace snapshot: ${wsContext.workspaceFiles.length} files`);

    if (wsContext.filePath) {
      const normalizedActive = normalizePathForCompare(wsContext.filePath);
      const normalizedRoot = wsContext.workspaceRoot ? normalizePathForCompare(wsContext.workspaceRoot) : '';
      const activeRelative = normalizedRoot && normalizedActive.startsWith(`${normalizedRoot}/`)
        ? normalizedActive.slice(normalizedRoot.length + 1)
        : '';

      const activeSnapshot = wsContext.workspaceFiles.find((file) => {
        const normalizedSnapshotPath = normalizePathForCompare(file.path);
        return normalizedSnapshotPath === normalizedActive ||
          (activeRelative && normalizedSnapshotPath === activeRelative);
      });

      output.appendLine(`Active file included in snapshot: ${activeSnapshot ? 'yes' : 'no'}`);
      if (activeSnapshot) {
        output.appendLine(`Active snapshot path: ${activeSnapshot.path}`);
        output.appendLine(`Active snapshot chars: ${activeSnapshot.content.length}`);
        output.appendLine(`Active file outside workspace: ${activeRelative ? 'no' : 'yes'}`);
      }
    }

    // ── Send request with progress ───────────────────────────────
    statusBar.setBusy(true);

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodeAlchemist',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Sending request to AI...' });
          const askResult = await sendAskRequest(endpoint, apiKey, payload, output);

          // ── Log agent trace ──────────────────────────────────
          progress.report({ message: 'Processing response...' });

          if (askResult.agentTrace.length > 0 || askResult.agentChangedFiles.length > 0) {
            agentOutput.clear();
            agentOutput.show(true);
            logAgentTrace(
              agentOutput,
              askResult.agentTrace as Array<Record<string, unknown>>,
              askResult.agentChangedFiles as Array<Record<string, unknown>>,
            );
          }

          // ── Parse AI actions ─────────────────────────────────
          const action = parseAiActions(askResult.raw);
          if (action) {
            lastAiAction = action;
            progress.report({ message: 'Reviewing AI changes...' });

            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot) {
              vscode.window.showErrorMessage('CodeAlchemist: No workspace folder open. Cannot apply file changes.');
              output.appendLine('⚠️ No workspace folder — cannot apply changes.');
            } else {
              await executeAiAction(action, workspaceRoot, output);
            }
          }

          return askResult;
        },
      );

      // ── Completion notification ────────────────────────────────
      output.appendLine('');
      output.appendLine('✅ Done.');
      vscode.window.showInformationMessage(
        result.agentTrace.length > 0
          ? 'CodeAlchemist: Agent response received (see Output → CodeAlchemist Agent for trace).'
          : 'CodeAlchemist: Answer received (see Output → CodeAlchemist).',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.appendLine('');
      output.appendLine(`❌ Error: ${msg}`);
      vscode.window.showErrorMessage(`CodeAlchemist: ${msg}`);
    } finally {
      statusBar.setBusy(false);
    }
  });

  // ── Command: Apply Last Changes (manual re-apply) ─────────────
  const applyChangesCmd = vscode.commands.registerCommand('codeAlchemist.applyChanges', async () => {
    if (!lastAiAction || lastAiAction.action === 'message') {
      vscode.window.showInformationMessage('CodeAlchemist: No pending AI changes to apply.');
      return;
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('CodeAlchemist: No workspace folder open.');
      return;
    }

    await executeAiAction(lastAiAction, workspaceRoot, output);
  });

  // ── Command: Focus Chat ──────────────────────────────────────
  const focusChatCmd = vscode.commands.registerCommand('codeAlchemist.focusChat', async () => {
    await moveChatToRightSidebar();
    await vscode.commands.executeCommand('code-alchemist-chat.focus');
  });

  // ── Register disposables ──────────────────────────────────────
  context.subscriptions.push(
    output,
    agentOutput,
    setApiKeyCmd,
    askCmd,
    selectModelCmd,
    toggleAgentModeCmd,
    applyChangesCmd,
    focusChatCmd,
  );
}

// ── Deactivation ────────────────────────────────────────────────────

export function deactivate() {
  disposePreviewProvider();
}
