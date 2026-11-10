import { EventEmitter } from 'node:events';
import type { ExecutionRepository } from '../repositories/execution.repository.js';
import type { ExecutionLog, LogLevel, LogSource } from '../models/types.js';
import { redact } from '../utils/redact.js';

export type ExecutionBusEvent = { type: 'log'; log: ExecutionLog } | { type: 'execution'; executionId: string };

const MAX_LINE = 4000;

/** Persists execution logs (with secret redaction) and fans them out to live subscribers. */
export class ExecutionLogService {
  readonly bus = new EventEmitter();

  constructor(private readonly repo: ExecutionRepository) {
    this.bus.setMaxListeners(0);
  }

  add(executionId: string, source: LogSource, level: LogLevel, message: string, step: string | null = null): ExecutionLog {
    let text = redact(message);
    if (text.length > MAX_LINE) text = `${text.slice(0, MAX_LINE)}… [truncated]`;
    const log = this.repo.addLog(executionId, source, level, text, step);
    this.bus.emit(executionId, { type: 'log', log } satisfies ExecutionBusEvent);
    return log;
  }

  /** Notifies subscribers that the execution record or its steps changed. */
  changed(executionId: string): void {
    this.bus.emit(executionId, { type: 'execution', executionId } satisfies ExecutionBusEvent);
  }

  list(executionId: string, after = 0): ExecutionLog[] {
    return this.repo.logs(executionId, after);
  }

  subscribe(executionId: string, handler: (e: ExecutionBusEvent) => void): () => void {
    this.bus.on(executionId, handler);
    return () => this.bus.off(executionId, handler);
  }
}
