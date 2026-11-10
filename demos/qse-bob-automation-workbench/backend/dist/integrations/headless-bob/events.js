const STATUSES = ['created', 'in-progress', 'cancelling', 'cancelled', 'completed', 'failed'];
export function isTerminal(status) {
    return status === 'completed' || status === 'failed' || status === 'cancelled';
}
export function statusOf(event) {
    const fromRun = event.run?.status;
    if (fromRun && STATUSES.includes(fromRun))
        return fromRun;
    const g = event.generic?.status;
    if (typeof g === 'string' && STATUSES.includes(g))
        return g;
    return null;
}
export function outputText(run) {
    return (run?.output ?? []).flatMap((m) => (m.parts ?? []).map((p) => p.content ?? '')).join('\n');
}
/** Splits streamed chunks into complete lines for the log view. */
export class LineBuffer {
    emit;
    pending = '';
    constructor(emit) {
        this.emit = emit;
    }
    push(text) {
        this.pending += text;
        let nl;
        while ((nl = this.pending.indexOf('\n')) >= 0) {
            const line = this.pending.slice(0, nl);
            this.pending = this.pending.slice(nl + 1);
            this.emit(line);
        }
        if (this.pending.length > 4000) {
            this.emit(this.pending);
            this.pending = '';
        }
    }
    flush() {
        if (this.pending)
            this.emit(this.pending);
        this.pending = '';
    }
}
//# sourceMappingURL=events.js.map