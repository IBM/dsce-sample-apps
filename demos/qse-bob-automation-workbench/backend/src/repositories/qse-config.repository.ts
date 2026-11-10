import type { Db } from '../db/database.js';
import type { QseMode, QseStatus } from '../models/types.js';

export interface QseRecord {
  mode: QseMode | null;
  executablePath: string | null;
  versionArgs: string[];
  status: QseStatus;
  version: string | null;
  message: string | null;
  validatedAt: string | null;
}

export class QseConfigRepository {
  constructor(private readonly db: Db) {}

  get(): QseRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM qse_config WHERE id = 1');
    if (!r) return undefined;
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

  save(rec: QseRecord): void {
    this.db.run(
      `INSERT INTO qse_config(id,mode,executable_path,version_args,status,version,message,validated_at,updated_at)
       VALUES(1,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET mode=excluded.mode, executable_path=excluded.executable_path, version_args=excluded.version_args,
         status=excluded.status, version=excluded.version, message=excluded.message, validated_at=excluded.validated_at, updated_at=excluded.updated_at`,
      rec.mode,
      rec.executablePath,
      JSON.stringify(rec.versionArgs),
      rec.status,
      rec.version,
      rec.message,
      rec.validatedAt,
      new Date().toISOString()
    );
  }
}
