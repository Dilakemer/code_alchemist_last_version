/**
 * Diff Preview — shows side-by-side diff before applying AI changes.
 *
 * Architecture:
 *  - Uses a custom URI scheme `codealchemist-preview` with in-memory content
 *  - Hash-based URIs to bust VS Code's document cache
 *  - Sequential multi-file approval flow with Apply All / Cancel All options
 *
 * Flow:
 *  1. Read original file content (or show empty for new files)
 *  2. Register modified content under a hash-based URI
 *  3. Open vscode.diff side-by-side
 *  4. Show approve/reject dialog
 *  5. Clean up resources
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import type { FileChange } from './types.js';

function normalizeOperation(operation?: string): 'replace' | 'append' | 'prepend' {
  const op = (operation || 'replace').toLowerCase().trim();
  if (op === 'append' || op === 'prepend') {
    return op;
  }
  return 'replace';
}

function mergeContentByOperation(existingContent: string, incomingContent: string, operation?: string): string {
  const op = normalizeOperation(operation);
  const existing = existingContent || '';
  const incoming = incomingContent || '';

  if (op === 'append') {
    if (!existing) {
      return incoming;
    }
    if (!incoming) {
      return existing;
    }
    return existing.endsWith('\n') || incoming.startsWith('\n')
      ? `${existing}${incoming}`
      : `${existing}\n${incoming}`;
  }

  if (op === 'prepend') {
    if (!incoming) {
      return existing;
    }
    if (!existing) {
      return incoming;
    }
    return incoming.endsWith('\n') || existing.startsWith('\n')
      ? `${incoming}${existing}`
      : `${incoming}\n${existing}`;
  }

  return incoming;
}

// ── In-Memory Content Provider ──────────────────────────────────────

/**
 * Stores modified file content in memory, keyed by hash-based URI.
 * This avoids writing temporary files to disk.
 */
class PreviewContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _contents = new Map<string, string>();
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  /**
   * Registers content and returns the hash-based URI.
   */
  register(fileName: string, content: string): vscode.Uri {
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    const uri = vscode.Uri.parse(
      `codealchemist-preview://preview/${hash}/${encodeURIComponent(fileName)}`,
    );
    this._contents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
    return uri;
  }

  /**
   * Removes content from the registry.
   */
  unregister(uri: vscode.Uri): void {
    this._contents.delete(uri.toString());
  }

  /**
   * Clear all registered content.
   */
  clear(): void {
    this._contents.clear();
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this._contents.get(uri.toString()) ?? '';
  }
}

// ── Singleton Provider ──────────────────────────────────────────────

let provider: PreviewContentProvider | null = null;
let providerDisposable: vscode.Disposable | null = null;

function ensureProvider(): PreviewContentProvider {
  if (!provider) {
    provider = new PreviewContentProvider();
    providerDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'codealchemist-preview',
      provider,
    );
  }
  return provider;
}

/**
 * Must be called during extension deactivation to clean up.
 */
export function disposePreviewProvider(): void {
  if (providerDisposable) {
    providerDisposable.dispose();
    providerDisposable = null;
  }
  if (provider) {
    provider.clear();
    provider = null;
  }
}

/**
 * Returns the provider disposable for adding to extension subscriptions.
 */
export function getPreviewProviderDisposable(): vscode.Disposable | null {
  ensureProvider();
  return providerDisposable;
}

// ── Single File Diff Preview ────────────────────────────────────────

/**
 * Shows a diff preview for a single file change and asks the user to approve.
 *
 * @param workspaceRoot  Absolute path to workspace root
 * @param filePath       Relative file path
 * @param newContent     New file content proposed by the AI
 * @returns              true if user approved, false if rejected
 */
export async function showDiffAndConfirm(
  workspaceRoot: string,
  filePath: string,
  newContent: string,
  operation?: string,
): Promise<boolean> {
  const p = ensureProvider();
  const absPath = path.resolve(workspaceRoot, filePath);
  const fileName = path.basename(filePath);

  // ── Read original content ──────────────────────────────────────
  let originalContent = '';
  let isNewFile = false;
  const originalUri = vscode.Uri.file(absPath);

  try {
    const raw = await vscode.workspace.fs.readFile(originalUri);
    originalContent = new TextDecoder('utf-8').decode(raw);
  } catch {
    isNewFile = true;
  }

  const previewContent = mergeContentByOperation(originalContent, newContent, operation);

  // For new files, show diff against empty content
  const originalPreviewUri = p.register(`original-${fileName}`, isNewFile ? '' : originalContent);
  const modifiedPreviewUri = p.register(`modified-${fileName}`, previewContent);

  // ── Open diff editor ──────────────────────────────────────────
  const normalizedOperation = normalizeOperation(operation);
  const label = isNewFile
    ? `✨ New File (${normalizedOperation}): ${filePath}`
    : `AI Changes (${normalizedOperation}): ${filePath}`;

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalPreviewUri,
    modifiedPreviewUri,
    label,
  );

  // ── Ask user to approve ───────────────────────────────────────
  const choice = await vscode.window.showInformationMessage(
    `Apply AI changes to ${filePath}?`,
    { modal: true },
    { title: '✅ Apply', action: 'apply' },
    { title: '❌ Reject', action: 'reject' },
  );

  // Clean up preview URIs
  p.unregister(originalPreviewUri);
  p.unregister(modifiedPreviewUri);

  return choice?.action === 'apply';
}

// ── Multi-File Diff Preview (Sequential) ────────────────────────────

/** Result of a multi-file diff approval flow. */
export interface MultiDiffResult {
  /** Files the user approved. */
  approved: FileChange[];
  /** Files the user rejected. */
  rejected: FileChange[];
  /** Whether the user cancelled all remaining files. */
  cancelledAll: boolean;
}

/**
 * Shows diff preview for multiple files sequentially.
 *
 * For each file, the user can choose:
 *  - ✅ Apply       → approve this file
 *  - ❌ Skip        → reject this file
 *  - ✅✅ Apply All  → approve this and all remaining files
 *  - 🚫 Cancel All  → reject this and all remaining files
 *
 * @param workspaceRoot  Absolute path to workspace root
 * @param changes        Array of file changes to preview
 * @returns              Categorized results
 */
export async function showMultiDiffAndConfirm(
  workspaceRoot: string,
  changes: FileChange[],
): Promise<MultiDiffResult> {
  const p = ensureProvider();
  const approved: FileChange[] = [];
  const rejected: FileChange[] = [];
  let cancelledAll = false;

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const fileName = path.basename(change.file);
    const absPath = path.resolve(workspaceRoot, change.file);
    const counter = `(${i + 1}/${changes.length})`;

    // Read original
    let originalContent = '';
    let isNewFile = false;
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
      originalContent = new TextDecoder('utf-8').decode(raw);
    } catch {
      isNewFile = true;
    }

    const previewContent = mergeContentByOperation(originalContent, change.content, change.operation);

    // Register preview URIs
    const originalPreviewUri = p.register(`original-${i}-${fileName}`, isNewFile ? '' : originalContent);
    const modifiedPreviewUri = p.register(`modified-${i}-${fileName}`, previewContent);

    // Open diff
    const normalizedOperation = normalizeOperation(change.operation);
    const label = isNewFile
      ? `${counter} ✨ New File (${normalizedOperation}): ${change.file}`
      : `${counter} AI Changes (${normalizedOperation}): ${change.file}`;

    await vscode.commands.executeCommand(
      'vscode.diff',
      originalPreviewUri,
      modifiedPreviewUri,
      label,
    );

    // Ask user
    const choice = await vscode.window.showInformationMessage(
      `${counter} Apply changes to ${change.file}?`,
      { modal: true },
      { title: '✅ Apply', action: 'apply' },
      { title: '❌ Skip', action: 'skip' },
      { title: '✅✅ Apply All', action: 'apply_all' },
      { title: '🚫 Cancel All', action: 'cancel_all' },
    );

    // Clean up
    p.unregister(originalPreviewUri);
    p.unregister(modifiedPreviewUri);

    const action = choice?.action;

    if (action === 'apply') {
      approved.push(change);
    } else if (action === 'skip') {
      rejected.push(change);
    } else if (action === 'apply_all') {
      // Approve this file + all remaining
      approved.push(change);
      for (let j = i + 1; j < changes.length; j++) {
        approved.push(changes[j]);
      }
      break;
    } else {
      // cancel_all, dismiss (X button), or undefined
      rejected.push(change);
      for (let j = i + 1; j < changes.length; j++) {
        rejected.push(changes[j]);
      }
      cancelledAll = true;
      break;
    }
  }

  return { approved, rejected, cancelledAll };
}

// ── Unified Multi-File Diff Preview (Tabbed Webview) ─────────────────

/**
 * Shows all file changes in a unified webview with tabs and a single approval flow.
 * This gives a more "real agent" experience by previewing all files before approval.
 *
 * @param workspaceRoot  Absolute path to workspace root
 * @param changes        Array of file changes to preview
 * @returns              Categorized results (approved/rejected, no sequential prompts)
 */
export async function showMultiDiffUnifiedPreview(
  workspaceRoot: string,
  changes: FileChange[],
): Promise<MultiDiffResult> {
  if (changes.length === 0) {
    return { approved: [], rejected: [], cancelledAll: true };
  }

  const panel = vscode.window.createWebviewPanel(
    'multiDiffPreview',
    `🔄 Multi-File Changes (${changes.length} dosya)`,
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  // Prepare file data
  const fileData: Array<{
    file: string;
    index: number;
    isNew: boolean;
    operation: string;
    original: string;
    preview: string;
  }> = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const absPath = path.resolve(workspaceRoot, change.file);

    let originalContent = '';
    let isNewFile = false;
    try {
      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
      originalContent = new TextDecoder('utf-8').decode(raw);
    } catch {
      isNewFile = true;
    }

    const previewContent = mergeContentByOperation(originalContent, change.content, change.operation);

    fileData.push({
      file: change.file,
      index: i,
      isNew: isNewFile,
      operation: normalizeOperation(change.operation),
      original: originalContent,
      preview: previewContent,
    });
  }

  // Build webview HTML
  const html = buildMultiDiffHtml(fileData);
  panel.webview.html = html;

  // Wait for user decision
  const result = await new Promise<MultiDiffResult>((resolve) => {
    const messageHandler = panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'apply-all') {
        messageHandler.dispose();
        panel.dispose();
        resolve({ approved: changes, rejected: [], cancelledAll: false });
      } else if (msg.command === 'reject-all') {
        messageHandler.dispose();
        panel.dispose();
        resolve({ approved: [], rejected: changes, cancelledAll: true });
      }
    });

    // If panel is closed without decision, treat as cancel
    panel.onDidDispose(() => {
      messageHandler.dispose();
      resolve({ approved: [], rejected: changes, cancelledAll: true });
    });
  });

  return result;
}

/**
 * Builds the HTML for unified multi-file diff preview.
 */
function buildMultiDiffHtml(fileData: Array<{
  file: string;
  index: number;
  isNew: boolean;
  operation: string;
  original: string;
  preview: string;
}>): string {
  const tabsHtml = fileData
    .map(
      (f) =>
        `<button class="tab-btn ${f.index === 0 ? 'active' : ''}" data-index="${f.index}">
        ${f.isNew ? '✨' : '✏️'} ${f.file}
        </button>`,
    )
    .join('\n');

  const diffViewsHtml = fileData
    .map((f) => {
      const diffHtml = buildDiffDisplay(f.original, f.preview);
      return `<div class="diff-view ${f.index === 0 ? 'active' : ''}" data-index="${f.index}">
        <div class="file-header">
          <span>${f.isNew ? '✨ New File' : '✏️ Modified'}</span>
          <span style="font-weight: bold;">${f.file}</span>
          <span style="color: #888;">Operation: ${f.operation}</span>
        </div>
        <div class="diff-content">
          ${diffHtml}
        </div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #1e1e1e;
      color: #e0e0e0;
      margin: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    h2 {
      margin-top: 0;
      color: #4ec9b0;
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 1px solid #444;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .tab-btn {
      padding: 8px 12px;
      background: #2d2d30;
      color: #a0a0a0;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      white-space: nowrap;
      border-radius: 4px 4px 0 0;
      font-size: 12px;
    }

    .tab-btn:hover {
      background: #3e3e42;
      color: #cccccc;
    }

    .tab-btn.active {
      color: #4ec9b0;
      border-bottom-color: #4ec9b0;
      background: #252526;
    }

    .diff-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .diff-view {
      display: none;
      flex: 1;
      flex-direction: column;
      overflow: hidden;
    }

    .diff-view.active {
      display: flex;
    }

    .file-header {
      padding: 12px;
      background: #252526;
      border-bottom: 1px solid #3e3e42;
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: #a0a0a0;
    }

    .diff-content {
      flex: 1;
      overflow: auto;
      border: 1px solid #3e3e42;
      background: #1e1e1e;
    }

    .diff-line {
      padding: 2px 8px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .diff-line.unchanged {
      color: #d4d4d4;
    }

    .diff-line.added {
      background: rgba(76, 175, 80, 0.15);
      color: #4caf50;
    }

    .diff-line.removed {
      background: rgba(244, 67, 54, 0.15);
      color: #f44336;
    }

    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    button {
      padding: 10px 20px;
      font-size: 13px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    #apply-all {
      background: #4ec9b0;
      color: #1e1e1e;
    }

    #apply-all:hover {
      background: #6ee7d6;
    }

    #reject-all {
      background: #d94545;
      color: #fff;
    }

    #reject-all:hover {
      background: #e75454;
    }
  </style>
</head>
<body>
  <h2>📋 ${fileData.length} Dosya Değiştirilecek</h2>

  <div class="tabs">
    ${tabsHtml}
  </div>

  <div class="diff-container">
    ${diffViewsHtml}
  </div>

  <div class="buttons">
    <button id="apply-all">✅ Tümünü Uygula</button>
    <button id="reject-all">❌ Tümünü Reddet</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = e.target.dataset.index;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.diff-view').forEach(v => v.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelector(\`.diff-view[data-index="\${index}"]\`).classList.add('active');
      });
    });

    // Buttons
    document.getElementById('apply-all').addEventListener('click', () => {
      vscode.postMessage({ command: 'apply-all' });
    });

    document.getElementById('reject-all').addEventListener('click', () => {
      vscode.postMessage({ command: 'reject-all' });
    });
  </script>
</body>
</html>`;
}

/**
 * Builds a simple diff display HTML (added/removed lines).
 */
function buildDiffDisplay(original: string, modified: string): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Simple line-by-line diff (not LCS, just for preview)
  let html = '';

  // Show original in red if different
  if (original !== modified) {
    if (originalLines.length > 0 && originalLines[0] !== '') {
      html += `<div class="diff-line removed">- ${escapeHtml(originalLines.join('\n').slice(0, 100))}</div>`;
    }
  }

  // Show modified in green
  html += `<div class="diff-line added">+ ${escapeHtml(modifiedLines.join('\n').slice(0, 100))}</div>`;

  return html || `<div class="diff-line unchanged">(no preview available)</div>`;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
