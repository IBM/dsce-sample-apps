import type { Db } from '../db/database.js';
import type { BobAdapterKind, BobAuthMode, BobCapabilities, BobConnectionState } from '../models/types.js';

export interface BobConnectionRecord {
  endpoint: string;
  adapter: BobAdapterKind;
  apiBasePath: string;
  authMode: BobAuthMode;
  authHeaderName: string;
  apiKeyEnc: string | null;
  apiKeyHint: string | null;
  state: BobConnectionState;
  message: string | null;
  lastTestedAt: string | null;
  capabilities: BobCapabilities | null;
}

export class BobConnectionRepository {
  constructor(private readonly db: Db) {}

  get(): BobConnectionRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM bob_connection WHERE id = 1');
    if (!r) return undefined;
    return {
      endpoint: r.endpoint,
      adapter: r.adapter,
      apiBasePath: r.api_base_path,
      authMode: r.auth_mode,
      authHeaderName: r.auth_header_name,
      apiKeyEnc: r.api_key_enc,
      apiKeyHint: r.api_key_hint,
      state: r.state,
      message: r.message,
      lastTestedAt: r.last_tested_at,
      capabilities: r.capabilities ? JSON.parse(r.capabilities) : null
    };
  }

  save(rec: BobConnectionRecord): void {
    this.db.run(
      `INSERT INTO bob_connection(id,endpoint,adapter,api_base_path,auth_mode,auth_header_name,api_key_enc,api_key_hint,state,message,last_tested_at,capabilities,updated_at)
       VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET endpoint=excluded.endpoint, adapter=excluded.adapter, api_base_path=excluded.api_base_path,
         auth_mode=excluded.auth_mode, auth_header_name=excluded.auth_header_name, api_key_enc=excluded.api_key_enc,
         api_key_hint=excluded.api_key_hint, state=excluded.state, message=excluded.message,
         last_tested_at=excluded.last_tested_at, capabilities=excluded.capabilities, updated_at=excluded.updated_at`,
      rec.endpoint,
      rec.adapter,
      rec.apiBasePath,
      rec.authMode,
      rec.authHeaderName,
      rec.apiKeyEnc,
      rec.apiKeyHint,
      rec.state,
      rec.message,
      rec.lastTestedAt,
      rec.capabilities ? JSON.stringify(rec.capabilities) : null,
      new Date().toISOString()
    );
  }

  delete(): void {
    this.db.run('DELETE FROM bob_connection WHERE id = 1');
  }
}
