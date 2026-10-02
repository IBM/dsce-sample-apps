/** Backend access: JSON helpers and a reader for server-sent events over fetch. */

export type Version = 'v1' | 'v2'
export type JobKind = `${'evaluate' | 'rubric' | 'redteam'}_${Version}`

export interface Scenario {
  id: string; title: string; applicant: string; summary: string; expected_decision: string; message: string
}
export interface Catalog {
  versions: Record<Version, { label: string; agent: string; compliance_agent: string; note: string }>
  scenarios: Scenario[]
  attacks: { id: string; title: string; summary: string }[]
  rubric_criteria: string[]
  limits: { chat_per_10min: number; result_fresh_s: number }
}

export interface Step {
  kind: 'handoff' | 'tool_call' | 'tool_response' | 'message'
  name?: string; args?: Record<string, unknown>; content?: unknown; role?: string; text?: string
  reason?: string | null; expected?: unknown
}
export interface EvalCase {
  id: string; title: string; applicant: string; success: boolean; routing_f1: number
  tool_recall: number; tool_precision: number; missed_tool_calls: number; incorrect_parameters: number
  text_match: string; keyword_match: boolean; total_steps: number; avg_response_time_s: number
  expected_decision: string; actual_decision: string | null; missed_tools: string[]; wrong_argument_tools: string[]
  steps: Step[]
}
export interface EvalResult {
  kind: 'evaluate'; version: Version; cases: EvalCase[]; journey_success: number; total: number
  averages: Record<string, number>; completed_at: number; duration_s: number
}
export interface RubricResult {
  kind: 'rubric'; version: Version; criteria: string[]; passed: number; total: number; completed_at: number; duration_s: number
  cases: { id: string; title: string; applicant: string; overall: number; criteria: Record<string, { passed: boolean; comment: string }> }[]
}
export interface RedTeamResult {
  kind: 'redteam'; version: Version; succeeded: number; total: number; completed_at: number; duration_s: number
  attacks: { id: string; title: string; summary: string; succeeded: boolean | null; turns: number; aml_called: boolean; decision: string | null; steps: Step[] }[]
}
export type AnyResult = EvalResult | RubricResult | RedTeamResult

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new ApiError(r.status, await errorText(r))
  return r.json()
}

export async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!r.ok) throw new ApiError(r.status, await errorText(r))
  return r.json()
}

async function errorText(r: Response): Promise<string> {
  try { const j = await r.json(); return j.detail || j.error || r.statusText } catch { return r.statusText }
}

/** Read `data: {...}` events from a streaming response; calls onEvent for each parsed object. */
export async function readSSE(resp: Response, onEvent: (ev: Record<string, unknown>) => void): Promise<void> {
  if (!resp.ok) throw new ApiError(resp.status, await errorText(resp))
  if (!resp.body) return
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      for (const raw of part.split('\n')) {
        if (!raw.startsWith('data:')) continue
        try { onEvent(JSON.parse(raw.slice(5).trim())) } catch { /* partial line */ }
      }
    }
  }
}

export const fmtWhen = (ts: number) => new Date(ts * 1000).toLocaleString()
export const short = (name: string) => name.replace(/^chat_with_collaborator_/, '→ ').replace(/^agentops_d1_/, '')
