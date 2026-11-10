import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator','viewer')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE bob_connection (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    endpoint TEXT NOT NULL,
    adapter TEXT NOT NULL,
    api_base_path TEXT NOT NULL,
    auth_mode TEXT NOT NULL,
    auth_header_name TEXT NOT NULL,
    api_key_enc TEXT,
    api_key_hint TEXT,
    state TEXT NOT NULL,
    message TEXT,
    last_tested_at TEXT,
    capabilities TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    token_enc TEXT,
    dir_name TEXT NOT NULL,
    commit_sha TEXT,
    file_count INTEGER,
    last_cloned_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE qse_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT,
    executable_path TEXT,
    version_args TEXT NOT NULL,
    status TEXT NOT NULL,
    version TEXT,
    message TEXT,
    validated_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE executions (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    current_activity TEXT,
    prompt TEXT NOT NULL,
    repository_id TEXT NOT NULL,
    repository_url TEXT NOT NULL,
    repository_name TEXT NOT NULL,
    branch TEXT NOT NULL,
    commit_sha TEXT,
    qse_version TEXT,
    qse_path TEXT,
    adapter TEXT NOT NULL,
    mock INTEGER NOT NULL DEFAULT 0,
    bob_run_id TEXT,
    bob_thread_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    warnings TEXT NOT NULL DEFAULT '[]',
    usage TEXT,
    bob_streamed_chars INTEGER NOT NULL DEFAULT 0,
    report_id TEXT
  );
  CREATE INDEX executions_created ON executions(created_at DESC);
  CREATE TABLE execution_steps (
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    message TEXT,
    PRIMARY KEY (execution_id, key)
  );
  CREATE TABLE execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    ts TEXT NOT NULL,
    source TEXT NOT NULL,
    level TEXT NOT NULL,
    step TEXT,
    message TEXT NOT NULL
  );
  CREATE INDEX execution_logs_exec ON execution_logs(execution_id, id);
  CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL UNIQUE REFERENCES executions(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_detail TEXT NOT NULL,
    mock INTEGER NOT NULL DEFAULT 0,
    bob_markdown TEXT,
    markdown TEXT NOT NULL,
    sections TEXT NOT NULL,
    generated_at TEXT NOT NULL
  );
  CREATE TABLE artifacts (
    id TEXT PRIMARY KEY,
    execution_id TEXT NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    retrieved INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    note TEXT,
    UNIQUE (execution_id, path)
  );
  CREATE TABLE prompt_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    prompt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  `
];

export type Row = Record<string, SQLInputValue | undefined | null | bigint | Uint8Array>;

export class Db {
  readonly raw: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    this.migrate();
  }

  private migrate(): void {
    const current = Number(this.raw.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (current > MIGRATIONS.length) throw new Error('Database schema is newer than this application version');
    for (let v = current; v < MIGRATIONS.length; v++) {
      this.raw.exec('BEGIN IMMEDIATE');
      try {
        this.raw.exec(MIGRATIONS[v]);
        this.raw.exec(`PRAGMA user_version=${v + 1}`);
        this.raw.exec('COMMIT');
      } catch (e) {
        this.raw.exec('ROLLBACK');
        throw e;
      }
    }
  }

  run(sql: string, ...params: SQLInputValue[]): { changes: number; lastId: number } {
    const r = this.raw.prepare(sql).run(...params);
    return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
  }

  get<T = Record<string, any>>(sql: string, ...params: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, any>>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  tx<T>(fn: () => T): T {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }

  ping(): boolean {
    return this.get<{ ok: number }>('SELECT 1 AS ok')?.ok === 1;
  }

  close(): void {
    this.raw.close();
  }
}
