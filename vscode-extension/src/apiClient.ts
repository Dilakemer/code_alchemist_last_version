/**
 * API Client — communicates with the CodeAlchemist backend via HTTP + SSE.
 *
 * Handles:
 *  - Sending the enriched /v1/ask request
 *  - SSE stream parsing
 *  - Agent trace extraction from the `done` event
 *  - Error handling for all network/parse failure modes
 */
import * as vscode from 'vscode';
import type {
  AskRequestPayload,
  AskResponse,
  SseChunk,
  AgentTraceEntry,
  AgentChangedFile,
} from './types.js';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function deriveEndpointRoot(endpoint: string): string {
  const trimmed = (endpoint || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const cleanPath = stripTrailingSlash(parsed.pathname);
    if (/\/(v1|api)\/ask$/i.test(cleanPath)) {
      parsed.pathname = cleanPath.replace(/\/(v1|api)\/ask$/i, '') || '/';
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    return stripTrailingSlash(trimmed.replace(/\/(v1|api)\/ask\/?$/i, ''));
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Response Envelope ───────────────────────────────────────────────

/** Everything extracted from an /v1/ask response (JSON or SSE). */
export interface AskResult {
  /** The full text answer from the AI. */
  text: string;
  /** Raw parsed JSON (for non-streamed responses). */
  raw: AskResponse;
  /** Optional metadata returned by backend (SSE meta or JSON fields). */
  meta?: Record<string, unknown>;
  /** Agent execution trace (from SSE done event or JSON body). */
  agentTrace: AgentTraceEntry[];
  /** Files changed by the agent. */
  agentChangedFiles: AgentChangedFile[];
  /** Whether the response was streamed via SSE. */
  streamed: boolean;
}

// ── SSE Parser ──────────────────────────────────────────────────────

function parseSseDataLine(raw: string): SseChunk | null {
  if (!raw || raw === '[DONE]') {
    return null;
  }
  try {
    return JSON.parse(raw) as SseChunk;
  } catch {
    return null;
  }
}

/**
 * Reads an SSE response body, appends text chunks to the output channel,
 * and extracts agent metadata from the `done` event.
 */
async function streamSseResponse(
  res: Response,
  output: vscode.OutputChannel,
): Promise<{ text: string; trace: AgentTraceEntry[]; changedFiles: AgentChangedFile[]; meta: Record<string, unknown> }> {
  const body = res.body;
  if (!body) {
    return { text: '', trace: [], changedFiles: [], meta: {} };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let trace: AgentTraceEntry[] = [];
  let changedFiles: AgentChangedFile[] = [];
  let meta: Record<string, unknown> = {};
  let firstRawDataLine = '';

  const mergeMetaFields = (parsed: SseChunk): void => {
    const maybeMeta: Record<string, unknown> = {};
    if (parsed.selected_model !== undefined) {
      maybeMeta.selected_model = parsed.selected_model;
    }
    if (parsed.agent_provider !== undefined) {
      maybeMeta.agent_provider = parsed.agent_provider;
    }
    if (parsed.agent_mode !== undefined) {
      maybeMeta.agent_mode = parsed.agent_mode;
    }
    if (parsed.agent_project_id !== undefined) {
      maybeMeta.agent_project_id = parsed.agent_project_id;
    }
    if (parsed.agent_workspace_file_count !== undefined) {
      maybeMeta.agent_workspace_file_count = parsed.agent_workspace_file_count;
    }
    if (parsed.agent_tool_capable !== undefined) {
      maybeMeta.agent_tool_capable = parsed.agent_tool_capable;
    }
    if (Object.keys(maybeMeta).length > 0) {
      meta = { ...meta, ...maybeMeta };
    }
  };

  const processChunk = (parsed: SseChunk): void => {
    // Some backends may include metadata fields outside explicit meta events.
    mergeMetaFields(parsed);

    // Meta event (first SSE line with metadata)
    if (parsed.meta) {
      meta = { ...meta, ...parsed };
      return;
    }

    // Done event — extract agent trace data
    if (parsed.done) {
      if (Array.isArray(parsed.agent_trace)) {
        trace = parsed.agent_trace;
      }
      if (Array.isArray(parsed.agent_changed_files)) {
        changedFiles = parsed.agent_changed_files;
      }
      return;
    }

    // Text chunk
    const chunk = parsed.chunk ?? parsed.text ?? parsed.delta ?? parsed.answer ?? '';
    if (chunk) {
      fullText += chunk;
      output.append(chunk);
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }
      const raw = line.slice(5).trim();
      if (!firstRawDataLine && raw && raw !== '[DONE]') {
        firstRawDataLine = raw;
      }
      const parsed = parseSseDataLine(raw);
      if (parsed) {
        processChunk(parsed);
      } else if (raw && raw !== '[DONE]') {
        // Unparseable text — append as-is
        fullText += raw;
        output.append(raw);
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data:')) {
    const trailing = buffer.slice(5).trim();
    if (!firstRawDataLine && trailing && trailing !== '[DONE]') {
      firstRawDataLine = trailing;
    }
    const parsed = parseSseDataLine(trailing);
    if (parsed) {
      processChunk(parsed);
    } else if (trailing && trailing !== '[DONE]') {
      fullText += trailing;
      output.append(trailing);
    }
  }

  if (firstRawDataLine) {
    meta = {
      ...meta,
      debug_first_sse_data_raw: firstRawDataLine.slice(0, 400),
    };
  }

  return { text: fullText, trace, changedFiles, meta };
}

// ── Main API Function ───────────────────────────────────────────────

/**
 * Sends an enriched request to the backend /v1/ask endpoint.
 *
 * @param endpoint  Full URL (e.g. https://...onrender.com/v1/ask)
 * @param apiKey    The ca-... API key
 * @param payload   Enriched request body
 * @param output    VS Code output channel for logging
 * @returns         Parsed result with text, trace, and changed files
 * @throws          On network, HTTP, or parse errors (with descriptive messages)
 */
export async function sendAskRequest(
  endpoint: string,
  apiKey: string,
  payload: AskRequestPayload,
  output: vscode.OutputChannel,
  signal?: AbortSignal,
  options?: { preferJson?: boolean },
): Promise<AskResult> {
  // ── Send request ────────────────────────────────────────────────
  output.appendLine(`[API] Requesting: ${endpoint}`);
  let res: Response;
  const acceptHeader = options?.preferJson
    ? 'application/json'
    : 'text/event-stream, application/json';

  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': acceptHeader,
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach backend (${endpoint}): ${msg}`);
  }

  output.appendLine(`Status: ${res.status} ${res.statusText}`);
  output.appendLine('');

  // ── Handle HTTP errors ──────────────────────────────────────────
  if (!res.ok) {
    const errorText = await res.text();
    let errorData: AskResponse = {};
    try {
      errorData = JSON.parse(errorText) as AskResponse;
    } catch {
      // leave as raw text
    }
    output.appendLine(
      typeof errorData === 'object' && errorData
        ? JSON.stringify(errorData, null, 2)
        : errorText,
    );
    const detail = errorData.error || errorData.details || `HTTP ${res.status}`;
    throw new Error(`Backend returned ${res.status}: ${detail}`);
  }

  // ── Parse response ──────────────────────────────────────────────
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('text/event-stream')) {
    output.appendLine('Streaming response:');
    const { text, trace, changedFiles, meta } = await streamSseResponse(res, output);
    if (!text.trim()) {
      output.appendLine('[No streamed text received]');
    }
    output.appendLine('');

    return {
      text,
      raw: { answer: text, agent_trace: trace, agent_changed_files: changedFiles },
      meta,
      agentTrace: trace,
      agentChangedFiles: changedFiles,
      streamed: true,
    };
  }

  // Non-streamed JSON response
  const text = await res.text();
  let data: AskResponse = {};
  try {
    data = JSON.parse(text) as AskResponse;
  } catch {
    // If JSON parse fails, treat entire text as the answer
    output.appendLine(text);
    return {
      text,
      raw: { answer: text },
      agentTrace: [],
      agentChangedFiles: [],
      streamed: false,
    };
  }

  const answer = data.answer ?? text;
  output.appendLine(answer);

  return {
    text: answer,
    raw: data,
    meta: {
      selected_model: data.selected_model,
      agent_provider: data.agent_provider,
      agent_mode: data.agent_mode,
      agent_project_id: data.agent_project_id,
      agent_tool_capable: data.agent_tool_capable,
    },
    agentTrace: data.agent_trace ?? [],
    agentChangedFiles: data.agent_changed_files ?? [],
    streamed: false,
  };
}

/**
 * Lightweight ping to the root /health endpoint.
 * No auth required, very fast.
 */
export async function pingBackend(endpoint: string): Promise<boolean> {
  const root = deriveEndpointRoot(endpoint);
  if (!root) {
    return false;
  }

  const candidates = [
    `${root}/health`,
    `${root}/v1/status`,
    `${root}/v1/ask`,
    `${root}/api/ask`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, 3000);
      // Auth or method errors still prove server is reachable and route exists.
      if (res.ok || res.status === 401 || res.status === 403 || res.status === 405) {
        return true;
      }
      // Continue trying alternatives when a route is not found.
      if (res.status === 404) {
        continue;
      }
      // Any other HTTP response still indicates backend host is reachable.
      if (res.status >= 100 && res.status <= 599) {
        return true;
      }
    } catch {
      // Try next probe URL.
    }
  }

  return false;
}

/**
 * Detailed status check from /v1/status.
 * Requires API Key.
 */
import { BackendStatusResponse } from './types.js';

export async function getBackendStatus(
  endpoint: string,
  apiKey: string,
): Promise<BackendStatusResponse> {
  const root = deriveEndpointRoot(endpoint);
  if (!root) {
    return { status: 'error', error: 'Endpoint is empty' };
  }
  const statusUrl = `${root}/v1/status`;

  try {
    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { status: 'unauthorized', error: 'Invalid API Key' };
      }
      return { status: 'error', error: `HTTP ${res.status}` };
    }

    return await res.json() as BackendStatusResponse;
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
