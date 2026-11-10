import crypto from 'node:crypto';
import type { Db } from '../db/database.js';
import type { Role, User } from '../models/types.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

const toUser = (r: UserRow): User => ({ id: r.id, username: r.username, role: r.role, createdAt: r.created_at });

export class UserRepository {
  constructor(private readonly db: Db) {}

  count(): number {
    return Number(this.db.get<{ c: number }>('SELECT COUNT(*) AS c FROM users')?.c ?? 0);
  }

  create(username: string, passwordHash: string, role: Role): User {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.run('INSERT INTO users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)', id, username, passwordHash, role, now);
    return { id, username, role, createdAt: now };
  }

  findByUsername(username: string): (User & { passwordHash: string }) | undefined {
    const r = this.db.get<UserRow>('SELECT * FROM users WHERE username = ?', username);
    return r ? { ...toUser(r), passwordHash: r.password_hash } : undefined;
  }

  findById(id: string): User | undefined {
    const r = this.db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
    return r ? toUser(r) : undefined;
  }

  updatePassword(id: string, passwordHash: string): void {
    this.db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, id);
  }
}

export interface SessionRecord {
  userId: string;
  csrfToken: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

const hashId = (id: string) => crypto.createHash('sha256').update(id).digest('hex');

export class SessionRepository {
  constructor(private readonly db: Db) {}

  create(userId: string, ttlMinutes: number): { id: string; csrfToken: string; expiresAt: string } {
    const id = crypto.randomBytes(32).toString('base64url');
    const csrfToken = crypto.randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
    this.db.run(
      'INSERT INTO sessions(id_hash,user_id,csrf_token,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)',
      hashId(id),
      userId,
      csrfToken,
      now.toISOString(),
      now.toISOString(),
      expiresAt
    );
    return { id, csrfToken, expiresAt };
  }

  find(id: string): SessionRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM sessions WHERE id_hash = ?', hashId(id));
    return r
      ? { userId: r.user_id, csrfToken: r.csrf_token, createdAt: r.created_at, lastSeenAt: r.last_seen_at, expiresAt: r.expires_at }
      : undefined;
  }

  touch(id: string): void {
    this.db.run('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?', new Date().toISOString(), hashId(id));
  }

  delete(id: string): void {
    this.db.run('DELETE FROM sessions WHERE id_hash = ?', hashId(id));
  }

  deleteForUser(userId: string): void {
    this.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
  }

  purgeExpired(idleMinutes: number): number {
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - idleMinutes * 60_000).toISOString();
    return this.db.run('DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?', now.toISOString(), idleCutoff).changes;
  }
}
