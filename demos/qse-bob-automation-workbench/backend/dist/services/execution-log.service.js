import { EventEmitter } from 'node:events';
import { redact } from '../utils/redact.js';
const MAX_LINE = 4000;
/** Persists execution logs (with secret redaction) and fans them out to live subscribers. */
export class ExecutionLogService {
    repo;
    bus = new EventEmitter();
    constructor(repo) {
        this.repo = repo;
        this.bus.setMaxListeners(0);
    }
    add(executionId, source, level, message, step = null) {
        let text = redact(message);
        if (text.length > MAX_LINE)
            text = `${text.slice(0, MAX_LINE)}… [truncated]`;
        const log = this.repo.addLog(executionId, source, level, text, step);
        this.bus.emit(executionId, { type: 'log', log });
        return log;
    }
    /** Notifies subscribers that the execution record or its steps changed. */
    changed(executionId) {
        this.bus.emit(executionId, { type: 'execution', executionId });
    }
    list(executionId, after = 0) {
        return this.repo.logs(executionId, after);
    }
    subscribe(executionId, handler) {
        this.bus.on(executionId, handler);
        return () => this.bus.off(executionId, handler);
    }
}
//# sourceMappingURL=execution-log.service.js.map