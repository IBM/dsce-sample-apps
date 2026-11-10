import crypto from 'node:crypto';
const map = (r) => ({
    id: r.id,
    url: r.url,
    owner: r.owner,
    name: r.name,
    branch: r.branch,
    status: r.status,
    error: r.error,
    tokenEnc: r.token_enc,
    dirName: r.dir_name,
    commit: r.commit_sha,
    fileCount: r.file_count === null ? null : Number(r.file_count),
    lastClonedAt: r.last_cloned_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
});
export class GitRepositoryRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    create(input) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        // Directory names are generated, never derived from user input.
        const dirName = `repo-${crypto.randomBytes(8).toString('hex')}`;
        this.db.run(`INSERT INTO repositories(id,url,owner,name,branch,status,token_enc,dir_name,created_by,created_at,updated_at)
       VALUES(?,?,?,?,?,'pending',?,?,?,?,?)`, id, input.url, input.owner, input.name, input.branch, input.tokenEnc, dirName, input.createdBy, now, now);
        return this.get(id);
    }
    get(id) {
        const r = this.db.get('SELECT * FROM repositories WHERE id = ?', id);
        return r ? map(r) : undefined;
    }
    latest() {
        const r = this.db.get('SELECT * FROM repositories ORDER BY updated_at DESC LIMIT 1');
        return r ? map(r) : undefined;
    }
    list() {
        return this.db.all('SELECT * FROM repositories ORDER BY updated_at DESC').map(map);
    }
    update(id, patch) {
        const sets = [];
        const values = [];
        const cols = {
            status: 'status',
            error: 'error',
            commit: 'commit_sha',
            fileCount: 'file_count',
            lastClonedAt: 'last_cloned_at',
            tokenEnc: 'token_enc',
            branch: 'branch'
        };
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined)
                continue;
            sets.push(`${cols[k]} = ?`);
            values.push(v);
        }
        sets.push('updated_at = ?');
        values.push(new Date().toISOString());
        this.db.run(`UPDATE repositories SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
    }
    delete(id) {
        this.db.run('DELETE FROM repositories WHERE id = ?', id);
    }
}
//# sourceMappingURL=git-repository.repository.js.map