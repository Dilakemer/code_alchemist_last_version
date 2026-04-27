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

export function deriveEndpointRoot(endpoint: string): string {
  const trimmed = (endpoint || '').trim();
  if (!trimmed) {
    return '';
  }

  const stripKnownRoute = (pathname: string): string => {
    const cleanPath = stripTrailingSlash(pathname || '/');
    const knownRoutePattern = /\/(v1|api)\/(ask|status)$|\/health$/i;
    if (knownRoutePattern.test(cleanPath)) {
      return cleanPath.replace(knownRoutePattern, '') || '/';
    }
    return cleanPath;
  };

  try {
    const parsed = new URL(trimmed);
    parsed.pathname = stripKnownRoute(parsed.pathname);
    return stripTrailingSlash(parsed.toString());
  } catch {
    // Fallback for non-URL strings or incomplete entries
    return stripTrailingSlash(trimmed.replace(/\/(v1|api)\/(ask|status|history|status|cancel|auth\/vscode\/generate-otp)\/?$|\/health\/?$/i, ''));
  }
}

export function deriveHealthUrl(endpoint: string): string {
  const root = deriveEndpointRoot(endpoint);
  return root ? `${root}/health` : '';
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
  text: string;
  raw: AskResponse;
  meta?: Record<string, unknown>;
  balance?: number;
  purchase_url?: string;
  model_config?: Record<string, string>;
  agentTrace: AgentTraceEntry[];
  agentChangedFiles: AgentChangedFile[];
  streamed: boolean;
  error?: string;
}

// ── History Sync Types ─────────────────────────────────────────────

export interface BackendConversation {
  id: number;
  title: string;
  updatedAt: string;
  pinned: boolean;
}

export interface BackendHistoryMessage {
  role: 'user' | 'ai';
  text: string;
  createdAt: string;
}

export interface HistoryListResponse {
  status: 'ok' | 'error' | 'unauthorized';
  sessions?: BackendConversation[];
}

export interface ConversationDetailResponse {
  status: 'ok' | 'error' | 'unauthorized';
  messages?: BackendHistoryMessage[];
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
 * and extracts agent metadata.
 */
async function streamSseResponse(
  res: Response,
  output: vscode.OutputChannel,
  onMeta?: (meta: Record<string, unknown>) => void,
  signal?: AbortSignal,
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
  let aborted = Boolean(signal?.aborted);

  const abortHandler = () => {
    aborted = true;
    void reader.cancel();
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler);
  }

  const mergeMetaFields = (parsed: SseChunk): void => {
    const maybeMeta: Record<string, unknown> = {};
    if (parsed.selected_model !== undefined) maybeMeta.selected_model = parsed.selected_model;
    if (parsed.agent_provider !== undefined) maybeMeta.agent_provider = parsed.agent_provider;
    if (parsed.agent_mode !== undefined) maybeMeta.agent_mode = parsed.agent_mode;
    if (parsed.agent_project_id !== undefined) maybeMeta.agent_project_id = parsed.agent_project_id;
    if (parsed.agent_workspace_file_count !== undefined) maybeMeta.agent_workspace_file_count = parsed.agent_workspace_file_count;
    if (parsed.agent_tool_capable !== undefined) maybeMeta.agent_tool_capable = parsed.agent_tool_capable;
    if (parsed.intent !== undefined) maybeMeta.intent = parsed.intent;
    if (parsed.optimized !== undefined) maybeMeta.optimized = parsed.optimized;
    if (parsed.optimizer_version !== undefined) maybeMeta.optimizer_version = parsed.optimizer_version;
    if (parsed.prompt_version !== undefined) maybeMeta.prompt_version = parsed.prompt_version;
    if (parsed.trace_id !== undefined) maybeMeta.trace_id = parsed.trace_id;
    if (parsed.optimization_score !== undefined) maybeMeta.optimization_score = parsed.optimization_score;
    if (parsed.optimization_status !== undefined) maybeMeta.optimization_status = parsed.optimization_status;
    if (parsed.balance !== undefined) maybeMeta.balance = parsed.balance;
    if (parsed.conversation_id !== undefined) maybeMeta.conversation_id = parsed.conversation_id;
    if (parsed.purchase_url !== undefined) maybeMeta.purchase_url = parsed.purchase_url;

    if (Object.keys(maybeMeta).length > 0) {
      meta = { ...meta, ...maybeMeta };
      if (onMeta) onMeta(meta);
    }
  };

  const processChunk = (parsed: SseChunk): void => {
    mergeMetaFields(parsed);

    if (parsed.meta) {
        meta = { ...meta, ...parsed };
        if (onMeta) onMeta(meta);
        return;
    }

    if (parsed.done) {
      if (Array.isArray(parsed.agent_trace)) trace = parsed.agent_trace;
      if (Array.isArray(parsed.agent_changed_files)) changedFiles = parsed.agent_changed_files;
      return;
    }

    const chunk = parsed.chunk ?? parsed.text ?? parsed.delta ?? parsed.answer ?? '';
    if (chunk) {
      fullText += chunk;
      output.append(chunk);
    }
  };

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        throw new Error('AbortError');
      }

      let chunkResult;
      try {
        chunkResult = await reader.read();
      } catch (err) {
        if (signal?.aborted) {
          await reader.cancel().catch(() => {});
          throw new Error('AbortError');
        }
        throw err;
      }

      const { done, value } = chunkResult;
      if (done || signal?.aborted) {
        if (signal?.aborted) {
          await reader.cancel().catch(() => {});
          throw new Error('AbortError');
        }
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
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }
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
  options?: { preferJson?: boolean; onMeta?: (meta: Record<string, unknown>) => void },
): Promise<AskResult> {
  // ── Send request ────────────────────────────────────────────────
  // output.appendLine(`[API] Requesting: ${endpoint}`);
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

  // output.appendLine(`Status: ${res.status} ${res.statusText}`);
  // output.appendLine('');

  // ── Handle HTTP errors ──────────────────────────────────────────
  if (!res.ok) {
    const errorText = await res.text();
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // leave as raw text
    }
    output.appendLine(
      typeof errorData === 'object' && errorData
        ? JSON.stringify(errorData, null, 2)
        : errorText,
    );
    const detail = errorData.error || errorData.details || `HTTP ${res.status}`;
    
    // Create error with structured fields for UI recovery
    const error = new Error(`Backend returned ${res.status}: ${detail}`) as any;
    error.status = res.status;
    error.balance = errorData.balance;
    error.purchase_url = errorData.purchase_url;
    error.requestId = payload.request_id;
    
    throw error;
  }

  // ── Parse response ──────────────────────────────────────────────
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('text/event-stream')) {
    // output.appendLine('Streaming response:');
    const { text, trace, changedFiles, meta } = await streamSseResponse(res, output, options?.onMeta, signal);
    if (!text.trim()) {
      output.appendLine('[No streamed text received]');
    }
    // output.appendLine('');

    return {
      text,
      raw: { 
        answer: text, 
        agent_trace: trace, 
        agent_changed_files: changedFiles,
        intent: meta.intent as string,
        optimized: meta.optimized as boolean,
        optimizer_version: meta.optimizer_version as string,
        prompt_version: meta.prompt_version as string,
        trace_id: meta.trace_id as string,
        optimization_score: meta.optimization_score as number,
        optimization_status: meta.optimization_status as string,
        balance: meta.balance as number,
        conversation_id: meta.conversation_id as number,
        purchase_url: meta.purchase_url as string
      },
      meta,
      balance: meta.balance as number | undefined,
      purchase_url: meta.purchase_url as string | undefined,
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
      intent: data.intent,
      optimized: data.optimized,
      optimizer_version: data.optimizer_version,
      prompt_version: data.prompt_version,
      trace_id: data.trace_id,
      optimization_score: data.optimization_score,
      optimization_status: data.optimization_status,
      balance: data.balance,
      conversation_id: data.conversation_id,
    },
    agentTrace: data.agent_trace ?? [],
    agentChangedFiles: data.agent_changed_files ?? [],
    balance: data.balance,
    purchase_url: data.purchase_url,
    streamed: false,
  };
}

/**
 * Lightweight ping to the root /health endpoint.
 * No auth required, very fast.
 */
export async function pingBackend(endpoint: string): Promise<boolean> {
  const healthUrl = deriveHealthUrl(endpoint);
  if (!healthUrl) {
    return false;
  }

  try {
    const res = await fetchWithTimeout(healthUrl, 3000);
    if (!res.ok) {
      return false;
    }

    const payload = (await res.json().catch(() => null)) as { status?: string } | null;
    return payload?.status === 'ok';
  } catch {
    return false;
  }
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        return { status: 'unauthorized', error: 'Invalid API Key' };
      }
      return { status: 'error', error: `HTTP ${res.status}` };
    }

    return await res.json() as BackendStatusResponse;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return { 
      status: 'error', 
      error: isAbort ? 'Oturum doğrulaması zaman aşımına uğradı (10s)' : (err instanceof Error ? err.message : String(err)) 
    };
  }
}

/** Fetches a one-time password (OTP) for secure browser authentication sync. */
export async function getVscodeOtp(
    endpoint: string,
    apiKey: string
): Promise<{ status: 'ok', otp: string } | { status: 'error', error: string }> {
    const root = deriveEndpointRoot(endpoint);
    const otpUrl = `${root}/v1/auth/vscode/generate-otp`;

    try {
        const res = await fetch(otpUrl, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            return { status: 'error', error: `HTTP ${res.status}` };
        }

        return await res.json() as { status: 'ok', otp: string };
    } catch (err) {
        return { status: 'error', error: err instanceof Error ? err.message : String(err) };
    }
}

/** Fetch all VS Code sessions from backend. */
export async function getHistory(
  endpoint: string,
  apiKey: string,
): Promise<HistoryListResponse> {
  const root = deriveEndpointRoot(endpoint);
  const historyUrl = `${root}/v1/history`;

  try {
    const res = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
        if (res.status === 401) return { status: 'unauthorized' };
        return { status: 'error' };
    }
    return await res.json() as HistoryListResponse;
  } catch {
    return { status: 'error' };
  }
}

/** Fetch detailed messages for a specific session title. */
export async function getConversationHistory(
  endpoint: string,
  apiKey: string,
  title: string
): Promise<ConversationDetailResponse> {
  const root = deriveEndpointRoot(endpoint);
  const historyUrl = `${root}/v1/history/${encodeURIComponent(title)}`;

  try {
    const res = await fetch(historyUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
        if (res.status === 401) return { status: 'unauthorized' };
        return { status: 'error' };
    }
    return await res.json() as ConversationDetailResponse;
  } catch {
    return { status: 'error' };
  }
}

/** Signals the backend to abort a specific request. */
export async function cancelAskRequest(
    endpoint: string,
    apiKey: string,
    requestId: string
): Promise<void> {
    const root = deriveEndpointRoot(endpoint);
    const cancelUrl = `${root}/v1/cancel`;

    try {
        await fetch(cancelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
            },
            body: JSON.stringify({ request_id: requestId }),
        });
    } catch (err) {
        console.error('[API] Failed to send cancel signal:', err);
    }
}

