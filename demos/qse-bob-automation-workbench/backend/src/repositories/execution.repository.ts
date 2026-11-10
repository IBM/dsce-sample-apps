import crypto from 'node:crypto';
import type { Db } from '../db/database.js';
import type {
  ArtifactView,
  BobAdapterKind,
  ExecutionLog,
  ExecutionStatus,
  ExecutionStep,
  LogLevel,
  LogSource,
  ReportSection,
  ReportSource,
  StepSource,
  StepStatus
} from '../models/types.js';

export interface ExecutionRecord {
  id: string;
  status: ExecutionStatus;
  currentActivity: string | null;
  prompt: string;
  repositoryId: string;
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  commit: string | null;
  qseVersion: string | null;
  qsePath: string | null;
  adapter: BobAdapterKind;
  mock: boolean;
  bobRunId: string | null;
  bobThreadId: string | null;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  warnings: string[];
  usage: Record<string, unknown> | null;
  bobStreamedChars: number;
  reportId: string | null;
}

const mapExec = (r: any): ExecutionRecord => ({
  id: r.id,
  status: r.status,
  currentActivity: r.current_activity,
  prompt: r.prompt,
  repositoryId: r.repository_id,
  repositoryUrl: r.repository_url,
  repositoryName: r.repository_name,
  branch: r.branch,
  commit: r.commit_sha,
  qseVersion: r.qse_version,
  qsePath: r.qse_path,
  adapter: r.adapter,
  mock: !!r.mock,
  bobRunId: r.bob_run_id,
  bobThreadId: r.bob_thread_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  error: r.error,
  warnings: JSON.parse(r.warnings ?? '[]'),
  usage: r.usage ? JSON.parse(r.usage) : null,
  bobStreamedChars: Number(r.bob_streamed_chars ?? 0),
  reportId: r.report_id
});

export interface ListQuery {
  search?: string;
  status?: ExecutionStatus;
  sort: 'createdAt' | 'durationMs' | 'status' | 'repositoryName';
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const SORT_SQL: Record<ListQuery['sort'], string> = {
  createdAt: 'e.created_at',
  durationMs: "(julianday(COALESCE(e.finished_at, e.started_at)) - julianday(e.started_at))",
  status: 'e.status',
  repositoryName: 'e.repository_name'
};

export interface ReportRecord {
  id: string;
  executionId: string;
  source: ReportSource;
  sourceDetail: string;
  mock: boolean;
  bobMarkdown: string | null;
  markdown: string;
  sections: ReportSection[];
  generatedAt: string;
}

export class ExecutionRepository {
  constructor(private readonly db: Db) {}

  create(input: {
    id: string;
    prompt: string;
    repositoryId: string;
    repositoryUrl: string;
    repositoryName: string;
    branch: string;
    commit: string | null;
    qseVersion: string | null;
    qsePath: string | null;
    adapter: BobAdapterKind;
    mock: boolean;
    createdBy: string | null;
    steps: Array<{ key: string; label: string; source: StepSource }>;
  }): ExecutionRecord {
    const now = new Date().toISOString();
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO executions(id,status,prompt,repository_id,repository_url,repository_name,branch,commit_sha,qse_version,qse_path,adapter,mock,created_by,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        input.id,
        'queued',
        input.prompt,
        input.repositoryId,
        input.repositoryUrl,
        input.repositoryName,
        input.branch,
        input.commit,
        input.qseVersion,
        input.qsePath,
        input.adapter,
        input.mock ? 1 : 0,
        input.createdBy,
        now
      );
      input.steps.forEach((s, i) =>
        this.db.run(
          `INSERT INTO execution_steps(execution_id,key,position,label,source,status) VALUES(?,?,?,?,?,'pending')`,
          input.id,
          s.key,
          i,
          s.label,
          s.source
        )
      );
    });
    return this.get(input.id)!;
  }

  get(id: string): ExecutionRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM executions WHERE id = ?', id);
    return r ? mapExec(r) : undefined;
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        ExecutionRecord,
        | 'status'
        | 'currentActivity'
        | 'bobRunId'
        | 'bobThreadId'
        | 'startedAt'
        | 'finishedAt'
        | 'error'
        | 'warnings'
        | 'usage'
        | 'bobStreamedChars'
        | 'reportId'
      >
    >
  ): void {
    const cols: Record<string, string> = {
      status: 'status',
      currentActivity: 'current_activity',
      bobRunId: 'bob_run_id',
      bobThreadId: 'bob_thread_id',
      startedAt: 'started_at',
      finishedAt: 'finished_at',
      error: 'error',
      warnings: 'warnings',
      usage: 'usage',
      bobStreamedChars: 'bob_streamed_chars',
      reportId: 'report_id'
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      sets.push(`${cols[k]} = ?`);
      values.push(k === 'warnings' || k === 'usage' ? (v === null ? null : JSON.stringify(v)) : v);
    }
    if (!sets.length) return;
    this.db.run(`UPDATE executions SET ${sets.join(', ')} WHERE id = ?`, ...values, id);
  }

  steps(id: string): ExecutionStep[] {
    return this.db
      .all<any>('SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY position', id)
      .map((r) => ({
        key: r.key,
        label: r.label,
        source: r.source as StepSource,
        status: r.status as StepStatus,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        message: r.message
      }));
  }

  updateStep(id: string, key: string, patch: { status: StepStatus; message?: string | null }): void {
    const now = new Date().toISOString();
    if (patch.status === 'running') {
      this.db.run(
        'UPDATE execution_steps SET status = ?, started_at = COALESCE(started_at, ?), message = COALESCE(?, message) WHERE execution_id = ? AND key = ?',
        patch.status,
        now,
        patch.message ?? null,
        id,
        key
      );
    } else {
      this.db.run(
        'UPDATE execution_steps SET status = ?, finished_at = ?, message = COALESCE(?, message) WHERE execution_id = ? AND key = ?',
        patch.status,
        now,
        patch.message ?? null,
        id,
        key
      );
    }
  }

  addLog(executionId: string, source: LogSource, level: LogLevel, message: string, step: string | null): ExecutionLog {
    const ts = new Date().toISOString();
    const r = this.db.run(
      'INSERT INTO execution_logs(execution_id,ts,source,level,step,message) VALUES(?,?,?,?,?,?)',
      executionId,
      ts,
      source,
      level,
      step,
      message
    );
    return { id: r.lastId, executionId, ts, source, level, step, message };
  }

  logs(executionId: string, afterId = 0, limit = 5000): ExecutionLog[] {
    return this.db
      .all<any>('SELECT * FROM execution_logs WHERE execution_id = ? AND id > ? ORDER BY id LIMIT ?', executionId, afterId, limit)
      .map((r) => ({
        id: Number(r.id),
        executionId: r.execution_id,
        ts: r.ts,
        source: r.source,
        level: r.level,
        step: r.step,
        message: r.message
      }));
  }

  list(q: ListQuery): { items: ExecutionRecord[]; total: number } {
    const where: string[] = [];
    const params: any[] = [];
    if (q.status) {
      where.push('e.status = ?');
      params.push(q.status);
    }
    if (q.search) {
      const like = `%${q.search.replace(/[\\%_]/g, '\\$&')}%`;
      where.push("(e.id LIKE ? ESCAPE '\\' OR e.repository_name LIKE ? ESCAPE '\\' OR e.repository_url LIKE ? ESCAPE '\\' OR e.prompt LIKE ? ESCAPE '\\')");
      params.push(like, like, like, like);
    }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(this.db.get<{ c: number }>(`SELECT COUNT(*) AS c FROM executions e ${w}`, ...params)?.c ?? 0);
    const dir = q.direction === 'asc' ? 'ASC' : 'DESC';
    const rows = this.db.all<any>(
      `SELECT e.* FROM executions e ${w} ORDER BY ${SORT_SQL[q.sort]} ${dir}, e.created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      q.pageSize,
      (q.page - 1) * q.pageSize
    );
    return { items: rows.map(mapExec), total };
  }

  active(): ExecutionRecord[] {
    return this.db.all<any>("SELECT * FROM executions WHERE status IN ('queued','running','cancelling')").map(mapExec);
  }

  delete(id: string): void {
    this.db.run('DELETE FROM executions WHERE id = ?', id);
  }

  // Reports
  saveReport(r: Omit<ReportRecord, 'id'> & { id?: string }): ReportRecord {
    const id = r.id ?? crypto.randomUUID();
    this.db.run(
      `INSERT INTO reports(id,execution_id,source,source_detail,mock,bob_markdown,markdown,sections,generated_at)
       VALUES(?,?,?,?,?,?,?,?,?)
       ON CONFLICT(execution_id) DO UPDATE SET source=excluded.source, source_detail=excluded.source_detail, mock=excluded.mock,
         bob_markdown=excluded.bob_markdown, markdown=excluded.markdown, sections=excluded.sections, generated_at=excluded.generated_at`,
      id,
      r.executionId,
      r.source,
      r.sourceDetail,
      r.mock ? 1 : 0,
      r.bobMarkdown,
      r.markdown,
      JSON.stringify(r.sections),
      r.generatedAt
    );
    return this.reportByExecution(r.executionId)!;
  }

  private mapReport(r: any): ReportRecord {
    return {
      id: r.id,
      executionId: r.execution_id,
      source: r.source,
      sourceDetail: r.source_detail,
      mock: !!r.mock,
      bobMarkdown: r.bob_markdown,
      markdown: r.markdown,
      sections: JSON.parse(r.sections),
      generatedAt: r.generated_at
    };
  }

  report(id: string): ReportRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM reports WHERE id = ?', id);
    return r ? this.mapReport(r) : undefined;
  }

  reportByExecution(executionId: string): ReportRecord | undefined {
    const r = this.db.get<any>('SELECT * FROM reports WHERE execution_id = ?', executionId);
    return r ? this.mapReport(r) : undefined;
  }

  // Artifacts
  saveArtifact(a: Omit<ArtifactView, 'id'>): ArtifactView {
    const id = crypto.randomUUID();
    this.db.run(
      `INSERT INTO artifacts(id,execution_id,path,size,retrieved,content_type,note) VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(execution_id,path) DO UPDATE SET size=excluded.size, retrieved=excluded.retrieved, content_type=excluded.content_type, note=excluded.note`,
      id,
      a.executionId,
      a.path,
      a.size,
      a.retrieved ? 1 : 0,
      a.contentType,
      a.note
    );
    return this.artifactByPath(a.executionId, a.path)!;
  }

  private mapArtifact(r: any): ArtifactView {
    return {
      id: r.id,
      executionId: r.execution_id,
      path: r.path,
      size: Number(r.size),
      retrieved: !!r.retrieved,
      contentType: r.content_type,
      note: r.note
    };
  }

  artifacts(executionId: string): ArtifactView[] {
    return this.db.all<any>('SELECT * FROM artifacts WHERE execution_id = ? ORDER BY path', executionId).map((r) => this.mapArtifact(r));
  }

  artifact(id: string): ArtifactView | undefined {
    const r = this.db.get<any>('SELECT * FROM artifacts WHERE id = ?', id);
    return r ? this.mapArtifact(r) : undefined;
  }

  artifactByPath(executionId: string, p: string): ArtifactView | undefined {
    const r = this.db.get<any>('SELECT * FROM artifacts WHERE execution_id = ? AND path = ?', executionId, p);
    return r ? this.mapArtifact(r) : undefined;
  }

  // Prompt history
  addPrompt(userId: string | null, prompt: string): void {
    this.db.run('INSERT INTO prompt_history(user_id,prompt,created_at) VALUES(?,?,?)', userId, prompt, new Date().toISOString());
    this.db.run('DELETE FROM prompt_history WHERE id NOT IN (SELECT id FROM prompt_history ORDER BY id DESC LIMIT 200)');
  }

  prompts(limit = 25): Array<{ id: number; prompt: string; createdAt: string }> {
    return this.db
      .all<any>(
        'SELECT MAX(id) AS id, prompt, MAX(created_at) AS created_at FROM prompt_history GROUP BY prompt ORDER BY id DESC LIMIT ?',
        limit
      )
      .map((r) => ({ id: Number(r.id), prompt: r.prompt, createdAt: r.created_at }));
  }
}
