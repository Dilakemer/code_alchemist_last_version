/**
 * Action Handler — parses AI responses and applies file modifications.
 *
 * Supports:
 *  - `edit_file` action (single file)
 *  - `multi_edit` action (batch files)
 *  - Parsing from both structured action JSON and backend `agent_changed_files`
 *
 * Security:
 *  - Path traversal guard prevents writes outside workspace root
 *  - Invalid/missing path detection
 */
import * as vscode from 'vscode';
import * as path from 'path';
import type { AiAction, FileChange, AgentChangedFile, AskResponse } from './types.js';

function pickString(source: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!source) {
    return '';
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

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

async function saveDocumentIfOpen(fileUri: vscode.Uri): Promise<void> {
  const openDoc = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === fileUri.toString());
  if (openDoc && openDoc.isDirty) {
    await openDoc.save();
  }
}

function isOutsideWorkspaceRoot(workspaceRoot: string, filePath: string): boolean {
  const absPath = path.resolve(workspaceRoot, filePath);
  const normalizedRoot = path.resolve(workspaceRoot);
  return !absPath.startsWith(normalizedRoot + path.sep) && absPath !== normalizedRoot;
}

async function getCurrentFileContent(fileUri: vscode.Uri): Promise<{ exists: boolean; content: string }> {
  const openDoc = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === fileUri.toString());
  if (openDoc) {
    return { exists: true, content: openDoc.getText() };
  }

  try {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    return { exists: true, content: new TextDecoder('utf-8').decode(raw) };
  } catch {
    return { exists: false, content: '' };
  }
}

async function buildWorkspaceEditForChange(workspaceRoot: string, change: FileChange): Promise<{ edit: vscode.WorkspaceEdit; fileUri: vscode.Uri }> {
  const validationError = validateFilePath(workspaceRoot, change.file, change.trust_id);
  if (validationError) {
    throw new Error(validationError);
  }

  const absPath = path.resolve(workspaceRoot, change.file);
  const fileUri = vscode.Uri.file(absPath);
  const encoder = new TextEncoder();
  const operation = normalizeOperation(change.operation);
  const incomingContent = change.content || '';
  const edit = new vscode.WorkspaceEdit();

  if (isOutsideWorkspaceRoot(workspaceRoot, change.file)) {
    const choice = await vscode.window.showWarningMessage(
      `CodeAlchemist: The AI wants to write to a file OUTSIDE your workspace root:\n\n${change.file}\n\nDo you allow this?`,
      { modal: true },
      'Allow Write',
      'Cancel',
    );
    if (choice !== 'Allow Write') {
      throw new Error(`Permission denied for file outside workspace: ${change.file}`);
    }
  }

  const current = await getCurrentFileContent(fileUri);
  const finalContent = mergeContentByOperation(current.content, incomingContent, operation);

  if (current.exists) {
    const doc = vscode.workspace.textDocuments.find((item) => item.uri.toString() === fileUri.toString());
    if (doc) {
      const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
      edit.replace(fileUri, fullRange, finalContent);
    } else {
      const existingDoc = await vscode.workspace.openTextDocument(fileUri);
      const fullRange = new vscode.Range(existingDoc.positionAt(0), existingDoc.positionAt(existingDoc.getText().length));
      edit.replace(fileUri, fullRange, finalContent);
    }
  } else {
    const contentBytes = encoder.encode(finalContent);
    edit.createFile(fileUri, {
      overwrite: false,
      ignoreIfExists: false,
      contents: contentBytes,
    });
  }

  return { edit, fileUri };
}

async function applyWorkspaceEditAndSave(fileUris: vscode.Uri[], edit: vscode.WorkspaceEdit): Promise<void> {
  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    throw new Error('Failed to apply workspace edits.');
  }

  for (const fileUri of fileUris) {
    await saveDocumentIfOpen(fileUri);
  }
}

// ── Path Safety ─────────────────────────────────────────────────────

/**
 * Checks whether a file path is safe to write.
 * - If trustId is provided, we assume it's an explicitly trusted file from the context.
 * - Otherwise, it must be a relative path strictly within the workspace root.
 */
export function isPathSafe(workspaceRoot: string, filePath: string, trustId?: string): boolean {
  if (!workspaceRoot || !filePath) {
    return false;
  }

  // If we have an explicit trust token, we allow the path (it was sent from the extension originally)
  if (trustId && trustId.length > 0) {
    return true;
  }

  // Reject absolute paths for non-trusted files
  if (path.isAbsolute(filePath)) {
    return false;
  }

  // Reject explicit traversal patterns for non-trusted files
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('~')) {
    return false;
  }

  // Final check: resolved path must be within workspace
  const resolved = path.resolve(workspaceRoot, filePath);
  const normalizedRoot = path.resolve(workspaceRoot);

  return resolved.startsWith(normalizedRoot + path.sep) || resolved === normalizedRoot;
}

/**
 * Validates a file path and returns a human-readable error, or null if valid.
 */
export function validateFilePath(workspaceRoot: string, filePath: string, trustId?: string): string | null {
  if (!filePath || filePath.trim().length === 0) {
    return [
      'Dosya yolu boş.',
      `Workspace: ${workspaceRoot || 'tanımsız'}`,
      `İstenen yol: ${filePath || 'boş'}`,
    ].join('\n');
  }

  if (!workspaceRoot) {
    return [
      'Workspace klasörü açık değil. Dosya yazılamaz.',
      'Workspace: tanımsız',
      `İstenen yol: ${path.resolve(filePath)}`,
    ].join('\n');
  }

  if (!isPathSafe(workspaceRoot, filePath, trustId)) {
    const absolutePath = path.resolve(workspaceRoot, filePath);
    return [
      `Dosya workspace dışında veya geçersiz yol: ${filePath}`,
      `Workspace: ${workspaceRoot || 'tanımsız'}`,
      `İstenen yol: ${absolutePath}`,
    ].join('\n');
  }

  return null; // valid
}

// ── Action Parsing ──────────────────────────────────────────────────

/**
 * Attempts to parse an AI action from the response.
 *
 * Checks two sources:
 * 1. Structured action format: `{ action: "edit_file", file, content }`
 * 2. Backend `agent_changed_files` array from the agent trace
 *
 * Returns null if no actionable changes are found.
 */
export function parseAiActions(response: AskResponse): AiAction | null {
  // ── Source 1: Structured action in the response body ────────────
  const raw = response as Record<string, unknown>;

  if (raw.action === 'edit_file' && typeof raw.file === 'string' && typeof raw.content === 'string') {
    return {
      action: 'edit_file',
      file: raw.file,
      content: raw.content,
      operation: typeof raw.operation === 'string' ? raw.operation : undefined,
      trust_id: typeof raw.trust_id === 'string' ? raw.trust_id : undefined,
      trust_scope: typeof raw.trust_scope === 'string' ? raw.trust_scope : undefined,
    };
  }

  if (raw.action === 'create_file' && typeof raw.file === 'string' && typeof raw.content === 'string') {
    return {
      action: 'create_file',
      file: raw.file,
      content: raw.content,
      operation: typeof raw.operation === 'string' ? raw.operation : undefined,
      trust_id: typeof raw.trust_id === 'string' ? raw.trust_id : undefined,
      trust_scope: typeof raw.trust_scope === 'string' ? raw.trust_scope : undefined,
    };
  }

  if (raw.action === 'delete_file' && typeof raw.file === 'string') {
    return {
      action: 'delete_file',
      file: raw.file,
      trust_id: typeof raw.trust_id === 'string' ? raw.trust_id : undefined,
      trust_scope: typeof raw.trust_scope === 'string' ? raw.trust_scope : undefined,
    };
  }

  if (raw.action === 'run_command' && typeof raw.command === 'string' && raw.command.trim().length > 0) {
    return {
      action: 'run_command',
      command: raw.command,
      cwd: typeof raw.cwd === 'string' ? raw.cwd : undefined,
      background: typeof raw.background === 'boolean' ? raw.background : undefined,
    };
  }

  if (raw.action === 'multi_edit' && Array.isArray(raw.changes)) {
    const changes = (raw.changes as Array<Record<string, unknown>>)
      .filter(c => typeof c.file === 'string' && typeof c.content === 'string')
      .map(c => ({
        file: c.file as string,
        content: c.content as string,
        operation: typeof c.operation === 'string' ? c.operation : undefined,
        trust_id: typeof c.trust_id === 'string' ? c.trust_id : undefined,
        trust_scope: typeof c.trust_scope === 'string' ? c.trust_scope : undefined,
      }));

    if (changes.length > 0) {
      return { action: 'multi_edit', changes };
    }
  }

  // ── Source 2: Backend agent_changed_files ────────────────────────
  if (Array.isArray(response.agent_changed_files) && response.agent_changed_files.length > 0) {
    const changes = extractChangesFromAgentFiles(response.agent_changed_files);
    if (changes.length === 1) {
      return {
        action: 'edit_file',
        file: changes[0].file,
        content: changes[0].content,
        operation: changes[0].operation,
        trust_id: changes[0].trust_id,
        trust_scope: changes[0].trust_scope,
      };
    }
    if (changes.length > 1) {
      return { action: 'multi_edit', changes };
    }
  }

  // ── Source 3: Search within Agent Trace for tool calls ──────────
  if (Array.isArray(response.agent_trace) && response.agent_trace.length > 0) {
    const traceChanges = extractChangesFromTrace(response.agent_trace);
    if (traceChanges.length === 1) {
      return {
        action: 'edit_file',
        file: traceChanges[0].file,
        content: traceChanges[0].content,
        operation: traceChanges[0].operation,
        trust_id: traceChanges[0].trust_id,
        trust_scope: traceChanges[0].trust_scope,
      };
    }
    if (traceChanges.length > 1) {
      return { action: 'multi_edit', changes: traceChanges };
    }

    const nonEditAction = extractNonEditActionFromTrace(response.agent_trace);
    if (nonEditAction) {
      return nonEditAction;
    }
  }

  // ── Try to parse action from answer text ────────────────────────
  if (response.answer) {
    const embedded = tryParseEmbeddedAction(response.answer);
    if (embedded) {
      return embedded;
    }
  }

  return null;
}

/**
 * Extracts FileChange entries from agent_changed_files metadata.
 */
function extractChangesFromAgentFiles(agentFiles: AgentChangedFile[]): FileChange[] {
  const changes: FileChange[] = [];

  for (const entry of agentFiles) {
    const filePath = entry.file || entry.path;
    const content = entry.content;

    if (typeof filePath === 'string' && typeof content === 'string' && content.trim().length > 0) {
      changes.push({
        file: filePath,
        content,
        operation: typeof (entry as Record<string, unknown>).operation === 'string' ? String((entry as Record<string, unknown>).operation) : undefined,
        trust_id: entry.trust_id,
        trust_scope: entry.trust_scope,
        render_url: (entry as any).render_url || (entry as any).preview_url,
      });
    }
  }

  return changes;
}

/**
 * Fallback: Extracts FileChange entries from the raw agent trace.
 * Look for tools named 'write_file', 'create_file', 'edit_file'.
 */
function extractChangesFromTrace(trace: any[]): FileChange[] {
  const changes: FileChange[] = [];
  const handledPaths = new Set<string>();

  for (const entry of trace) {
    const tool = (entry.tool || '').toLowerCase();
    if (tool.includes('write_file') || tool.includes('create_file') || tool.includes('edit_file')) {
      // Try to find file and content in input or output
      let file = '';
      let content = '';
      let operation = '';
      const sourceObject = (typeof entry.input === 'object' && entry.input !== null)
        ? entry.input
        : (typeof entry.args === 'object' && entry.args !== null ? entry.args : null);

      if (sourceObject) {
        file = pickString(sourceObject, ['path', 'file', 'filename', 'filePath']);
        content = pickString(sourceObject, ['content', 'text', 'data', 'newContent']);
        operation = pickString(sourceObject, ['operation']);
      } else if (typeof entry.input === 'string') {
        // AI might send a JSON string as input
        try {
          const parsed = JSON.parse(entry.input);
          file = pickString(parsed, ['path', 'file', 'filename', 'filePath']);
          content = pickString(parsed, ['content', 'text', 'data', 'newContent']);
          operation = pickString(parsed, ['operation']);
        } catch { /* ignore */ }
      }

      if (file && content && !handledPaths.has(file)) {
        changes.push({
          file,
          content,
          operation: typeof operation === 'string' && operation.trim().length > 0 ? operation : undefined,
          trust_id: sourceObject?.trust_id || entry.input?.trust_id || entry.trust_id,
          trust_scope: sourceObject?.trust_scope || entry.input?.trust_scope || entry.trust_scope,
          render_url: sourceObject?.render_url || sourceObject?.preview_url || entry.render_url || entry.preview_url,
        });
        handledPaths.add(file);
      }
    }
  }

  return changes;
}

function extractNonEditActionFromTrace(trace: any[]): AiAction | null {
  for (const entry of trace) {
    const tool = String(entry.tool || '').toLowerCase();
    const sourceObject = (typeof entry.input === 'object' && entry.input !== null)
      ? entry.input as Record<string, unknown>
      : (typeof entry.args === 'object' && entry.args !== null ? entry.args as Record<string, unknown> : null);

    let parsedInput: Record<string, unknown> | null = null;
    if (!sourceObject && typeof entry.input === 'string') {
      try {
        const parsed = JSON.parse(entry.input);
        if (parsed && typeof parsed === 'object') {
          parsedInput = parsed as Record<string, unknown>;
        }
      } catch {
        parsedInput = null;
      }
    }

    const inputObject = sourceObject || parsedInput;

    if (tool.includes('delete_file') || tool.includes('remove_file') || tool.includes('unlink')) {
      const file = pickString(inputObject, ['path', 'file', 'filename', 'filePath', 'target']);
      if (file) {
        return {
          action: 'delete_file',
          file,
          trust_id: pickString(inputObject, ['trust_id']) || undefined,
          trust_scope: pickString(inputObject, ['trust_scope']) || undefined,
        };
      }
    }

    if (tool.includes('run_in_terminal') || tool.includes('run_command') || tool.includes('execute_command') || tool === 'shell' || tool.includes('terminal')) {
      const command = pickString(inputObject, ['command', 'cmd', 'shell_command', 'script']);
      if (command) {
        return {
          action: 'run_command',
          command,
          cwd: pickString(inputObject, ['cwd', 'workingDirectory', 'path']) || undefined,
          background: typeof inputObject?.background === 'boolean' ? inputObject.background : true,
        };
      }
    }
  }

  return null;
}

/**
 * Tries to find a JSON action block embedded in the AI's text answer.
 * Looks for ```json ... ``` blocks containing action objects.
 */
function tryParseEmbeddedAction(text: string): AiAction | null {
  const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(text)) !== null) {
    const block = match[1].trim();
    try {
      const parsed = JSON.parse(block) as Record<string, unknown>;

      if (parsed.action === 'edit_file' && typeof parsed.file === 'string' && typeof parsed.content === 'string') {
        return {
          action: 'edit_file',
          file: parsed.file,
          content: parsed.content,
          operation: typeof parsed.operation === 'string' ? parsed.operation : undefined,
          trust_id: typeof parsed.trust_id === 'string' ? parsed.trust_id : undefined,
          trust_scope: typeof parsed.trust_scope === 'string' ? parsed.trust_scope : undefined,
        };
      }

      if (parsed.action === 'create_file' && typeof parsed.file === 'string' && typeof parsed.content === 'string') {
        return {
          action: 'create_file',
          file: parsed.file,
          content: parsed.content,
          operation: typeof parsed.operation === 'string' ? parsed.operation : undefined,
          trust_id: typeof parsed.trust_id === 'string' ? parsed.trust_id : undefined,
          trust_scope: typeof parsed.trust_scope === 'string' ? parsed.trust_scope : undefined,
        };
      }

      if (parsed.action === 'delete_file' && typeof parsed.file === 'string') {
        return {
          action: 'delete_file',
          file: parsed.file,
          trust_id: typeof parsed.trust_id === 'string' ? parsed.trust_id : undefined,
          trust_scope: typeof parsed.trust_scope === 'string' ? parsed.trust_scope : undefined,
        };
      }

      if (parsed.action === 'run_command' && typeof parsed.command === 'string' && parsed.command.trim().length > 0) {
        return {
          action: 'run_command',
          command: parsed.command,
          cwd: typeof parsed.cwd === 'string' ? parsed.cwd : undefined,
          background: typeof parsed.background === 'boolean' ? parsed.background : undefined,
        };
      }

      if (parsed.action === 'multi_edit' && Array.isArray(parsed.changes)) {
        const changes = (parsed.changes as Array<Record<string, unknown>>)
          .filter(c => typeof c.file === 'string' && typeof c.content === 'string')
          .map(c => ({
            file: c.file as string,
            content: c.content as string,
            operation: typeof c.operation === 'string' ? c.operation : undefined,
            trust_id: typeof c.trust_id === 'string' ? c.trust_id : undefined,
            trust_scope: typeof c.trust_scope === 'string' ? c.trust_scope : undefined,
          }));
        if (changes.length > 0) {
          return { action: 'multi_edit', changes };
        }
      }
    } catch {
      // Not valid JSON — skip
    }
  }

  return null;
}

// ── File Editing ────────────────────────────────────────────────────

/**
 * Applies a single file edit using VS Code's WorkspaceEdit API.
 *
 * Creates the file (and parent directories) if it doesn't exist.
 */
export async function applyFileEdit(
  workspaceRoot: string,
  change: FileChange,
): Promise<void> {
  const { edit, fileUri } = await buildWorkspaceEditForChange(workspaceRoot, change);
  await applyWorkspaceEditAndSave([fileUri], edit);
}

/**
 * Applies multiple file edits sequentially.
 * Returns arrays of succeeded and failed file paths.
 */
export async function applyMultiEdit(
  workspaceRoot: string,
  changes: FileChange[],
): Promise<{ succeeded: string[]; failed: Array<{ file: string; error: string }> }> {
  const safeChanges = changes.filter((change) => !isOutsideWorkspaceRoot(workspaceRoot, change.file));
  const externalChanges = changes.filter((change) => isOutsideWorkspaceRoot(workspaceRoot, change.file));
  const succeeded: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  if (externalChanges.length > 0) {
    for (const change of externalChanges) {
      try {
        await applyFileEdit(workspaceRoot, change);
        succeeded.push(change.file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ file: change.file, error: msg });
      }
    }
  }

  if (safeChanges.length === 0) {
    return { succeeded, failed };
  }

  const edit = new vscode.WorkspaceEdit();
  const touchedUris: vscode.Uri[] = [];

  for (const change of safeChanges) {
    try {
      const prepared = await buildWorkspaceEditForChange(workspaceRoot, change);
      edit.set(prepared.fileUri, prepared.edit.get(prepared.fileUri) || []);
      touchedUris.push(prepared.fileUri);
      succeeded.push(change.file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ file: change.file, error: msg });
    }
  }

  if (touchedUris.length > 0) {
    await applyWorkspaceEditAndSave(touchedUris, edit);
  }

  return { succeeded, failed };
}
