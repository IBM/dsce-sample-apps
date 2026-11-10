import type { BobRunStatus } from './types.js';

/** Shape of events emitted by Headless Bob (REST SSE stream and ACP events list). */
export interface BobEvent {
  type: string;
  run?: { status?: string; output?: Array<{ parts?: Array<{ content?: string }> }>; usage?: Record<string, unknown>; error?: { message?: string } };
  message?: { parts?: Array<{ content?: string }> };
  part?: { content?: string };
  generic?: Record<string, unknown>;
}

const STATUSES: BobRunStatus[] = ['created', 'in-progress', 'cancelling', 'cancelled', 'completed', 'failed'];

export function isTerminal(status: string | undefined): status is 'completed' | 'failed' | 'cancelled' {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function statusOf(event: BobEvent): BobRunStatus | null {
  const fromRun = event.run?.status;
  if (fromRun && (STATUSES as string[]).includes(fromRun)) return fromRun as BobRunStatus;
  const g = event.generic?.status;
  if (typeof g === 'string' && (STATUSES as string[]).includes(g)) return g as BobRunStatus;
  return null;
}

export function outputText(run: BobEvent['run'] | undefined): string {
  return (run?.output ?? []).flatMap((m) => (m.parts ?? []).map((p) => p.content ?? '')).join('\n');
}

/** Splits streamed chunks into complete lines for the log view. */
export class LineBuffer {
  private pending = '';
  constructor(private readonly emit: (line: string) => void) {}

  push(text: string): void {
    this.pending += text;
    let nl: number;
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

  flush(): void {
    if (this.pending) this.emit(this.pending);
    this.pending = '';
  }
}
