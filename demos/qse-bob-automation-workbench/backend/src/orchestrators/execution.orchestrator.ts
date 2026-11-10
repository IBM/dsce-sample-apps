import crypto from 'node:crypto';
import type { AppConfig } from '../config/env.js';
import type { AdapterHandle } from '../integrations/headless-bob/factory.js';
import type { BobAdapter, BobRunHandle, BobRunStatus } from '../integrations/headless-bob/types.js';
import { LineBuffer } from '../integrations/headless-bob/events.js';
import { validateQseCli } from '../integrations/qse-cli/validator.js';
import type { ExecutionStatus, ExecutionView, StepStatus } from '../models/types.js';
import type { ExecutionRecord, ExecutionRepository, ListQuery } from '../repositories/execution.repository.js';
import type { BobService } from '../services/bob.service.js';
import type { ExecutionLogService } from '../services/execution-log.service.js';
import type { QseService } from '../services/qse.service.js';
import { ReportService, toExecutionView } from '../services/report.service.js';
import type { RepositoryService } from '../services/repository.service.js';
import { AppError, conflict, notFound } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';
import { redact } from '../utils/redact.js';
import type { PathMapper } from '../utils/paths.js';
import { DEMO_BANNER, type DemoService } from '../services/demo.service.js';
import { buildPrompt, REPORT_FILE } from './prompt-builder.js';
import { STEPS } from './steps.js';

const MAX_LISTING_DEPTH = 3;
const CANCEL_GRACE_MS = 30_000;

interface Running {
  controller: AbortController;
  handle: BobRunHandle | null;
  adapter: BobAdapter | null;
  userCancelled: boolean;
  timedOut: boolean;
}

export interface StartInput {
  repositoryId: string;
  prompt: string;
}

export class ExecutionOrchestrator {
  private readonly running = new Map<string, Running>();
  private readonly queue: string[] = [];
  private readonly tasks = new Set<Promise<void>>();
  private stopping = false;

  constructor(
    private readonly repo: ExecutionRepository,
    private readonly logs: ExecutionLogService,
    private readonly bob: BobService,
    private readonly repos: RepositoryService,
    private readonly qse: QseService,
    private readonly reports: ReportService,
    private readonly mapper: PathMapper,
    private readonly config: AppConfig,
    private readonly log: Logger,
    private readonly demo: DemoService | null = null
  ) {
    // Executions orphaned by a restart cannot be followed again: record that truthfully.
    for (const e of repo.active()) {
      const note = e.bobRunId ? ` The Headless Bob run ${e.bobRunId} may still be active; check Headless Bob directly.` : '';
      this.finishStatus(e.id, 'failed', `Interrupted by a Workbench restart.${note}`);
      this.repo.steps(e.id).filter((s) => s.status === 'running' || s.status === 'pending').forEach((s) => this.repo.updateStep(e.id, s.key, { status: s.status === 'running' ? 'failed' : 'skipped' }));
      this.logs.add(e.id, 'system', 'error', `Interrupted by a Workbench restart.${note}`);
    }
  }

  // ---------- queries ----------
  get(id: string): ExecutionView {
    const e = this.repo.get(id);
    if (!e) throw notFound('Execution not found');
    return toExecutionView(e, this.repo);
  }

  list(q: ListQuery) {
    const { items, total } = this.repo.list(q);
    return { items: items.map((e) => toExecutionView(e, this.repo)), total, page: q.page, pageSize: q.pageSize };
  }

  hasActive(): boolean {
    return this.repo.active().length > 0;
  }

  // ---------- start ----------
  start(input: StartInput, userId: string | null): ExecutionView {
    if (this.stopping) throw new AppError(503, 'shutting_down', 'The service is shutting down');
    const prompt = input.prompt.trim();
    if (!prompt) throw new AppError(422, 'prompt_required', 'Enter a prompt before starting an execution');
    if (prompt.length > this.config.execution.maxPromptChars) {
      throw new AppError(422, 'prompt_too_long', `Prompt exceeds ${this.config.execution.maxPromptChars} characters`);
    }
    const pre = this.preflight(input.repositoryId);
    const id = crypto.randomUUID();
    const rec = this.repo.create({
      id,
      prompt,
      repositoryId: pre.repoId,
      repositoryUrl: pre.url,
      repositoryName: pre.name,
      branch: pre.branch,
      commit: pre.commit,
      qseVersion: pre.qseVersion,
      qsePath: pre.qsePath,
      adapter: pre.adapter,
      mock: pre.mock,
      createdBy: userId,
      steps: STEPS.map((s) => ({ key: s.key, label: s.label, source: s.source }))
    });
    this.repo.addPrompt(userId, prompt);
    this.logs.add(id, 'system', 'info', `Execution ${id} accepted${pre.mock ? ' (DEMO - replaying a recorded run; nothing is executed)' : ''}`);
    this.enqueue(rec.id);
    return toExecutionView(this.repo.get(id)!, this.repo);
  }

  /** The conditions required to start. Messages are shown to the user verbatim. */
  private preflight(repositoryId: string) {
    const bobView = this.bob.view();
    if (bobView.state !== 'connected') throw new AppError(422, 'bob_not_connected', 'Headless Bob is not connected. Test the connection first.');
    const repo = this.repos.mustGet(repositoryId);
    if (repo.status !== 'cloned') throw new AppError(422, 'repository_not_cloned', 'The repository has not been cloned successfully.');
    const q = this.qse.view();
    if (q.status !== 'valid') throw new AppError(422, 'qse_not_validated', 'The QSE CLI is not configured and validated.');
    if (!q.reachableFromBob) {
      throw new AppError(422, 'qse_not_reachable', 'The QSE CLI is not located in a directory shared with the Headless Bob container, so Bob could not run it.');
    }
    const active = this.repo.active();
    if (active.some((e) => e.repositoryId === repositoryId)) throw conflict('An execution is already running for this repository');
    return {
      repoId: repo.id,
      url: repo.url,
      name: `${repo.owner}/${repo.name}`,
      branch: repo.branch,
      commit: repo.commit,
      qseVersion: q.version,
      qsePath: q.executablePath,
      adapter: bobView.adapter,
      mock: bobView.mock
    };
  }

  private enqueue(id: string): void {
    this.queue.push(id);
    this.pump();
  }

  private pump(): void {
    while (!this.stopping && this.running.size < this.config.execution.maxConcurrent && this.queue.length) {
      const id = this.queue.shift()!;
      const e = this.repo.get(id);
      if (!e || e.status !== 'queued') continue;
      const state: Running = { controller: new AbortController(), handle: null, adapter: null, userCancelled: false, timedOut: false };
      this.running.set(id, state);
      const task = this.execute(id, state)
        .catch((err) => this.log.error({ err, executionId: id }, 'execution crashed'))
        .finally(() => {
          this.running.delete(id);
          this.pump();
        });
      this.tasks.add(task);
      void task.finally(() => this.tasks.delete(task));
    }
  }

  // ---------- helpers ----------
  private step(id: string, key: string, status: StepStatus, message?: string): void {
    this.repo.updateStep(id, key, { status, message });
    if (status === 'running') {
      const label = STEPS.find((s) => s.key === key)?.label ?? key;
      this.repo.update(id, { currentActivity: label });
    }
    this.logs.changed(id);
  }

  private finishStatus(id: string, status: ExecutionStatus, error: string | null): void {
    this.repo.update(id, { status, error, finishedAt: new Date().toISOString(), currentActivity: null });
    this.logs.changed(id);
  }

  private info(id: string, msg: string, step: string | null = null): void {
    this.logs.add(id, 'backend', 'info', msg, step);
  }

  private warn(id: string, msg: string): void {
    const e = this.repo.get(id)!;
    this.repo.update(id, { warnings: [...e.warnings, redact(msg)] });
    this.logs.add(id, 'backend', 'warn', msg);
    this.logs.changed(id);
  }

  private abortGuard(state: Running): void {
    if (state.controller.signal.aborted && !state.handle) throw new AppError(499, 'cancelled', 'Execution cancelled');
  }

  // ---------- main flow ----------
  private async execute(id: string, state: Running): Promise<void> {
    if (this.demo) return this.replay(id, state, this.demo);
    const e0 = this.repo.get(id)!;
    this.repo.update(id, { status: 'running', startedAt: new Date().toISOString() });
    this.logs.changed(id);
    let handle: AdapterHandle | null = null;
    let timer: NodeJS.Timeout | undefined;
    let current = 'validate_config';
    const advance = (key: string, message?: string) => {
      this.step(id, current, 'completed');
      current = key;
      this.step(id, key, 'running', message);
    };
    try {
      timer = setTimeout(() => {
        state.timedOut = true;
        this.logs.add(id, 'system', 'error', `Execution timeout of ${this.config.execution.timeoutMs} ms reached; cancelling.`);
        void this.requestCancel(id, state);
      }, this.config.execution.timeoutMs);

      // 1. validate configuration (re-check: state may have changed while queued)
      this.step(id, current, 'running');
      const pre = this.preflightForRun(e0);
      this.info(id, 'Configuration validated: Headless Bob connected, repository cloned, QSE CLI validated.', current);
      this.abortGuard(state);

      // 2. repository
      advance('prepare_repo');
      const repoRec = this.repos.mustGet(e0.repositoryId);
      const checkout = this.repos.checkoutPath(repoRec);
      const bobRepoPath = this.mapper.toBob(checkout);
      if (!bobRepoPath) throw new AppError(422, 'repo_not_reachable', 'Repository workspace is not in a directory shared with Headless Bob.');
      this.info(id, `Repository ${e0.repositoryName}@${e0.branch} (${(e0.commit ?? '').slice(0, 12)}) ready; ${repoRec.fileCount ?? '?'} files. Bob path: ${bobRepoPath}`, current);
      this.abortGuard(state);

      // 3. QSE
      advance('validate_qse');
      const qseRec = this.qse.record()!;
      const check = await validateQseCli(this.config.qse, qseRec.executablePath!, qseRec.versionArgs, { reachableFromBob: true, strategy: this.config.execution.strategy });
      if (!check.valid) throw new AppError(422, 'qse_invalid', `QSE CLI validation failed: ${check.message}`);
      const bobQsePath = this.mapper.toBob(check.realPath ?? qseRec.executablePath!);
      if (!bobQsePath) throw new AppError(422, 'qse_not_reachable', 'QSE CLI is not located in a directory shared with Headless Bob.');
      this.info(id, `QSE CLI validated: ${check.version}. Bob path: ${bobQsePath}`, current);
      this.abortGuard(state);

      // 4. context
      advance('prepare_context');
      handle = this.bob.getAdapter();
      state.adapter = handle.adapter;
      const prompt = buildPrompt({
        executionId: id,
        userPrompt: e0.prompt,
        repositoryUrl: e0.repositoryUrl,
        branch: e0.branch,
        commit: e0.commit,
        bobRepoPath,
        bobQsePath,
        qseVersion: check.version,
        qseUsageHint: this.config.qse.usageHint,
        supportsFiles: handle.adapter.supportsFiles
      });
      this.info(id, `Execution request prepared (${prompt.length} characters; adapter: ${pre.adapter}).`, current);
      this.abortGuard(state);

      // 5. submit
      advance('submit_prompt');
      const runHandle = await handle.adapter.startRun({ prompt, title: `QSE ${e0.repositoryName} ${id.slice(0, 8)}`, idempotencyKey: id });
      state.handle = runHandle;
      this.repo.update(id, { bobRunId: runHandle.runId, bobThreadId: runHandle.threadId });
      this.info(id, `Submitted to Headless Bob: run ${runHandle.runId}${runHandle.threadId ? `, thread ${runHandle.threadId}` : ''}.`, current);
      this.logs.changed(id);

      // 6. Headless Bob processing
      advance('bob_processing');
      const lines = new LineBuffer((line) => {
        if (line.trim()) this.logs.add(id, 'headless-bob', 'info', line, 'bob_processing');
      });
      let chars = 0;
      let lastFlush = 0;
      let lastStatus = '';
      const result = await handle.adapter.followRun(runHandle, {
        signal: state.controller.signal,
        onText: (text) => {
          chars += text.length;
          lines.push(text);
          const now = Date.now();
          if (now - lastFlush > 1000) {
            lastFlush = now;
            this.repo.update(id, { bobStreamedChars: chars });
            this.logs.changed(id);
          }
        },
        onStatus: (s: BobRunStatus) => {
          if (s !== lastStatus) {
            lastStatus = s;
            this.logs.add(id, 'headless-bob', 'info', `Headless Bob run status: ${s}`, 'bob_processing');
          }
        }
      });
      lines.flush();
      this.repo.update(id, { bobStreamedChars: Math.max(chars, result.output.length), usage: result.usage });

      if (result.status !== 'completed') {
        this.step(id, 'bob_processing', result.status === 'cancelled' ? 'cancelled' : 'failed', result.error ?? undefined);
        const reason = state.timedOut ? `Execution timed out after ${this.config.execution.timeoutMs} ms` : (result.error ?? `Headless Bob run ${result.status}`);
        this.settleTerminal(id, state, result.status === 'cancelled' ? 'cancelled' : 'failed', reason);
        return;
      }
      this.step(id, 'bob_processing', 'completed');
      this.info(id, `Headless Bob completed (${result.output.length} characters of output).`);

      // 7. results
      current = 'retrieve_results';
      this.step(id, current, 'running');
      const reportFile = await this.retrieveArtifacts(id, handle.adapter, runHandle);

      // 8. report
      advance('generate_report');
      const fresh = this.repo.get(id)!;
      let source: 'headless-bob-file' | 'headless-bob-output' | 'unavailable';
      let md: string | null;
      let detail: string;
      if (reportFile) {
        source = 'headless-bob-file';
        md = reportFile;
        detail = `workspace file ${REPORT_FILE}`;
      } else if (result.output.trim()) {
        source = 'headless-bob-output';
        md = result.output;
        detail = 'final Headless Bob answer';
        if (handle.adapter.supportsFiles) this.warn(id, `Headless Bob did not write ${REPORT_FILE}; the report is its final answer.`);
      } else {
        source = 'unavailable';
        md = null;
        detail = 'no content returned';
        this.warn(id, 'Headless Bob returned no report content.');
      }
      const report = this.reports.create({ execution: fresh, bobMarkdown: md, source, sourceDetail: detail });
      this.info(id, `Report ${report.id} stored (source: ${source}).`, current);

      // 9. done
      advance('completed');
      this.step(id, 'completed', 'completed');
      this.finishStatus(id, 'completed', null);
      this.info(id, 'Execution completed.');
    } catch (err) {
      const message = err instanceof AppError ? err.message : redact((err as Error).message ?? 'Unexpected error');
      const wasCancel = state.controller.signal.aborted || (err instanceof AppError && err.code === 'cancelled');
      this.step(id, current, wasCancel && !state.timedOut ? 'cancelled' : 'failed', message);
      if (wasCancel && !state.timedOut) this.settleTerminal(id, state, 'cancelled', 'Cancelled by user');
      else this.settleTerminal(id, state, 'failed', state.timedOut ? `Execution timed out after ${this.config.execution.timeoutMs} ms` : message);
      if (!(err instanceof AppError)) this.log.error({ err, executionId: id }, 'execution failed unexpectedly');
    } finally {
      if (timer) clearTimeout(timer);
      await handle?.close().catch(() => undefined);
    }
  }

  /**
   * STREAM_MODE=mock. Replays the recording of one real execution through the same step machine,
   * log service and SSE stream. Backend steps are paced by DEMO_STEP_DELAY_MS; the Headless Bob
   * phase replays the recorded lines at the recorded relative timing divided by DEMO_REPLAY_SPEED.
   * Nothing is executed or contacted, and every message says so.
   */
  private async replay(id: string, state: Running, demo: DemoService): Promise<void> {
    const rec = demo.recording;
    const e0 = this.repo.get(id)!;
    this.repo.update(id, { status: 'running', startedAt: new Date().toISOString() });
    this.logs.changed(id);
    let current = 'validate_config';
    const advance = (key: string) => {
      this.step(id, current, 'completed');
      current = key;
      this.step(id, key, 'running');
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(resolve, ms);
        state.controller.signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true });
      });
    const pause = async (ms: number) => {
      await wait(ms);
      if (state.controller.signal.aborted) throw new AppError(499, 'cancelled', 'Execution cancelled');
    };
    const d = this.config.demo;
    try {
      this.step(id, current, 'running');
      this.logs.add(id, 'backend', 'warn', DEMO_BANNER, current);
      this.info(id, 'Configuration validated (demo): the recorded Headless Bob connection, repository and QSE CLI are being used.', current);
      await pause(d.stepDelayMs);

      advance('prepare_repo');
      this.info(id, `Repository ${e0.repositoryName}@${e0.branch} (${(e0.commit ?? '').slice(0, 12)}) - recorded; ${rec.repository.fileCount} files. No checkout was made.`, current);
      await pause(d.stepDelayMs);

      advance('validate_qse');
      this.info(id, `QSE CLI (recorded): ${rec.qse.version}. The CLI was not executed.`, current);
      await pause(d.stepDelayMs);

      advance('prepare_context');
      this.info(id, 'Execution request prepared (demo): the prompt you entered is not sent anywhere.', current);
      await pause(d.stepDelayMs);

      advance('submit_prompt');
      this.repo.update(id, { bobRunId: rec.recordedFrom.headlessBobRunId, bobThreadId: rec.recordedFrom.headlessBobThreadId });
      this.info(id, `Recorded Headless Bob run ${rec.recordedFrom.headlessBobRunId} is being replayed. Headless Bob was not contacted.`, current);
      await pause(d.stepDelayMs);

      advance('bob_processing');
      this.logs.add(id, 'headless-bob', 'info', 'Headless Bob run status: created (recorded)', current);
      this.logs.add(id, 'headless-bob', 'info', 'Headless Bob run status: in-progress (recorded)', current);
      // The real run spent ~3.5 minutes analysing before the report streamed; compress that wait.
      await pause(d.bobWaitMs);
      let chars = 0;
      let prev = 0;
      for (const ev of rec.bobEvents) {
        await pause(Math.min(2500, Math.max(0, (ev.offsetMs - prev) / d.replaySpeed)));
        prev = ev.offsetMs;
        chars += ev.text.length + 1;
        this.logs.add(id, 'headless-bob', 'info', ev.text, current);
        this.repo.update(id, { bobStreamedChars: chars });
      }
      this.logs.add(id, 'headless-bob', 'info', 'Headless Bob run status: completed (recorded)', current);
      this.step(id, 'bob_processing', 'completed');
      this.info(id, `Recorded Headless Bob output replayed (${chars} characters).`);

      current = 'retrieve_results';
      this.step(id, current, 'running');
      await pause(d.stepDelayMs);
      for (const f of rec.files) {
        const isReport = f.path === rec.reportFile;
        this.repo.saveArtifact({ executionId: id, path: f.path, size: f.size, retrieved: isReport, contentType: f.contentType, note: isReport ? 'Headless Bob report (recorded demo)' : 'Recorded demo file' });
      }
      this.info(id, `${rec.files.length} recorded file(s) attached, including ${rec.reportFile}.`);

      advance('generate_report');
      await pause(d.stepDelayMs);
      const report = this.reports.create({
        execution: this.repo.get(id)!,
        bobMarkdown: demo.reportMarkdown(),
        source: 'headless-bob-file',
        sourceDetail: `${DEMO_BANNER} Recorded workspace file ${rec.reportFile}`,
        notice: demo.reportNote()
      });
      this.info(id, `Report ${report.id} stored (recorded demo content).`, current);

      advance('completed');
      this.step(id, 'completed', 'completed');
      this.finishStatus(id, 'completed', null);
      this.info(id, 'Execution completed (demo replay).');
    } catch (err) {
      const wasCancel = state.controller.signal.aborted || (err instanceof AppError && err.code === 'cancelled');
      const message = err instanceof AppError ? err.message : redact((err as Error).message ?? 'Unexpected error');
      this.step(id, current, wasCancel ? 'cancelled' : 'failed', message);
      this.settleTerminal(id, state, wasCancel ? 'cancelled' : 'failed', wasCancel ? 'Cancelled by user' : message);
      if (!(err instanceof AppError)) this.log.error({ err, executionId: id }, 'demo replay failed unexpectedly');
    }
  }

  private preflightForRun(e: ExecutionRecord) {
    if (!this.bob.isConnected()) throw new AppError(422, 'bob_not_connected', 'Headless Bob is no longer connected.');
    const r = this.repos.mustGet(e.repositoryId);
    if (r.status !== 'cloned') throw new AppError(422, 'repository_not_cloned', 'The repository is no longer in a cloned state.');
    if (!this.qse.isUsable()) throw new AppError(422, 'qse_not_validated', 'The QSE CLI is no longer validated.');
    return { adapter: e.adapter };
  }

  private settleTerminal(id: string, state: Running, status: 'failed' | 'cancelled', reason: string): void {
    for (const s of this.repo.steps(id)) {
      if (s.status === 'pending') this.repo.updateStep(id, s.key, { status: 'skipped' });
      else if (s.status === 'running') this.repo.updateStep(id, s.key, { status: status === 'cancelled' ? 'cancelled' : 'failed' });
    }
    this.finishStatus(id, status, status === 'cancelled' && !state.timedOut ? null : reason);
    this.logs.add(id, 'system', status === 'failed' ? 'error' : 'warn', status === 'failed' ? `Execution failed: ${reason}` : 'Execution cancelled.');
  }

  /** Lists the Headless Bob workspace for this run and fetches the report file if present. */
  private async retrieveArtifacts(id: string, adapter: BobAdapter, handle: BobRunHandle): Promise<string | null> {
    if (!adapter.supportsFiles) {
      this.info(id, 'This Headless Bob protocol does not expose workspace files; no artifacts were retrieved.');
      return null;
    }
    let reportContent: string | null = null;
    let count = 0;
    const walk = async (dir: string, depth: number): Promise<void> => {
      let entries;
      try {
        entries = await adapter.listFiles(handle, dir);
      } catch (e) {
        this.warn(id, `Could not list Headless Bob workspace${dir ? ` (${dir})` : ''}: ${(e as Error).message}`);
        return;
      }
      for (const entry of entries) {
        if (entry.type === 'directory') {
          if (depth < MAX_LISTING_DEPTH) await walk(entry.path, depth + 1);
          continue;
        }
        if (count >= this.config.execution.maxArtifacts) return;
        count++;
        const isReport = entry.path === REPORT_FILE;
        let retrieved = false;
        let note: string | null = null;
        if (isReport) {
          if (entry.downloadable && (entry.size ?? 0) <= this.config.execution.maxArtifactBytes) {
            try {
              reportContent = (await adapter.downloadFile(handle, entry.path, this.config.execution.maxArtifactBytes)).toString('utf8');
              retrieved = true;
              note = 'Headless Bob report';
            } catch (e) {
              note = `Report download failed: ${(e as Error).message}`;
              this.warn(id, note);
            }
          } else note = 'Report too large or not downloadable';
        }
        this.repo.saveArtifact({
          executionId: id,
          path: entry.path,
          size: entry.size ?? 0,
          retrieved,
          contentType: guessType(entry.path),
          note: note ?? (entry.downloadable ? null : 'Not downloadable (size limit)')
        });
      }
    };
    await walk('', 0);
    this.info(id, `Found ${count} file(s) in the Headless Bob workspace${reportContent ? `, including ${REPORT_FILE}` : ''}.`);
    return reportContent;
  }

  // ---------- cancel ----------
  async cancel(id: string): Promise<ExecutionView> {
    const e = this.repo.get(id);
    if (!e) throw notFound('Execution not found');
    if (!['queued', 'running', 'cancelling'].includes(e.status)) throw conflict(`Execution is already ${e.status}`);
    if (e.status === 'queued') {
      const idx = this.queue.indexOf(id);
      if (idx >= 0) this.queue.splice(idx, 1);
      for (const s of this.repo.steps(id)) this.repo.updateStep(id, s.key, { status: 'skipped' });
      this.finishStatus(id, 'cancelled', null);
      this.logs.add(id, 'system', 'warn', 'Execution cancelled before it started.');
      return this.get(id);
    }
    const state = this.running.get(id);
    if (!state) throw conflict('Execution is not running in this process');
    state.userCancelled = true;
    this.logs.add(id, 'system', 'warn', 'Cancellation requested by user.');
    await this.requestCancel(id, state);
    return this.get(id);
  }

  private async requestCancel(id: string, state: Running): Promise<void> {
    this.repo.update(id, { status: 'cancelling' });
    this.logs.changed(id);
    if (state.handle && state.adapter) {
      try {
        await state.adapter.cancelRun(state.handle);
        this.logs.add(id, 'backend', 'info', 'Cancel request delivered to Headless Bob; waiting for it to report the final state.', 'bob_processing');
        // Safety net: if Bob never reports a terminal state, stop following.
        setTimeout(() => state.controller.abort(), CANCEL_GRACE_MS).unref();
        return;
      } catch (e) {
        this.logs.add(id, 'backend', 'warn', `Headless Bob did not accept the cancel request (${(e as Error).message}); stopping locally.`);
      }
    }
    state.controller.abort();
  }

  // ---------- logs / artifacts ----------
  logsFor(id: string, after = 0) {
    if (!this.repo.get(id)) throw notFound('Execution not found');
    return this.logs.list(id, after);
  }

  artifacts(id: string) {
    if (!this.repo.get(id)) throw notFound('Execution not found');
    return this.repo.artifacts(id);
  }

  async downloadArtifact(id: string, artifactId: string): Promise<{ data: Buffer; name: string; contentType: string }> {
    const e = this.repo.get(id);
    if (!e) throw notFound('Execution not found');
    const a = this.repo.artifact(artifactId);
    if (!a || a.executionId !== id) throw notFound('Artifact not found');
    if (this.demo) {
      const f = this.demo.file(a.path);
      if (!f) throw notFound('Artifact is not part of the recorded demo');
      return f;
    }
    if (!e.bobRunId) throw conflict('Execution has no Headless Bob run');
    const handle = this.bob.getAdapter();
    try {
      const data = await handle.adapter.downloadFile({ runId: e.bobRunId, threadId: e.bobThreadId }, a.path, this.config.execution.maxArtifactBytes);
      return { data, name: a.path.split('/').pop() ?? 'artifact', contentType: a.contentType };
    } catch (err) {
      throw new AppError(502, 'artifact_unavailable', `Could not download artifact from Headless Bob: ${redact((err as Error).message)}`);
    } finally {
      await handle.close().catch(() => undefined);
    }
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    for (const [id, state] of this.running) {
      this.logs.add(id, 'system', 'warn', 'Workbench shutting down; stopping execution.');
      await this.requestCancel(id, state).catch(() => undefined);
    }
    await Promise.race([Promise.allSettled([...this.tasks]), new Promise((r) => setTimeout(r, 10_000).unref())]);
    for (const state of this.running.values()) state.controller.abort();
  }

}

function guessType(p: string): string {
  const ext = p.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    md: 'text/markdown',
    json: 'application/json',
    txt: 'text/plain',
    log: 'text/plain',
    csv: 'text/csv',
    html: 'text/html',
    xml: 'application/xml',
    pdf: 'application/pdf',
    sarif: 'application/json'
  };
  return map[ext] ?? 'application/octet-stream';
}
