import type { Usage } from '../types.js';
import { StringDecoder } from 'node:string_decoder';
export class RuntimeError extends Error {
  constructor(public reason: string, message: string) { super(message); }
}
export interface Result { text: string; taskId: string; usage?: Usage }
/** Bob Shell 2.0.1 stream-json renderer contract. Raw reasoning and tool payloads are not forwarded. */
export class BobParser {
  private decoder = new StringDecoder('utf8');
  private pending = '';
  private bytes = 0;
  private text = '';
  private result?: Result;
  constructor(private limit: number, private onText: (text: string) => void) {}
  push(chunk: Buffer) {
    this.bytes += chunk.length;
    if (this.bytes > this.limit) throw new RuntimeError('output_limit', 'Bob output exceeded the configured byte limit');
    this.consume(this.decoder.write(chunk));
  }
  private consume(text: string) {
    this.pending += text;
    let index: number;
    while ((index = this.pending.indexOf('\n')) >= 0) {
      const line = this.pending.slice(0, index); this.pending = this.pending.slice(index + 1); this.line(line);
    }
  }
  private line(line: string) {
    if (!line.trim()) return;
    let event: Record<string, any>;
    try { event = JSON.parse(line); } catch { throw new RuntimeError('invalid_output', 'Bob emitted malformed JSON'); }
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') throw new RuntimeError('invalid_output', 'Bob emitted an invalid event');
    if (this.result) throw new RuntimeError('invalid_output', 'Bob emitted an event after its result');
    if (event.type === 'error') {
      const reason = /Maximum (cost|turns?) limit/i.test(String(event.message)) ? 'execution_limit' : 'bob_error';
      throw new RuntimeError(reason, reason === 'execution_limit' ? 'Bob reached its cost or turn limit' : 'Bob reported an execution error');
    }
    if (event.type === 'message' && event.role === 'assistant' && event.isReasoning !== true) {
      if (typeof event.content !== 'string') throw new RuntimeError('invalid_output', 'Bob message content must be text');
      this.text += event.content;
      if (event.content) this.onText(event.content);
    }
    if (event.type === 'result') {
      if (event.status !== 'success' || typeof event.stats?.task_id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(event.stats.task_id)) throw new RuntimeError('invalid_output', 'Bob did not return a successful result with a task ID');
      const usage: Usage = {};
      const counts = new Set(['duration_ms', 'tool_calls', 'total_tokens', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens']);
      for (const key of ['duration_ms', 'session_costs', 'max_cost', 'tool_calls', 'total_tokens', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens', 'cache_ratio'] as const) {
        const value = event.stats[key];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && (!counts.has(key) || Number.isSafeInteger(value))) usage[key] = value;
      }
      this.result = { text: this.text, taskId: event.stats.task_id, ...(Object.keys(usage).length ? { usage } : {}) };
    }
  }
  finish(): Result {
    this.consume(this.decoder.end());
    if (this.pending.trim()) this.line(this.pending);
    if (!this.result) throw new RuntimeError('missing_result', 'Bob exited without a completion result');
    return this.result;
  }
}
