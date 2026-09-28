import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Config } from './config.js';
import { Store } from './storage.js';
import type { Runtime } from './runtime/bob.js';
import { RuntimeError } from './runtime/parser.js';
import { ApiError, terminal, type CreateRequest, type Event, type Message, type Run, type Session } from './types.js';
interface Job { run: Run; owner: string; prompt: string; controller: AbortController; events: number; done: Promise<void>; resolve: () => void }
export class RunManager {
  private queue: Job[] = [];
  private active = new Map<string, Job>();
  private busySessions = new Set<string>();
  private stopping = false;
  readonly bus = new EventEmitter();
  constructor(readonly store: Store, readonly runtime: Runtime, readonly config: Config) {
    this.bus.setMaxListeners(0);
    store.transaction(() => {
      for (const { run, owner } of store.allRuns()) if (!terminal(run)) {
        run.status = 'failed'; run.finished_at = new Date().toISOString();
        run.error = { code: 'server_error', message: 'Service restarted before the run finished; task was not replayed', data: { reason: 'interrupted' } };
        const session = store.session(run.session_id, owner)!; session.broken = true; store.saveSession(session);
        store.saveRun(run, owner); store.append(run.run_id, { type: 'run.failed', run });
      }
    });
  }
  get(id: string, owner: string) {
    const run = this.store.run(id, owner);
    if (!run) throw new ApiError(404, 'not_found', 'Run not found');
    return run;
  }
  getSession(id: string, owner: string) {
    const session = this.store.session(id, owner);
    if (!session) throw new ApiError(404, 'not_found', 'Session not found');
    return session;
  }
  create(input: CreateRequest, owner: string, beforeCommit?: (run: Run) => void): Run {
    if (this.stopping) throw new ApiError(503, 'server_error', 'Service is shutting down');
    if (this.queue.length + this.active.size >= this.config.maxQueued + this.config.maxConcurrent) throw new ApiError(429, 'server_error', 'Run queue is full', 'queue_full');
    let session: Session;
    if (input.session_id) {
      session = this.getSession(input.session_id, owner);
      if (!this.config.continuation) throw new ApiError(400, 'invalid_input', 'Task continuation is disabled until verified with live Bob', 'unsupported_continuation');
      if (session.broken || session.mode !== this.config.bobMode) throw new ApiError(409, 'invalid_input', 'Session cannot be continued; start a fresh session', 'session_recovery');
    } else {
      const id = randomUUID();
      session = { id, owner, workspace: this.store.newWorkspace(id), mode: this.config.bobMode, broken: false };
    }
    const run: Run = { agent_name: 'headlessbob', run_id: randomUUID(), session_id: session.id, status: 'created', output: [], created_at: new Date().toISOString() };
    this.store.transaction(() => { this.store.saveSession(session); this.store.saveRun(run, owner); this.store.append(run.run_id, { type: 'run.created', run }); beforeCommit?.(run); });
    let resolve!: () => void;
    const done = new Promise<void>(r => { resolve = r; });
    // All supplied roles are task context, never privileged service instructions.
    const prompt = input.input.map(message => `[${message.role}]\n${message.parts.map(part => part.content).join('\n')}`).join('\n\n');
    this.queue.push({ run, owner, prompt, controller: new AbortController(), events: 1, done, resolve });
    setImmediate(() => this.pump());
    return structuredClone(run);
  }
  private emit(job: Job, event: Event, save = false) {
    if (++job.events > this.config.maxEvents && !save) throw new RuntimeError('event_limit', 'Run exceeded the configured event limit');
    this.store.transaction(() => { if (save) this.store.saveRun(job.run, job.owner); this.store.append(job.run.run_id, event); });
    this.bus.emit(job.run.run_id, structuredClone(event));
  }
  private transition(job: Job, status: Run['status']) {
    job.run.status = status;
    if (terminal(job.run)) job.run.finished_at = new Date().toISOString();
    this.emit(job, { type: `run.${status}`, run: job.run }, true);
  }
  private pump() {
    if (this.stopping) return;
    while (this.active.size < this.config.maxConcurrent) {
      const index = this.queue.findIndex(job => !this.busySessions.has(job.run.session_id));
      if (index < 0) break;
      const [job] = this.queue.splice(index, 1);
      this.active.set(job.run.run_id, job); this.busySessions.add(job.run.session_id);
      void this.execute(job).finally(() => { this.active.delete(job.run.run_id); this.busySessions.delete(job.run.session_id); job.resolve(); this.pump(); });
    }
  }
  private async execute(job: Job) {
    const session = this.getSession(job.run.session_id, job.owner);
    let started = false;
    try {
      if (session.broken) throw new RuntimeError('session_recovery', 'Session has an interrupted or failed task; start a fresh session');
      let workspace: string;
      try { workspace = this.store.checkWorkspace(session); } catch { throw new RuntimeError('workspace_invalid', 'Workspace is missing or failed path validation'); }
      this.transition(job, 'in-progress'); started = true;
      let opened = false;
      const result = await this.runtime.run({ workspace, mode: session.mode, prompt: job.prompt, taskId: session.taskId, signal: job.controller.signal,
        onText: text => {
          if (job.events >= this.config.maxEvents - 6) throw new RuntimeError('event_limit', 'Run exceeded the configured event limit');
          if (!opened) { opened = true; this.emit(job, { type: 'message.created', message: { role: 'agent/headlessbob', parts: [{ content_type: 'text/plain', content: '' }] } }); }
          this.emit(job, { type: 'message.part', part: { content_type: 'text/plain', content: text } });
        }
      });
      if (job.controller.signal.aborted) throw new RuntimeError('cancelled', 'Run cancelled');
      if (session.taskId && result.taskId !== session.taskId) throw new RuntimeError('session_recovery', 'Bob returned a different task ID during continuation');
      const message: Message = { role: 'agent/headlessbob', parts: [{ content_type: 'text/plain', content: result.text }] };
      if (!opened) this.emit(job, { type: 'message.created', message: { role: message.role, parts: [{ content_type: 'text/plain', content: '' }] } });
      this.emit(job, { type: 'message.completed', message });
      if (result.usage) job.run.usage = result.usage;
      job.run.output = [message]; session.taskId = result.taskId;
      // Persist session mapping and terminal state in one transaction.
      job.run.status = 'completed'; job.run.finished_at = new Date().toISOString();
      const event: Event = { type: 'run.completed', run: job.run };
      this.store.transaction(() => { this.store.saveSession(session); this.store.saveRun(job.run, job.owner); this.store.append(job.run.run_id, event); });
      this.bus.emit(job.run.run_id, structuredClone(event));
    } catch (error) {
      const failure = error instanceof RuntimeError ? error : new RuntimeError('internal_error', 'Run failed unexpectedly');
      if (started || failure.reason === 'workspace_invalid') { session.broken = true; this.store.saveSession(session); }
      job.run.error = { code: 'server_error', message: failure.message, data: { reason: failure.reason } };
      this.transition(job, failure.reason === 'cancelled' ? 'cancelled' : 'failed');
    }
  }
  cancel(id: string, owner: string) {
    const run = this.get(id, owner);
    if (terminal(run)) return run;
    const index = this.queue.findIndex(job => job.run.run_id === id);
    if (index >= 0) { const [job] = this.queue.splice(index, 1); this.transition(job, 'cancelled'); job.resolve(); return structuredClone(job.run); }
    const job = this.active.get(id)!;
    if (job.run.status !== 'cancelling') {
      job.run.status = 'cancelling'; this.store.saveRun(job.run, owner);
      // ACP 0.2 has no run.cancelling event variant.
      this.emit(job, { type: 'generic', generic: { status: 'cancelling' } }, true);
      job.controller.abort();
    }
    return structuredClone(job.run);
  }
  async wait(id: string, owner: string) {
    const job = this.active.get(id) ?? this.queue.find(job => job.run.run_id === id);
    if (job) await job.done;
    return this.get(id, owner);
  }
  async close() {
    this.stopping = true;
    for (const job of [...this.queue, ...this.active.values()]) this.cancel(job.run.run_id, job.owner);
    await Promise.all([...this.active.values()].map(job => job.done));
  }
}
