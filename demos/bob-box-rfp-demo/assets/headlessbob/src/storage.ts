import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, lstatSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Event, Run, Session } from './types.js';

export class Store {
  readonly db: DatabaseSync;
  readonly workspaceRoot: string;
  private lock: DatabaseSync;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    dataDir = realpathSync(dataDir);
    // A separate SQLite exclusive transaction provides an OS-backed lock that
    // releases on process death, including across container/PID namespace changes.
    this.lock = new DatabaseSync(join(dataDir, 'instance.sqlite'));
    try { this.lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); }
    catch { this.lock.close(); throw new Error('Another service instance is using DATA_DIR'); }
    try {
      this.workspaceRoot = join(dataDir, 'workspaces');
      mkdirSync(this.workspaceRoot, { recursive: true, mode: 0o700 });
      if (lstatSync(this.workspaceRoot).isSymbolicLink() || realpathSync(this.workspaceRoot) !== this.workspaceRoot) throw new Error('Workspace root must not be a symlink');
      this.db = new DatabaseSync(join(dataDir, 'runs.sqlite'));
      if (Number(this.db.prepare('PRAGMA user_version').get()!.user_version) > 2) throw new Error('Database schema is newer than this service');
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id), data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS runs_session ON runs(session_id);
        CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS events_run ON events(run_id, seq);
        CREATE TABLE IF NOT EXISTS threads (
          id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
          session_id TEXT REFERENCES sessions(id), last_run_id TEXT REFERENCES runs(id),
          archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS threads_owner ON threads(owner, archived, updated_at DESC, id DESC);
        CREATE TABLE IF NOT EXISTS thread_turns (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
          thread_id TEXT NOT NULL REFERENCES threads(id), run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
          content TEXT NOT NULL, created_at TEXT NOT NULL, request_key TEXT,
          UNIQUE(thread_id, request_key)
        );
        CREATE INDEX IF NOT EXISTS turns_thread ON thread_turns(thread_id, seq);
        PRAGMA user_version=2;`);
    } catch (e) { this.lock.close(); throw e; }
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  newWorkspace(id: string) {
    const path = join(this.workspaceRoot, id);
    mkdirSync(path, { mode: 0o700 }); return path;
  }
  checkWorkspace(session: Session) {
    const path = resolve(this.workspaceRoot, session.id);
    if (session.workspace !== path || lstatSync(this.workspaceRoot).isSymbolicLink() || realpathSync(this.workspaceRoot) !== this.workspaceRoot || lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory() || realpathSync(path) !== path) throw new Error('Workspace path failed validation');
    return path;
  }
  saveSession(session: Session) { this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(session.id, session.owner, JSON.stringify(session)); }
  session(id: string, owner: string): Session | undefined {
    const row = this.db.prepare('SELECT data FROM sessions WHERE id=? AND owner=?').get(id, owner);
    return row ? JSON.parse(String(row.data)) : undefined;
  }
  saveRun(run: Run, owner: string) { this.db.prepare('INSERT INTO runs VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(run.run_id, owner, run.session_id, JSON.stringify(run)); }
  run(id: string, owner: string): Run | undefined {
    const row = this.db.prepare('SELECT data FROM runs WHERE id=? AND owner=?').get(id, owner);
    return row ? JSON.parse(String(row.data)) : undefined;
  }
  allRuns(): { run: Run; owner: string }[] { return this.db.prepare('SELECT data, owner FROM runs').all().map(row => ({ run: JSON.parse(String(row.data)), owner: String(row.owner) })); }
  history(session: string): string[] { return this.db.prepare('SELECT id FROM runs WHERE session_id=? ORDER BY rowid').all(session).map(row => `urn:uuid:${row.id}`); }
  append(id: string, event: Event) { this.db.prepare('INSERT INTO events(run_id, data) VALUES (?, ?)').run(id, JSON.stringify(event)); }
  events(id: string): Event[] { return this.db.prepare('SELECT data FROM events WHERE run_id=? ORDER BY seq').all(id).map(row => JSON.parse(String(row.data))); }
  close() { this.db.close(); this.lock.close(); }
}
