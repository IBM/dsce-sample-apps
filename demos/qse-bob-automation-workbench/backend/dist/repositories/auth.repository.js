import crypto from 'node:crypto';
const toUser = (r) => ({ id: r.id, username: r.username, role: r.role, createdAt: r.created_at });
export class UserRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    count() {
        return Number(this.db.get('SELECT COUNT(*) AS c FROM users')?.c ?? 0);
    }
    create(username, passwordHash, role) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        this.db.run('INSERT INTO users(id,username,password_hash,role,created_at) VALUES(?,?,?,?,?)', id, username, passwordHash, role, now);
        return { id, username, role, createdAt: now };
    }
    findByUsername(username) {
        const r = this.db.get('SELECT * FROM users WHERE username = ?', username);
        return r ? { ...toUser(r), passwordHash: r.password_hash } : undefined;
    }
    findById(id) {
        const r = this.db.get('SELECT * FROM users WHERE id = ?', id);
        return r ? toUser(r) : undefined;
    }
    updatePassword(id, passwordHash) {
        this.db.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, id);
    }
}
const hashId = (id) => crypto.createHash('sha256').update(id).digest('hex');
export class SessionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(userId, ttlMinutes) {
        const id = crypto.randomBytes(32).toString('base64url');
        const csrfToken = crypto.randomBytes(24).toString('base64url');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
        this.db.run('INSERT INTO sessions(id_hash,user_id,csrf_token,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?)', hashId(id), userId, csrfToken, now.toISOString(), now.toISOString(), expiresAt);
        return { id, csrfToken, expiresAt };
    }
    find(id) {
        const r = this.db.get('SELECT * FROM sessions WHERE id_hash = ?', hashId(id));
        return r
            ? { userId: r.user_id, csrfToken: r.csrf_token, createdAt: r.created_at, lastSeenAt: r.last_seen_at, expiresAt: r.expires_at }
            : undefined;
    }
    touch(id) {
        this.db.run('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?', new Date().toISOString(), hashId(id));
    }
    delete(id) {
        this.db.run('DELETE FROM sessions WHERE id_hash = ?', hashId(id));
    }
    deleteForUser(userId) {
        this.db.run('DELETE FROM sessions WHERE user_id = ?', userId);
    }
    purgeExpired(idleMinutes) {
        const now = new Date();
        const idleCutoff = new Date(now.getTime() - idleMinutes * 60_000).toISOString();
        return this.db.run('DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?', now.toISOString(), idleCutoff).changes;
    }
}
//# sourceMappingURL=auth.repository.js.map