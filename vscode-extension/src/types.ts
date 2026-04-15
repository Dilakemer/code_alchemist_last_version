/**
 * Shared TypeScript types for CodeAlchemist VS Code Extension.
 */

// ── Workspace Snapshot ──────────────────────────────────────────────

/** A single file snapshot sent to the backend. */
export interface WorkspaceFilePayload {
  path: string;
  content: string;
  language: string;
  trust_id?: string;
  trust_scope?: 'workspace' | 'active_editor' | 'open_tab';
}

// ── Request / Response ──────────────────────────────────────────────

/** The enriched request payload sent to /v1/ask. */
export interface AskRequestPayload {
  question: string;
  code: string;
  model: string;
  agent_mode: boolean;
  allow_write_tools?: boolean;
  file_path: string;
  workspace_root: string;
  open_files: string[];
  workspace_files: WorkspaceFilePayload[];
  project_id?: number;
  client_context: {
    source: string;
    extension: string;
    capabilities: {
      workspace_tools_preview: boolean;
      diff_preview: boolean;
      multi_edit: boolean;
    };
  };
}

/** Standard JSON response from the backend. */
export interface AskResponse {
  answer?: string;
  error?: string;
  details?: string;
  agent_mode?: boolean;
  selected_model?: string;
  agent_provider?: string;
  agent_project_id?: number | null;
  agent_tool_capable?: boolean;
  agent_trace?: AgentTraceEntry[];
  agent_changed_files?: AgentChangedFile[];
  agent_trace_total?: number;
  agent_changed_total?: number;
  agent_trace_truncated?: boolean;
  agent_changed_truncated?: boolean;
}

/** A single entry from the agent execution trace. */
export interface AgentTraceEntry {
  step?: number;
  tool?: string;
  input?: string;
  output?: string;
  reasoning?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

/** A file changed by the agent during execution. */
export interface AgentChangedFile {
  file?: string;
  path?: string;
  action?: string;
  content?: string;
  diff?: string;
  trust_id?: string;
  trust_scope?: string;
  [key: string]: unknown;
}

// ── AI Actions (structured response format) ─────────────────────────

/** A single file change for edit_file or multi_edit actions. */
export interface FileChange {
  file: string;
  content: string;
  operation?: string;
  trust_id?: string;
  trust_scope?: string;
}

/** Discriminated union of AI-driven actions. */
export type AiAction =
  | { action: 'edit_file'; file: string; content: string; operation?: string; trust_id?: string; trust_scope?: string }
  | { action: 'multi_edit'; changes: FileChange[] }
  | { action: 'message'; text: string };

// ── SSE Chunk Types ─────────────────────────────────────────────────

/** A single SSE data chunk. */
export interface SseChunk {
  text?: string;
  chunk?: string;
  delta?: string;
  answer?: string;
  done?: boolean;
  meta?: boolean;
  agent_mode?: boolean;
  selected_model?: string;
  agent_provider?: string;
  agent_project_id?: number | null;
  agent_workspace_file_count?: number;
  agent_tool_capable?: boolean;
  agent_trace?: AgentTraceEntry[];
  agent_changed_files?: AgentChangedFile[];
  agent_trace_total?: number;
  agent_changed_total?: number;
  agent_trace_truncated?: boolean;
  agent_changed_truncated?: boolean;
}

// ── Model Definition ────────────────────────────────────────────────

export interface ModelDefinition {
  value: string;
  label: string;
}
