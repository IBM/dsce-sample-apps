// ui/src/api/wxo.ts
// watsonx Orchestrate client — browser-side.
//
// ALL WXO calls are proxied through the FastAPI backend.
// No credentials, tokens, or WXO URLs ever reach the browser.
//
// Browser-facing API (the only things the UI needs):
//   wxoConfigured()      → Promise<boolean>  — is WXO live on the backend?
//   sendChatAndWait()    → send to TSCI primary agent, get text reply
//   sendCragAndWait()    → send to CRAG/AVL agent, get text reply
//
// Backend endpoints consumed:
//   GET  /api/agent/status      → { configured, message }
//   POST /api/agent/chat        → { text, thread_id, agent_id }
//   POST /api/agent/crag/chat   → { text, thread_id, agent_id }

// ── Types shared with UI components ───────────────────────────────────────────

export interface WxoMessage {
  id: string;
  role: 'user' | 'assistant';
  content: Array<{ response_type: string; text?: string }>;
  created_on: string | null;
  additional_properties?: {
    tool_calls?: Array<{ id: string; name: string; arguments: string }> | null;
    tool_name?: string | null;
  } | null;
}

export interface WxoThread {
  id: string;
  status: 'ready' | 'async_wait' | 'async_slot_request' | 'async_a2a_slot_request' | null;
  agent_id: string | null;
  title?: string | null;
  created_on?: string | null;
  updated_at?: string | null;
}

export interface WxoAgent {
  id: string;
  name: string;
  description: string;
}

// ── Error type ────────────────────────────────────────────────────────────────

export class WxoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'WxoError';
  }
}

// ── Backend response shapes ───────────────────────────────────────────────────

interface AgentStatusResponse {
  configured: boolean;
  message:    string;
}

interface BackendChatResponse {
  text:      string;
  thread_id: string;
  agent_id:  string;
}

// ── WXO configured check ──────────────────────────────────────────────────────
// Polls GET /api/agent/status once per session and caches the result.
// Always resolves (never throws) — returns false if backend is unreachable.

let _configuredCache: boolean | null = null;

export const wxoConfigured = async (): Promise<boolean> => {
  if (_configuredCache !== null) return _configuredCache;
  try {
    const resp = await fetch('/api/agent/status');
    if (!resp.ok) { _configuredCache = false; return false; }
    const data = await resp.json() as AgentStatusResponse;
    _configuredCache = data.configured;
  } catch {
    _configuredCache = false;
  }
  return _configuredCache;
};

export const cragConfigured = wxoConfigured;

// ── Internal POST helper ───────────────────────────────────────────────────────

async function backendChat(
  endpoint: string,
  message: string,
  threadId?: string,
  agentName?: string,
): Promise<{ text: string; threadId: string }> {
  const body: Record<string, unknown> = { message };
  if (threadId)  body.thread_id  = threadId;
  if (agentName) body.agent_name = agentName;

  const resp = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new WxoError(`Backend chat failed (${resp.status}): ${text}`, resp.status, text);
  }

  const data = await resp.json() as BackendChatResponse;
  return { text: data.text, threadId: data.thread_id };
}

// ── Primary agent chat ────────────────────────────────────────────────────────

export async function sendChatAndWait(
  message: string,
  threadId?: string,
  agentName?: string,
): Promise<{ text: string; threadId: string }> {
  return backendChat('/api/agent/chat', message, threadId, agentName);
}

// ── CRAG / AVL agent chat ─────────────────────────────────────────────────────

export async function sendCragAndWait(
  text: string,
  threadId?: string,
): Promise<{ text: string; threadId: string; toolCalls: Array<{ name: string; id: string }> }> {
  const result = await backendChat('/api/agent/crag/chat', text, threadId);
  return { ...result, toolCalls: [] };
}

// ── No-op stubs for IBM Cloud WXO ─────────────────────────────────────────────
// IBM Cloud WXO does not expose the /v1/threads REST API (on-prem/Developer
// Edition only). Threads are implicit — created by the first chat/completions
// call and continued via X-IBM-THREAD-ID on the backend.
// These stubs preserve the call signatures used elsewhere in the UI.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createThread(): Promise<WxoThread> {
  return { id: '', status: null, agent_id: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function createCragThread(_title = 'Vendor Investigation'): Promise<WxoThread> {
  return { id: '', status: null, agent_id: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function renameThread(_threadId: string, _title: string): Promise<void> { /* no-op */ }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteThread(_threadId: string): Promise<void> { /* no-op */ }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listCragThreads(_limit = 30): Promise<WxoThread[]> { return []; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getThread(_threadId: string): Promise<WxoThread> {
  return { id: _threadId, status: 'ready', agent_id: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendMessage(_threadId: string, _text: string): Promise<void> { /* no-op */ }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listMessages(_threadId: string): Promise<WxoMessage[]> { return []; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendAndWait(
  _threadId: string,
  _text: string,
  _onPoll?: (messages: WxoMessage[]) => void,
): Promise<WxoMessage[]> { return []; }

// ── Utility ───────────────────────────────────────────────────────────────────

/** Extract plain text from a WxoMessage content array. */
export function extractText(msg: WxoMessage): string {
  return msg.content
    .filter(c => c.response_type === 'text' && c.text)
    .map(c => c.text!)
    .join('\n')
    .trim();
}
