export class QseConfigRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get() {
        const r = this.db.get('SELECT * FROM qse_config WHERE id = 1');
        if (!r)
            return undefined;
        return {
            mode: r.mode,
            executablePath: r.executable_path,
            versionArgs: JSON.parse(r.version_args),
            status: r.status,
            version: r.version,
            message: r.message,
            validatedAt: r.validated_at
        };
    }
    save(rec) {
        this.db.run(`INSERT INTO qse_config(id,mode,executable_path,version_args,status,version,message,validated_at,updated_at)
       VALUES(1,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET mode=excluded.mode, executable_path=excluded.executable_path, version_args=excluded.version_args,
         status=excluded.status, version=excluded.version, message=excluded.message, validated_at=excluded.validated_at, updated_at=excluded.updated_at`, rec.mode, rec.executablePath, JSON.stringify(rec.versionArgs), rec.status, rec.version, rec.message, rec.validatedAt, new Date().toISOString());
    }
}
//# sourceMappingURL=qse-config.repository.js.map