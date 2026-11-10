export interface Usage { duration_ms?: number; session_costs?: number; max_cost?: number; tool_calls?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number; cache_read_tokens?: number; cache_write_tokens?: number; cache_ratio?: number }
export interface Message { role: string; parts: { content_type: string; content: string }[] }
export interface CreateRequest { agent_name: string; input: Message[]; mode?: 'sync' | 'async' | 'stream'; session_id?: string }
export type Status = 'created' | 'in-progress' | 'cancelling' | 'cancelled' | 'completed' | 'failed';
export interface ProtocolError { code: 'invalid_input' | 'not_found' | 'server_error'; message: string; data?: Record<string, unknown> }
export interface Run {
  agent_name: string; run_id: string; session_id: string; status: Status;
  usage?: Usage; output: Message[]; created_at: string; finished_at?: string; error?: ProtocolError;
}
export interface Session { id: string; owner: string; workspace: string; mode: string; taskId?: string; broken: boolean }
export type Event = { type: string; run?: Run; message?: Message; part?: Message['parts'][number]; generic?: Record<string, unknown> };
export const terminal = (run: Run) => ['completed', 'failed', 'cancelled'].includes(run.status);
export class ApiError extends Error {
  constructor(public status: number, public code: ProtocolError['code'], message: string, public reason?: string) { super(message); }
  body(): ProtocolError { return { code: this.code, message: this.message, ...(this.reason ? { data: { reason: this.reason } } : {}) }; }
}
