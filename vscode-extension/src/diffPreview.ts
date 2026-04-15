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
    { modal: false },
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
      { modal: false },
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
