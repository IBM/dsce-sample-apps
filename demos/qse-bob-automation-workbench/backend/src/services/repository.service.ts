import fs from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../config/env.js';
import { GitClient } from '../integrations/github/git-client.js';
import { parseRepositoryUrl, validateBranch } from '../integrations/github/url.js';
import type { RepositoryView } from '../models/types.js';
import type { ExecutionRepository } from '../repositories/execution.repository.js';
import type { GitRepositoryRepository, RepoRecord } from '../repositories/git-repository.repository.js';
import { AppError, conflict, notFound } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import { isInside } from '../utils/paths.js';
import { redact, redactor } from '../utils/redact.js';
import { DEMO_BANNER, type DemoService } from './demo.service.js';
import type { SecretBox } from '../utils/secret-box.js';

export interface CloneInput {
  url: string;
  branch: string;
  token?: string;
}

export class RepositoryService {
  private readonly progress = new Map<string, string[]>();
  private readonly running = new Map<string, AbortController>();
  private readonly tasks = new Set<Promise<void>>();
  private readonly git: GitClient;

  constructor(
    private readonly repo: GitRepositoryRepository,
    private readonly executions: ExecutionRepository,
    private readonly box: SecretBox,
    private readonly config: AppConfig,
    private readonly log: Logger,
    private readonly demo: DemoService | null = null
  ) {
    this.git = new GitClient({ gitBin: config.github.gitBin, timeoutMs: config.github.cloneTimeoutMs });
    fs.mkdirSync(config.workspaceRoot, { recursive: true, mode: 0o755 });
    // Clones interrupted by a restart cannot be resumed; mark them failed.
    for (const r of repo.list()) {
      if (r.status === 'cloning' || r.status === 'validating') repo.update(r.id, { status: 'failed', error: 'Interrupted by a server restart. Re-clone the repository.' });
    }
  }

  view(r: RepoRecord): RepositoryView {
    return {
      id: r.id,
      url: r.url,
      name: r.name,
      owner: r.owner,
      branch: r.branch,
      status: r.status,
      error: r.error,
      hasToken: Boolean(r.tokenEnc),
      commit: r.commit,
      fileCount: r.fileCount,
      lastClonedAt: r.lastClonedAt,
      createdAt: r.createdAt,
      workspaceLabel: r.status === 'cloned' ? (this.demo ? 'demo (recorded - no checkout exists)' : `${r.dirName}/repo`) : null,
      progress: this.progress.get(r.id) ?? []
    };
  }

  list(): RepositoryView[] {
    return this.repo.list().map((r) => this.view(r));
  }

  get(id: string): RepositoryView {
    return this.view(this.mustGet(id));
  }

  mustGet(id: string): RepoRecord {
    const r = this.repo.get(id);
    if (!r) throw notFound('Repository not found');
    return r;
  }

  /** Absolute path of the checkout inside the controlled workspace (backend view). */
  checkoutPath(r: RepoRecord): string {
    const root = fs.realpathSync(this.config.workspaceRoot);
    const dir = path.join(root, r.dirName, 'repo');
    const real = fs.realpathSync(dir);
    if (!isInside(root, real) || real === root) throw new AppError(500, 'workspace_invalid', 'Repository workspace failed path validation');
    return real;
  }

  async validate(input: CloneInput): Promise<{ valid: true; url: string; owner: string; name: string; branch: string; commit: string; demo?: true; notice?: string }> {
    if (this.demo) {
      parseRepositoryUrl(input.url, this.config.github.allowedHosts);
      validateBranch(input.branch);
      const r = this.demo.recording.repository;
      return { valid: true, url: r.url, owner: r.owner, name: r.name, branch: r.branch, commit: r.commit, demo: true, notice: `${DEMO_BANNER} The repository was not contacted; the recorded repository is shown instead.` };
    }
    const parsed = parseRepositoryUrl(input.url, this.config.github.allowedHosts);
    const branch = validateBranch(input.branch);
    const token = input.token?.trim() || null;
    if (token && (token.length < 8 || token.length > 255 || /\s/.test(token))) throw new AppError(400, 'invalid_token', 'Access token format is invalid');
    if (token) redactor.register(token);
    const { commit } = await this.git.validateRemote(parsed.url, branch, token);
    return { valid: true, url: parsed.url, owner: parsed.owner, name: parsed.name, branch, commit };
  }

  private assertNotInUse(repoId: string): void {
    const active = this.executions.active().find((e) => e.repositoryId === repoId);
    if (active) throw conflict(`Repository is in use by execution ${active.id}`);
  }

  /** STREAM_MODE=mock: no git call is made and no token is stored; the recorded repository is presented. */
  private demoClone(rec: RepoRecord): void {
    const r = this.demo!.recording.repository;
    this.progress.set(rec.id, [
      DEMO_BANNER,
      'No git clone was performed and no files were fetched.',
      `Using the recorded repository ${r.owner}/${r.name}@${r.branch} (${r.commit.slice(0, 12)}, ${r.fileCount} files).`
    ]);
    this.repo.update(rec.id, { status: 'cloned', error: null, commit: r.commit, fileCount: r.fileCount, lastClonedAt: new Date().toISOString() });
  }

  async clone(input: CloneInput, userId: string | null): Promise<RepositoryView> {
    if (this.demo) {
      parseRepositoryUrl(input.url, this.config.github.allowedHosts);
      validateBranch(input.branch);
      const r = this.demo.recording.repository;
      const rec = this.repo.create({ url: r.url, owner: r.owner, name: r.name, branch: r.branch, tokenEnc: null, createdBy: userId });
      this.demoClone(rec);
      return this.get(rec.id);
    }
    const parsed = parseRepositoryUrl(input.url, this.config.github.allowedHosts);
    const branch = validateBranch(input.branch);
    const token = input.token?.trim() || null;
    if (token && (token.length < 8 || token.length > 255 || /\s/.test(token))) throw new AppError(400, 'invalid_token', 'Access token format is invalid');
    if (token) redactor.register(token);
    const rec = this.repo.create({
      url: parsed.url,
      owner: parsed.owner,
      name: parsed.name,
      branch,
      tokenEnc: token ? this.box.seal(token) : null,
      createdBy: userId
    });
    this.startClone(rec, token);
    return this.get(rec.id);
  }

  async reclone(id: string, override?: { branch?: string; token?: string }): Promise<RepositoryView> {
    const rec = this.mustGet(id);
    if (this.running.has(id)) throw conflict('A clone is already in progress for this repository');
    this.assertNotInUse(id);
    if (this.demo) {
      this.demoClone(rec);
      return this.get(id);
    }
    let token: string | null = null;
    if (override?.token?.trim()) {
      token = override.token.trim();
      this.repo.update(id, { tokenEnc: this.box.seal(token) });
    } else if (rec.tokenEnc) {
      token = this.box.open(rec.tokenEnc);
    }
    if (token) redactor.register(token);
    if (override?.branch) this.repo.update(id, { branch: validateBranch(override.branch) });
    this.startClone(this.mustGet(id), token);
    return this.get(id);
  }

  private startClone(rec: RepoRecord, token: string | null): void {
    const controller = new AbortController();
    this.running.set(rec.id, controller);
    this.progress.set(rec.id, ['Starting clone…']);
    this.repo.update(rec.id, { status: 'cloning', error: null });
    const task = (async () => {
      try {
        const root = fs.realpathSync(this.config.workspaceRoot);
        const work = path.join(root, rec.dirName);
        if (!isInside(root, work) || work === root) throw new AppError(500, 'workspace_invalid', 'Invalid workspace path');
        fs.mkdirSync(work, { recursive: true, mode: 0o755 });
        const lines = this.progress.get(rec.id)!;
        const result = await this.git.clone(
          rec.url,
          rec.branch,
          token,
          work,
          (line) => {
            lines.push(this.scrubPaths(line, root));
            if (lines.length > 30) lines.splice(0, lines.length - 30);
          },
          controller.signal
        );
        this.repo.update(rec.id, {
          status: 'cloned',
          error: null,
          commit: result.commit,
          fileCount: result.fileCount,
          lastClonedAt: new Date().toISOString()
        });
        lines.push(`Clone complete: ${result.fileCount} files at ${result.commit.slice(0, 12)}`);
        this.log.info({ repoId: rec.id, files: result.fileCount }, 'repository cloned');
      } catch (e) {
        const message = e instanceof AppError ? e.message : redact((e as Error).message);
        this.repo.update(rec.id, { status: 'failed', error: message });
        this.progress.get(rec.id)?.push(`Failed: ${message}`);
        this.log.warn({ repoId: rec.id, err: e }, 'repository clone failed');
      } finally {
        this.running.delete(rec.id);
      }
    })();
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task));
  }

  /** Progress is shown in the browser: never leak internal filesystem paths. */
  private scrubPaths(line: string, realRoot: string): string {
    let out = line;
    for (const p of new Set([realRoot, this.config.workspaceRoot])) out = out.split(p).join('<workspace>');
    return out;
  }

  /** Clear Workspace: removes the checkout and record. */
  async remove(id: string): Promise<void> {
    const rec = this.mustGet(id);
    this.assertNotInUse(id);
    this.running.get(id)?.abort();
    const root = fs.realpathSync(this.config.workspaceRoot);
    const work = path.join(root, rec.dirName);
    if (isInside(root, work) && work !== root) fs.rmSync(work, { recursive: true, force: true });
    this.progress.delete(id);
    this.repo.delete(id);
  }

  reencrypt(): number {
    let n = 0;
    for (const r of this.repo.list()) {
      if (!r.tokenEnc) continue;
      this.repo.update(r.id, { tokenEnc: this.box.seal(this.box.open(r.tokenEnc)) });
      n++;
    }
    return n;
  }

  async shutdown(): Promise<void> {
    for (const c of this.running.values()) c.abort();
    await Promise.allSettled([...this.tasks]);
  }
}
