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
  stream?: boolean;
  allow_write_tools?: boolean;
  include_previous_modules?: boolean;
  file_path: string;
  active_file?: string;
  workspace_root: string;
  open_files: string[];
  workspace_files: WorkspaceFilePayload[];
  project_id?: number;
  client_context: {
    source: string;
    extension: string;
    working_context?: {
      active_file?: string;
      last_target_file?: string;
      recent_files?: string[];
      explicit_files?: string[];
    };
    capabilities: {
      workspace_tools_preview: boolean;
      diff_preview: boolean;
      multi_edit: boolean;
    };
  };
  intent?: string;
  intent_confidence?: number;
  conversation_id?: number | string;
  session_id?: string;
  request_id?: string;
}

/** Standard JSON response from the backend. */
export interface AskResponse {
  answer?: string;
  steps?: number;
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
  intent?: string;
  optimized?: boolean;
  optimizer_version?: string;
  prompt_version?: string;
  trace_id?: string;
  optimization_score?: number;
  optimization_status?: string;
  balance?: number;
  purchase_url?: string;
  conversation_id?: number;
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
  render_url?: string;
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
  originalContent?: string;
  originalExists?: boolean;
  render_url?: string;
}

export interface FileActionBase {
  file: string;
  trust_id?: string;
  trust_scope?: string;
  originalContent?: string;
  originalExists?: boolean;
  render_url?: string;
}

export interface RunCommandAction {
  action: 'run_command';
  command: string;
  cwd?: string;
  background?: boolean;
  newTerminal?: boolean;
}

/** Discriminated union of AI-driven actions. */
export type AiAction =
  | ({ action: 'edit_file'; content: string; operation?: string } & FileActionBase)
  | ({ action: 'create_file'; content: string; operation?: string } & FileActionBase)
  | ({ action: 'delete_file' } & FileActionBase)
  | { action: 'multi_edit'; changes: FileChange[] }
  | RunCommandAction
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
  render_url?: string;
  intent?: string;
  optimized?: boolean;
  optimizer_version?: string;
  prompt_version?: string;
  trace_id?: string;
  optimization_score?: number;
  optimization_status?: string;
  balance?: number;
  purchase_url?: string;
  conversation_id?: number;
}


// ── Model Definition ────────────────────────────────────────────────

export interface ModelDefinition {
  value: string;
  label: string;
}

// ── Health Status ──────────────────────────────────────────────────

export type BackendHealthStatus = 'online' | 'offline' | 'connecting';

export interface BackendPingResponse {
  status: 'ok';
  timestamp: number;
  version: string;
}

export interface BackendStatusResponse {
  status: 'ok' | 'error' | 'unauthorized';
  version?: string;
  user?: string;
  auth_state?: 'authenticated' | 'unauthorized';
  balance?: number;
  is_admin?: boolean;
  token_unlimited?: boolean;
  purchase_url?: string;
  model_config?: Record<string, string>;
  server_time?: string;
  error?: string;
}
