/**
 * Workspace Awareness — collects rich context about the user's workspace.
 *
 * Provides:
 *  - Active file path
 *  - Workspace root
 *  - Open editor file paths
 *  - Selected code
 *  - Project file snapshots (with configurable limit)
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { WorkspaceFilePayload } from './types.js';

// ── Language Detection ──────────────────────────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.md': 'markdown',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.sh': 'shell',
  '.ps1': 'shell',
  '.bash': 'shell',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sql': 'sql',
  '.xml': 'xml',
  '.toml': 'toml',
  '.ini': 'ini',
  '.env': 'dotenv',
  '.dockerfile': 'dockerfile',
  '.tex': 'latex',
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.webm', '.ogg', '.wav',
  '.exe', '.dll', '.so', '.dylib',
  '.pyc', '.pyo', '.class', '.o',
  '.lock',
]);

export function detectLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  for (const [ext, lang] of Object.entries(EXTENSION_MAP)) {
    if (lower.endsWith(ext)) {
      return lang;
    }
  }
  // Special case: Dockerfile without extension
  if (lower.endsWith('dockerfile') || lower.endsWith('makefile')) {
    return lower.endsWith('dockerfile') ? 'dockerfile' : 'makefile';
  }
  return 'plaintext';
}

function isBinaryFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  for (const ext of BINARY_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

function isInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  if (!filePath || !workspaceRoot) {
    return false;
  }

  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(workspaceRoot);
  return resolvedFile === resolvedRoot || resolvedFile.startsWith(resolvedRoot + path.sep);
}

// ── Workspace Context ───────────────────────────────────────────────

export interface WorkspaceContext {
  filePath: string;
  workspaceRoot: string;
  selectedCode: string;
  openFiles: string[];
  workspaceFiles: WorkspaceFilePayload[];
}

function getActiveEditorSnapshot(maxChars: number, workspaceRoot: string): WorkspaceFilePayload | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const document = editor.document;
  if (document.uri.scheme !== 'file') {
    return null;
  }
  const filePath = document.uri.fsPath;

  const text = document.getText();
  if (!filePath || !text) {
    return null;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const payloadPath = isInsideWorkspace(filePath, workspaceRoot)
    ? vscode.workspace.asRelativePath(document.uri, false).replace(/\\/g, '/')
    : normalizedPath;

  return {
    path: payloadPath,
    content: text.slice(0, maxChars),
    language: detectLanguageFromPath(filePath),
    trust_id: randomUUID(),
    trust_scope: isInsideWorkspace(filePath, workspaceRoot) ? 'workspace' : 'active_editor',
  };
}

/**
 * Returns the fsPath of the active text editor, or empty string.
 */
export function getActiveFilePath(): string {
  return vscode.window.activeTextEditor?.document.uri.fsPath ?? '';
}

/**
 * Returns the workspace root folder path, or empty string.
 */
export function getWorkspaceRoot(): string {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : '';
}

/**
 * Returns the currently selected text in the active editor, or empty string.
 */
export function getSelectedCode(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return '';
  }
  const selection = editor.selection;
  if (selection.isEmpty) {
    return '';
  }
  return editor.document.getText(selection);
}

/**
 * Returns relative paths of all open file editors.
 */
export function getOpenFiles(): string[] {
  const openPaths: string[] = [];
  const root = getWorkspaceRoot();

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input && typeof input === 'object' && 'uri' in input) {
        const uri = (input as { uri: vscode.Uri }).uri;
        if (uri.scheme === 'file') {
          const rel = root
            ? vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/')
            : uri.fsPath;
          openPaths.push(rel);
        }
      }
    }
  }

  return [...new Set(openPaths)]; // deduplicate
}

/**
 * Collects a snapshot of workspace files with content.
 *
 * @param maxFiles  Hard cap on number of files (clamped to 5–120)
 * @param maxCharsPerFile  Max characters per file content (clamped to 500–30000)
 */
export async function collectWorkspaceSnapshot(
  maxFiles: number,
  maxCharsPerFile: number,
): Promise<WorkspaceFilePayload[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return [];
  }

  const limit = Math.max(5, Math.min(120, maxFiles));
  const charLimit = Math.max(500, Math.min(30000, maxCharsPerFile));

  // Over-fetch so we have room after filtering binaries
  const uris = await vscode.workspace.findFiles(
    '**/*',
    '**/{node_modules,dist,build,.git,coverage,.next,out,.venv,.venv-win,__pycache__,.mypy_cache,.pytest_cache,.tox,vendor,target}/**',
    limit * 3,
  );

  const files: WorkspaceFilePayload[] = [];

  for (const uri of uris) {
    if (files.length >= limit) {
      break;
    }

    const relPath = vscode.workspace.asRelativePath(uri, false).replace(/\\/g, '/');
    if (!relPath) {
      continue;
    }

    // Skip binary files
    if (isBinaryFile(relPath)) {
      continue;
    }

    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(raw);

      // Skip files containing null bytes (likely binary)
      if (text.includes('\u0000')) {
        continue;
      }

      files.push({
        path: relPath,
        content: text.slice(0, charLimit),
        language: detectLanguageFromPath(relPath),
        trust_id: randomUUID(),
        trust_scope: 'workspace',
      });
    } catch {
      // Skip unreadable files and continue.
    }
  }

  return files;
}

/**
 * Collects the full workspace context for sending to the backend.
 */
export async function getWorkspaceContext(
  workspaceFileLimit: number,
  maxCharsPerFile: number = 18000,
): Promise<WorkspaceContext> {
  const workspaceRoot = getWorkspaceRoot();
  const workspaceFiles = await collectWorkspaceSnapshot(workspaceFileLimit, maxCharsPerFile);
  const activeEditorSnapshot = getActiveEditorSnapshot(maxCharsPerFile, workspaceRoot);

  if (activeEditorSnapshot && !workspaceFiles.some(file => file.path === activeEditorSnapshot.path)) {
    workspaceFiles.unshift(activeEditorSnapshot);
    if (workspaceFiles.length > workspaceFileLimit) {
      workspaceFiles.length = workspaceFileLimit;
    }
  }

  return {
    filePath: getActiveFilePath(),
    workspaceRoot,
    selectedCode: getSelectedCode(),
    openFiles: getOpenFiles(),
    workspaceFiles,
  };
}
