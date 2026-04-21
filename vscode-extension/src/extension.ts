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
import * as path from 'path';
import type { ModelDefinition, AskRequestPayload, AiAction, FileChange } from './types.js';
import { getWorkspaceContext, getWorkspaceRoot, registerWorkspaceCacheListeners } from './workspaceContext.js';
import type { WorkspaceContext } from './workspaceContext.js';
import { sendAskRequest } from './apiClient.js';
import { parseAiActions, applyFileEdit, applyMultiEdit, validateFilePath } from './actionHandler.js';
import { showDiffAndConfirm, showMultiDiffAndConfirm, showMultiDiffUnifiedPreview, getPreviewProviderDisposable, disposePreviewProvider } from './diffPreview.js';
import { createStatusBar } from './statusBar.js';
import { CodeAlchemistChatProvider } from './chatProvider.js';
import { HealthMonitor } from './healthMonitor.js';

type TaskType = 'code' | 'analysis';

// ── Constants ───────────────────────────────────────────────────────

const API_KEY_SECRET_NAME = 'codeAlchemist.apiKey';

/** Max characters per file content in the payload (~750 tokens). */
const MAX_FILE_CHARS = 3000;

/** Context cache TTL — event-based invalidation is primary, TTL is a safety net. */
const CONTEXT_CACHE_TTL_MS = 30_000;

// ── Workspace Context Cache ──────────────────────────────────────────
let wsContextCache: { data: WorkspaceContext; ts: number; limit: number } | null = null;

function invalidateContextCache(): void {
  wsContextCache = null;
}

// ── Token Estimator ──────────────────────────────────────────────────
function estimateTokens(payload: AskRequestPayload): number {
  return Math.round(JSON.stringify(payload).length / 4);
}

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

function routeTaskType(question: string): TaskType {
  const q = (question || '').toLowerCase();

  const editPattern = /(edit|modify|change|update|fix|correct|replace|düzenle|degistir|değiştir|güncelle|guncelle|düzelt|duzelt|tamir|incele.*düzelt|incele.*duzelt|hata.*düzelt|hata.*duzelt)/;
  const analysisPattern = /(incele|analiz|analyze|analysis|review|degerlendir|değerlendir|root cause|neden|why|explain|açıkla|ozet|özet|summarize|summary|compare|karşılaştır|karsilastir|yorumla|planla|planing|planning|prd)/;
  if (editPattern.test(q)) {
    return 'code';
  }
  if (analysisPattern.test(q)) {
    return 'analysis';
  }

  return 'code';
}

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function isPathWithinWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

async function resolveCommandCwd(workspaceRoot: string, requestedCwd?: string): Promise<string> {
  const raw = (requestedCwd || '').trim();
  const base = raw.length > 0
    ? (path.isAbsolute(raw) ? raw : path.resolve(workspaceRoot, raw))
    : workspaceRoot;
  const normalized = path.resolve(base);

  if (!isPathWithinWorkspace(workspaceRoot, normalized)) {
    throw new Error('Command working directory must stay inside workspace.');
  }

  const stat = await vscode.workspace.fs.stat(vscode.Uri.file(normalized));
  if (stat.type & vscode.FileType.Directory) {
    return normalized;
  }
  return path.dirname(normalized);
}

async function runCommandInTerminal(workspaceRoot: string, command: string, requestedCwd?: string): Promise<{ cwd: string }> {
  const trimmed = (command || '').trim();
  if (!trimmed) {
    throw new Error('Command cannot be empty.');
  }
  const cwd = await resolveCommandCwd(workspaceRoot, requestedCwd);
  const terminal = vscode.window.createTerminal({
    name: 'CodeAlchemist Command',
    cwd,
  });
  terminal.show(true);
  terminal.sendText(trimmed, true);
  return { cwd };
}

function buildCodeContext(question: string, wsContext: WorkspaceContext): string {
  if (wsContext.selectedCode?.trim()) {
    return wsContext.selectedCode;
  }

  const qLower = (question || '').toLowerCase();
  const asksForFileContent = /\b(file|read|open|show|view|display|summarize|analyze|dosya|oku|ac|aç|goster|göster|incele|ozetle|özetle)\b/i.test(qLower);
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
    /\b(edit|modify|change|update|fix|correct|replace|düzenle|degistir|değiştir|güncelle|guncelle|düzelt|duzelt|tamir|incele.*düzelt|incele.*duzelt|hata.*düzelt|hata.*duzelt)\b/i.test(qLower) &&
    /\b(file|read|open|show|view|display|summarize|analyze|dosya|oku|ac|aç|goster|göster|incele|ozetle|özetle)\b/i.test(qLower);
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

  if (action.action === 'create_file') {
    const validationError = validateFilePath(workspaceRoot, action.file, action.trust_id);
    if (validationError) {
      vscode.window.showErrorMessage(`CodeAlchemist: ${validationError}`);
      output.appendLine(`⚠️ Rejected file create: ${validationError}`);
      return;
    }

    output.appendLine(`\n✨ AI suggests creating: ${action.file}`);
    output.appendLine('Opening diff preview...');

    const approved = await showDiffAndConfirm(workspaceRoot, action.file, action.content, action.operation || 'replace');
    if (!approved) {
      output.appendLine(`⏭️ User rejected creation of ${action.file}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Creation of ${action.file} was rejected.`);
      return;
    }

    try {
      await applyFileEdit(workspaceRoot, {
        file: action.file,
        content: action.content,
        operation: action.operation || 'replace',
        trust_id: action.trust_id,
        trust_scope: action.trust_scope,
      });
      output.appendLine(`✅ Created ${action.file}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Created ${action.file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.appendLine(`❌ Failed to create file: ${msg}`);
      vscode.window.showErrorMessage(`CodeAlchemist: Failed to create ${action.file}: ${msg}`);
    }

    return;
  }

  if (action.action === 'delete_file') {
    const validationError = validateFilePath(workspaceRoot, action.file, action.trust_id);
    if (validationError) {
      vscode.window.showErrorMessage(`CodeAlchemist: ${validationError}`);
      output.appendLine(`⚠️ Rejected file delete: ${validationError}`);
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Delete ${action.file}?`,
      { modal: true },
      'Delete',
      'Cancel',
    );

    if (confirmed !== 'Delete') {
      output.appendLine(`⏭️ User rejected deletion of ${action.file}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Deletion of ${action.file} was rejected.`);
      return;
    }

    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(path.resolve(workspaceRoot, action.file)), {
        recursive: false,
        useTrash: true,
      });
      output.appendLine(`✅ Deleted ${action.file}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Deleted ${action.file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.appendLine(`❌ Failed to delete file: ${msg}`);
      vscode.window.showErrorMessage(`CodeAlchemist: Failed to delete ${action.file}: ${msg}`);
    }

    return;
  }

  if (action.action === 'run_command') {
    const config = vscode.workspace.getConfiguration('codeAlchemist');
    const allowCommands = config.get<string>('allowCommands') || 'ask';

    if (allowCommands === 'never') {
      output.appendLine(`🚫 Command rejected (Trust Level: Never): ${action.command}`);
      vscode.window.showErrorMessage('CodeAlchemist: Command execution is disabled in settings.');
      return;
    }

    // Always show the command details in the output channel
    output.appendLine(`\n🔧 Agent wants to run command:`);
    output.appendLine(`   Command : ${action.command}`);
    output.appendLine(`   CWD     : ${action.cwd || workspaceRoot}`);

    if (allowCommands === 'always') {
      // Even in 'always' mode, show a non-blocking notification and log the command
      vscode.window.showInformationMessage(
        `CodeAlchemist: Running: ${action.command}`,
        'Open Terminal'
      ).then(selection => {
        if (selection === 'Open Terminal') {
          vscode.commands.executeCommand('workbench.action.terminal.focus');
        }
      });
    } else {
      // 'ask' mode — require explicit approval; offer "Always Allow" option
      const confirmed = await vscode.window.showWarningMessage(
        `CodeAlchemist wants to run a command:\n\n${action.command}\n\nWorking Directory: ${action.cwd || 'root'}`,
        { modal: true },
        'Allow',
        'Always Allow',
        'Deny',
      );

      if (confirmed === 'Deny' || confirmed === undefined) {
        output.appendLine(`⏭️ User rejected command: ${action.command}`);
        vscode.window.showInformationMessage('CodeAlchemist: Command execution was rejected.');
        return;
      }

      if (confirmed === 'Always Allow') {
        // Persist trust preference for this session
        await config.update('allowCommands', 'always', vscode.ConfigurationTarget.Global);
        output.appendLine(`🔓 Trust level upgraded to "Always" by user.`);
      }
    }

    try {
      const execution = await runCommandInTerminal(workspaceRoot, action.command, action.cwd);
      output.appendLine(`✅ Command started (${execution.cwd}): ${action.command}`);
      vscode.window.showInformationMessage(`CodeAlchemist: Command started in ${execution.cwd}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.appendLine(`❌ Failed to run command: ${msg}`);
      vscode.window.showErrorMessage(`CodeAlchemist: Failed to run command: ${msg}`);
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
    output.appendLine('Opening unified diff preview...');

    const result = await showMultiDiffUnifiedPreview(workspaceRoot, validChanges);

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
  // ── Output Channels ─────────────────────────────────────────────
  const output = vscode.window.createOutputChannel('CodeAlchemist');
  const agentOutput = vscode.window.createOutputChannel('CodeAlchemist Agent');

  // ── Status Bar ──────────────────────────────────────────────────
  const statusBar = createStatusBar(AVAILABLE_MODELS);
  context.subscriptions.push(statusBar.item);
  HealthMonitor.getInstance().setOutput(output);

  // ── Sidebar Chat Provider (left + right panel) ───────────────
  const chatProvider = new CodeAlchemistChatProvider(context.extensionUri, context, output);
  const chatProviderRight = new CodeAlchemistChatProvider(context.extensionUri, context, output);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CodeAlchemistChatProvider.viewType, chatProvider),
    vscode.window.registerWebviewViewProvider('code-alchemist-chat-right', chatProviderRight),
  );

  // ── Diff Preview Provider ───────────────────────────────────────
  const previewDisposable = getPreviewProviderDisposable();
  if (previewDisposable) {
    context.subscriptions.push(previewDisposable);
  }

  // ── Track last action for manual re-apply ──────────────────────
  let lastAiAction: AiAction | null = null;

  // ── Configuration Change Listener ──────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('codeAlchemist.model') || e.affectsConfiguration('codeAlchemist.agentMode')) {
        statusBar.update();
      }

      if (e.affectsConfiguration('codeAlchemist.allowCommands')) {
        const newValue = vscode.workspace.getConfiguration('codeAlchemist').get<string>('allowCommands');
        if (newValue === 'always') {
          const warningKey = 'codeAlchemist.alwaysCommandsWarningShown';
          const hasShown = context.globalState.get<boolean>(warningKey);
          
          if (!hasShown) {
            const accept = await vscode.window.showWarningMessage(
              'SECURITY WARNING: Enabling "Always" for commands allows the AI Agent to execute shell commands automatically. This could be dangerous if the agent generates a malicious command. Do you understand the risks?',
              { modal: true },
              'I Understand',
              'Back to Ask'
            );

            if (accept === 'I Understand') {
              await context.globalState.update(warningKey, true);
            } else {
              await vscode.workspace.getConfiguration('codeAlchemist').update('allowCommands', 'ask', vscode.ConfigurationTarget.Global);
            }
          }
        }
      }
      if (e.affectsConfiguration('codeAlchemist.workspaceFileLimit')) {
        // Limit changed → old cache is stale
        invalidateContextCache();
      }
    }),
  );

  // ── Event-based Context Cache Invalidation ──────────────────────
  // Invalidate on file system changes so the cache never serves stale data.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => invalidateContextCache()),
    vscode.workspace.onDidCreateFiles(() => invalidateContextCache()),
    vscode.workspace.onDidDeleteFiles(() => invalidateContextCache()),
    vscode.workspace.onDidRenameFiles(() => invalidateContextCache()),
  );

  // workspaceContext.ts içindeki snapshot cache için de listener bağla
  registerWorkspaceCacheListeners(context);

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

  // ── Command: Login (Issue VS Code API Key) ───────────────────
  const loginCmd = vscode.commands.registerCommand('codeAlchemist.login', async () => {
    const cfg = vscode.workspace.getConfiguration('codeAlchemist');
    const endpoint = (cfg.get<string>('endpoint') || '').trim();
    if (!endpoint) {
      vscode.window.showErrorMessage('CodeAlchemist: Endpoint is empty. Set codeAlchemist.endpoint in Settings.');
      return;
    }

    const baseUrl = endpoint.replace(/\/v1\/ask.*$/, '').replace(/\/ask.*$/, '');
    const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    const loginUrl = `${baseUrl}/v1/auth/vscode/login?state=${encodeURIComponent(state)}`;
    const pollUrl = `${baseUrl}/v1/auth/vscode/poll?state=${encodeURIComponent(state)}`;

    try {
      await vscode.env.openExternal(vscode.Uri.parse(loginUrl));

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'CodeAlchemist Login',
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: 'Tarayıcıda giriş yapın. Giriş tamamlanınca anahtar otomatik kaydedilecek...' });

          for (let attempt = 0; attempt < 90; attempt += 1) {
            if (token.isCancellationRequested) {
              return;
            }

            try {
              const resp = await fetch(pollUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
              });
              const data = await resp.json() as { status?: string; api_key?: string };

              if (data?.status === 'ready' && data.api_key) {
                await context.secrets.store(API_KEY_SECRET_NAME, data.api_key);
                await vscode.workspace
                  .getConfiguration('codeAlchemist')
                  .update('apiKey', '', vscode.ConfigurationTarget.Global);

                vscode.window.showInformationMessage('CodeAlchemist: Giriş başarılı. API key otomatik kaydedildi.');
                CodeAlchemistChatProvider.refreshAll();
                return;
              }

              if (data?.status === 'expired') {
                vscode.window.showWarningMessage('CodeAlchemist: Login oturumu zaman aşımına uğradı. Lütfen tekrar deneyin.');
                return;
              }
            } catch {
              // Keep polling on transient network errors.
            }

            await sleep(2000);
          }

          vscode.window.showWarningMessage('CodeAlchemist: Login doğrulaması zaman aşımına uğradı. Tekrar deneyin.');
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`CodeAlchemist: Login failed — ${msg}`);
    }
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

    // ── Determine effective file limit (mode-based) ──────────────
    // Agent mode needs more context to avoid editing unseen files.
    // Chat mode caps at 10 to minimize payload tokens.
    // NOTE: taskType needs the question first, so we do a quick peek at the question
    // before building context. We ask early, then route.
    const question = await vscode.window.showInputBox({
      title: 'Ask CodeAlchemist',
      prompt: 'Question',
      ignoreFocusOut: true,
    });
    if (!question) {
      return;
    }

    const taskType = routeTaskType(question);
    const agentMode = taskType === 'code';
    const effectiveLimit = agentMode
      ? (workspaceFileLimit ?? 20)         // Agent: full configured limit
      : Math.min(workspaceFileLimit ?? 20, 10); // Chat: max 10 files

    // ── Collect workspace context (with cache) ───────────────────
    const t0 = Date.now();
    const now = Date.now();
    const cacheValid = wsContextCache &&
      (now - wsContextCache.ts < CONTEXT_CACHE_TTL_MS) &&
      wsContextCache.limit === effectiveLimit;

    const wsContext = cacheValid
      ? wsContextCache!.data
      : await getWorkspaceContext(effectiveLimit);

    if (!cacheValid) {
      wsContextCache = { data: wsContext, ts: now, limit: effectiveLimit };
    }
    const contextMs = Date.now() - t0;

    const preparedQuestion = buildQuestionWithOutputConstraints(question, wsContext.filePath);

    // ── Open file paths (for payload optimization) ───────────────
    const openFilePaths = new Set(
      wsContext.openFiles.map(f => normalizePathForCompare(f))
    );

    // ── Build optimized workspace_files payload ──────────────────
    // Agent mode: full content (truncated to MAX_FILE_CHARS) for all files.
    // Chat mode: only path for non-open files; full content for open/active files.
    const workspace_files_payload = agentMode
      ? wsContext.workspaceFiles.map(f => ({
          path: f.path,
          content: f.content?.slice(0, MAX_FILE_CHARS),
        }))
      : wsContext.workspaceFiles.map(f => {
          const normalized = normalizePathForCompare(f.path);
          const isOpen = openFilePaths.has(normalized) ||
            normalized === normalizePathForCompare(wsContext.filePath || '');
          return isOpen
            ? { path: f.path, content: f.content?.slice(0, MAX_FILE_CHARS) }
            : { path: f.path }; // path-only for background files in chat mode
        });

    // ── Prepare output ───────────────────────────────────────────
    output.clear();
    output.show(true);
    output.appendLine(`POST ${endpoint}`);
    output.appendLine(`Model: ${model} | Agent: ${agentMode ? 'ON' : 'OFF'} | Task: ${taskType}`);
    output.appendLine(`⏱ Context: ${contextMs}ms | ${wsContext.workspaceFiles.length} files | limit=${effectiveLimit} | cache=${cacheValid ? 'HIT' : 'MISS'}`);
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
      workspace_files: workspace_files_payload as WorkspaceContext['workspaceFiles'],
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

    // ── Token estimate ───────────────────────────────────────────
    const estimatedTokens = estimateTokens(payload);
    output.appendLine(`📊 Tahmini payload: ~${estimatedTokens.toLocaleString()} token | ${workspace_files_payload.length} dosya`);

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

      if (activeSnapshot) {
        output.appendLine(`Active snapshot path: ${activeSnapshot.path} (${activeSnapshot.content?.length ?? 0} chars)`);
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
          const t1 = Date.now();
          const askResult = await sendAskRequest(endpoint, apiKey, payload, output);
          output.appendLine(`⏱ Backend yanıtı: ${Date.now() - t1}ms`);

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
    await vscode.commands.executeCommand('code-alchemist-chat.focus');
  });

  // ── Register disposables ──────────────────────────────────────
  context.subscriptions.push(
    output,
    agentOutput,
    loginCmd,
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
