import { setTimeout as sleep } from 'node:timers/promises';
export const MOCK_BANNER = '[MOCK] SIMULATED RUN - Headless Bob was NOT contacted and NO analysis was performed.';
/**
 * Development/test adapter. Everything it emits is explicitly labelled as simulated and it never
 * produces findings, so it cannot be mistaken for a successful real Headless Bob execution.
 * It is refused when NODE_ENV=production.
 */
export class MockAdapter {
    stepDelayMs;
    kind = 'mock';
    isMock = true;
    supportsFiles = false;
    cancelled = new Set();
    constructor(stepDelayMs = 400) {
        this.stepDelayMs = stepDelayMs;
    }
    async testConnection() {
        return {
            state: 'connected',
            message: `${MOCK_BANNER} Mock adapter is active.`,
            capabilities: {
                adapter: 'mock',
                runtimeReady: true,
                features: { streaming: true, cancellation: true, fileDownloads: false, threads: false, continuation: false },
                limits: { timeoutMs: null, maxMessageCharacters: null, maxConcurrentRuns: null, maxDownloadBytes: null }
            }
        };
    }
    async startRun(input) {
        return { runId: `mock-${input.idempotencyKey}`, threadId: null };
    }
    async followRun(handle, hooks) {
        hooks.onStatus('in-progress');
        const lines = [MOCK_BANNER, 'This output was generated locally by the mock adapter.', 'No repository was analysed and no QSE CLI was executed.'];
        let output = '';
        for (const line of lines) {
            await sleep(this.stepDelayMs).catch(() => undefined);
            if (hooks.signal.aborted || this.cancelled.has(handle.runId)) {
                return { status: 'cancelled', output, error: 'Cancelled', usage: null };
            }
            const text = `${line}\n`;
            output += text;
            hooks.onText(text);
        }
        hooks.onStatus('completed');
        return { status: 'completed', output: `# MOCK RESULT - NOT A REAL ANALYSIS\n\n${output}`, error: null, usage: null };
    }
    async cancelRun(handle) {
        this.cancelled.add(handle.runId);
    }
    async listFiles() {
        return [];
    }
    async downloadFile() {
        throw new Error('Mock adapter has no files');
    }
}
//# sourceMappingURL=mock.adapter.js.map