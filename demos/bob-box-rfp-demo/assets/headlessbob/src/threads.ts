import { randomUUID } from 'node:crypto';
import type { SQLInputValue } from 'node:sqlite';
import type { RunManager } from './runs.js';
import { ApiError, terminal, type Run } from './types.js';

export interface Thread {
  id: string; title: string; session_id: string | null; last_run_id: string | null;
  archived: boolean; created_at: string; updated_at: string;
  status: 'empty' | 'ready' | 'running' | 'needs_new_thread' | 'archived';
}
interface Row { id: string; owner: string; title: string; session_id: string | null; last_run_id: string | null; archived: number; created_at: string; updated_at: string }
interface Turn { seq: number; id: string; thread_id: string; run_id: string; content: string; created_at: string; request_key: string | null }
export function object(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) throw new ApiError(400, 'invalid_input', `Expected an object with only: ${keys.join(', ')}`);
  return body as Record<string, unknown>;
}
function title(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw new ApiError(400, 'invalid_input', 'Title must contain 1–120 characters');
  return value.trim();
}
function limit(value: string | null, fallback: number, max: number) {
  if (value !== null && !/^\d+$/.test(value)) throw new ApiError(400, 'invalid_input', 'Invalid page limit');
  const result = value === null ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > max) throw new ApiError(400, 'invalid_input', `Limit must be between 1 and ${max}`);
  return result;
}
export class Threads {
  constructor(private manager: RunManager) {}
  private get db() { return this.manager.store.db; }
  private row(id: string, owner: string): Row {
    const row = this.db.prepare('SELECT * FROM threads WHERE id=? AND owner=?').get(id, owner) as unknown as Row | undefined;
    if (!row) throw new ApiError(404, 'not_found', 'Thread not found');
    return row;
  }
  private view(row: Row): Thread {
    let status: Thread['status'] = 'empty';
    if (row.last_run_id) {
      const run = this.manager.get(row.last_run_id, row.owner);
      const session = this.manager.getSession(row.session_id!, row.owner);
      status = !terminal(run) ? 'running' : session.broken || session.mode !== this.manager.config.bobMode || !this.manager.config.continuation ? 'needs_new_thread' : 'ready';
    }
    if (row.archived) status = 'archived';
    const { owner: _owner, ...data } = row;
    return { ...data, archived: !!row.archived, status };
  }
  get(id: string, owner: string) { return this.view(this.row(id, owner)); }
  create(body: unknown, owner: string) {
    const input = object(body, ['title']);
    const name = input.title === undefined ? 'New thread' : title(input.title);
    const id = randomUUID(), now = new Date().toISOString();
    this.db.prepare('INSERT INTO threads(id,owner,title,created_at,updated_at) VALUES(?,?,?,?,?)').run(id, owner, name, now, now);
    return this.get(id, owner);
  }
  list(query: URLSearchParams, owner: string) {
    const size = limit(query.get('limit'), 30, 100);
    const archived = query.get('archived') ?? 'false';
    if (!['true', 'false'].includes(archived)) throw new ApiError(400, 'invalid_input', 'archived must be true or false');
    const search = query.get('q') ?? '';
    if (search.length > 120) throw new ApiError(400, 'invalid_input', 'Search is too long');
    const params: SQLInputValue[] = [owner, archived === 'true' ? 1 : 0, `%${search.replace(/[\\%_]/g, '\\$&')}%`];
    let where = "owner=? AND archived=? AND title LIKE ? ESCAPE '\\'";
    if (query.has('cursor')) {
      try {
        const cursor = query.get('cursor')!;
        if (cursor.length > 200) throw new Error();
        const pair = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(pair[0]) || typeof pair[1] !== 'string' || !/^[a-f0-9-]{36}$/.test(pair[1])) throw new Error();
        where += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))'; params.push(pair[0], pair[0], pair[1]);
      } catch { throw new ApiError(400, 'invalid_input', 'Invalid thread cursor'); }
    }
    params.push(size + 1);
    const rows = this.db.prepare(`SELECT * FROM threads WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT ?`).all(...params) as unknown as Row[];
    const page = rows.slice(0, size), last = page.at(-1);
    return { items: page.map(row => this.view(row)), next_cursor: rows.length > size && last ? Buffer.from(JSON.stringify([last.updated_at, last.id])).toString('base64url') : null };
  }
  update(id: string, body: unknown, owner: string) {
    const row = this.row(id, owner), input = object(body, ['title', 'archived']);
    if (!Object.keys(input).length) throw new ApiError(400, 'invalid_input', 'Provide title or archived');
    const name = input.title === undefined ? row.title : title(input.title);
    if (input.archived !== undefined && typeof input.archived !== 'boolean') throw new ApiError(400, 'invalid_input', 'archived must be a boolean');
    if (input.archived === true && this.view(row).status === 'running') throw new ApiError(409, 'invalid_input', 'Cancel or finish the active run before archiving', 'thread_busy');
    this.db.prepare('UPDATE threads SET title=?,archived=?,updated_at=? WHERE id=?').run(name, input.archived === undefined ? row.archived : input.archived ? 1 : 0, new Date().toISOString(), id);
    return this.get(id, owner);
  }
  delete(id: string, owner: string) {
    const row = this.row(id, owner);
    if (this.view(row).status === 'running') throw new ApiError(409, 'invalid_input', 'Cancel or finish the active run before deleting the thread', 'thread_busy');
    // Delete wrapper-owned conversation records. ACP run audit records, Bob
    // task history, and workspace files have a separate retention lifecycle.
    this.manager.store.transaction(() => {
      this.db.prepare('DELETE FROM thread_turns WHERE thread_id=?').run(id);
      this.db.prepare('DELETE FROM threads WHERE id=? AND owner=?').run(id, owner);
    });
  }
  send(id: string, body: unknown, owner: string, requestKey?: string) {
    const row = this.row(id, owner), input = object(body, ['content']);
    if (typeof input.content !== 'string' || !input.content.trim() || input.content.length > 20000) throw new ApiError(400, 'invalid_input', 'content must contain 1–20,000 characters');
    const content = input.content.trim();
    if (requestKey !== undefined && !/^[a-zA-Z0-9._:-]{1,128}$/.test(requestKey)) throw new ApiError(400, 'invalid_input', 'Invalid Idempotency-Key');
    if (requestKey) {
      const prior = this.db.prepare('SELECT * FROM thread_turns WHERE thread_id=? AND request_key=?').get(id, requestKey) as unknown as Turn | undefined;
      if (prior) {
        if (prior.content !== content) throw new ApiError(409, 'invalid_input', 'Idempotency-Key was already used with different content', 'idempotency_conflict');
        return this.accepted(row, this.manager.get(prior.run_id, owner), prior.id);
      }
    }
    const thread = this.view(row);
    if (thread.archived) throw new ApiError(409, 'invalid_input', 'Restore the thread before sending a message', 'thread_archived');
    if (thread.status === 'running') throw new ApiError(409, 'invalid_input', 'This thread already has an active run', 'thread_busy');
    if (thread.status === 'needs_new_thread') throw new ApiError(409, 'invalid_input', 'This Bob session cannot safely continue. Start a new thread.', 'session_recovery');
    const turnId = randomUUID(), now = new Date().toISOString();
    const run = this.manager.create({ agent_name: 'headlessbob', mode: 'async', ...(row.session_id ? { session_id: row.session_id } : {}), input: [{ role: 'user', parts: [{ content_type: 'text/plain', content }] }] }, owner, run => {
      this.db.prepare('INSERT INTO thread_turns(id,thread_id,run_id,content,created_at,request_key) VALUES(?,?,?,?,?,?)').run(turnId, id, run.run_id, content, now, requestKey ?? null);
      this.db.prepare('UPDATE threads SET session_id=?,last_run_id=?,title=?,updated_at=? WHERE id=?').run(run.session_id, run.run_id, row.title === 'New thread' ? content.replace(/\s+/g, ' ').slice(0, 80) : row.title, now, id);
    });
    return this.accepted(this.row(id, owner), run, turnId);
  }
  private accepted(row: Row, run: Run, turnId: string) { return { thread: this.view(row), run, message_id: turnId, events_url: `/api/v1/runs/${run.run_id}/events` }; }
  messages(id: string, query: URLSearchParams, owner: string) {
    this.row(id, owner);
    const size = limit(query.get('limit'), 20, 50), before = query.get('before');
    if (before !== null && (!/^\d+$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) < 1)) throw new ApiError(400, 'invalid_input', 'Invalid message cursor');
    const rows = this.db.prepare('SELECT * FROM thread_turns WHERE thread_id=? AND seq<? ORDER BY seq DESC LIMIT ?').all(id, before ? Number(before) : Number.MAX_SAFE_INTEGER, size + 1) as unknown as Turn[];
    const page = rows.slice(0, size).reverse();
    return { items: page.flatMap(turn => {
      const run = this.manager.get(turn.run_id, owner);
      const text = run.output.length ? run.output.flatMap(m => m.parts.map(p => p.content)).join('\n') : this.manager.store.events(turn.run_id).filter(e => e.type === 'message.part').map(e => e.part?.content ?? '').join('');
      return [
        { id: turn.id, role: 'user', content: turn.content, created_at: turn.created_at, run_id: run.run_id, status: 'completed' },
        { id: `${turn.id}-reply`, role: 'assistant', content: text, created_at: run.finished_at ?? run.created_at, run_id: run.run_id, status: run.status, ...(run.usage ? { usage: run.usage } : {}), ...(run.error ? { error: run.error } : {}) }
      ];
    }), next_cursor: rows.length > size ? String(page[0].seq) : null };
  }
}
