import { setTimeout as sleep } from 'node:timers/promises';
import { isTerminal, outputText, statusOf } from './events.js';
import { BobHttpError, BobNetworkError } from './types.js';
/**
 * Adapter for Headless Bob's ACP 0.2.0 endpoints (`/agents`, `/runs`, `/runs/{id}/events`).
 * ACP exposes no workspace file API, so artifacts cannot be retrieved: the report is
 * built from the final agent output only. Events are polled (async mode) so the
 * adapter works through proxies that do not support SSE.
 */
export class AcpAdapter {
    http;
    pollMs;
    agentName;
    kind = 'acp';
    supportsFiles = false;
    constructor(http, pollMs = 2000, agentName = 'headlessbob') {
        this.http = http;
        this.pollMs = pollMs;
        this.agentName = agentName;
    }
    async testConnection() {
        try {
            await this.http.json('GET', '/ping', { auth: false });
        }
        catch (e) {
            if (e instanceof BobHttpError && e.status !== 404) {
                return { state: 'connection_failed', message: `Health probe failed: ${e.message}`, capabilities: null };
            }
            if (e instanceof BobNetworkError)
                return { state: 'connection_failed', message: e.message, capabilities: null };
        }
        try {
            const { data } = await this.http.json('GET', '/agents');
            if (!data.agents?.some((a) => a.name === this.agentName)) {
                return { state: 'connection_failed', message: `Agent "${this.agentName}" is not advertised by this endpoint.`, capabilities: null };
            }
            let runtimeReady = true;
            let runtimeReason;
            try {
                await this.http.json('GET', '/readyz');
            }
            catch (e) {
                if (e instanceof BobHttpError && e.status === 503) {
                    runtimeReady = false;
                    runtimeReason = e.message;
                }
                else if (!(e instanceof BobHttpError))
                    throw e;
            }
            const capabilities = {
                adapter: 'acp',
                runtimeReady,
                runtimeReason,
                features: { streaming: false, cancellation: true, fileDownloads: false, threads: false, continuation: false },
                limits: { timeoutMs: null, maxMessageCharacters: null, maxConcurrentRuns: null, maxDownloadBytes: null },
                raw: data
            };
            return {
                state: 'connected',
                message: runtimeReady ? 'Connected over ACP. Workspace file retrieval is not available on this protocol.' : `Connected over ACP, but runtime not ready: ${runtimeReason}`,
                capabilities
            };
        }
        catch (e) {
            if (e instanceof BobHttpError) {
                if (e.status === 401 || e.status === 403) {
                    return { state: 'auth_failed', message: `Authentication failed (HTTP ${e.status}): ${e.message}`, capabilities: null };
                }
                return { state: 'connection_failed', message: `Unexpected response (HTTP ${e.status}): ${e.message}`, capabilities: null };
            }
            return { state: 'connection_failed', message: e.message, capabilities: null };
        }
    }
    async startRun(input) {
        const { data } = await this.http.json('POST', '/runs', {
            body: {
                agent_name: this.agentName,
                mode: 'async',
                input: [{ role: 'user', parts: [{ content_type: 'text/plain', content: input.prompt }] }]
            }
        });
        return { runId: data.run_id, threadId: data.session_id ?? null };
    }
    async followRun(handle, hooks) {
        let seen = 0;
        let streamed = '';
        let failures = 0;
        while (!hooks.signal.aborted) {
            try {
                const { data } = await this.http.json('GET', `/runs/${handle.runId}/events`, { signal: hooks.signal });
                const events = data.events ?? [];
                for (const event of events.slice(seen)) {
                    if (event.type === 'message.part' && event.part?.content) {
                        streamed += event.part.content;
                        hooks.onText(event.part.content);
                    }
                    const status = statusOf(event);
                    if (status)
                        hooks.onStatus(status);
                }
                seen = events.length;
                failures = 0;
                const run = (await this.http.json('GET', `/runs/${handle.runId}`, { signal: hooks.signal })).data;
                if (isTerminal(run.status))
                    return this.toResult(run, streamed);
            }
            catch (e) {
                if (e.name === 'AbortError')
                    break;
                if (e instanceof BobHttpError && [401, 403, 404].includes(e.status))
                    throw e;
                if (++failures > 10)
                    throw e;
            }
            await sleep(this.pollMs, undefined, { signal: hooks.signal }).catch(() => undefined);
        }
        const final = (await this.http.json('GET', `/runs/${handle.runId}`).catch(() => null))?.data;
        if (final && isTerminal(final.status))
            return this.toResult(final, streamed);
        return { status: 'cancelled', output: streamed, error: 'Execution was cancelled before Headless Bob reported a final state', usage: null };
    }
    toResult(run, streamed) {
        const status = run.status;
        return {
            status,
            output: outputText(run) || streamed,
            error: status === 'completed' ? null : (run.error?.message ?? `Headless Bob run ${status}`),
            usage: run.usage ?? null
        };
    }
    async cancelRun(handle) {
        await this.http.json('POST', `/runs/${handle.runId}/cancel`);
    }
    async listFiles() {
        return [];
    }
    async downloadFile() {
        throw new Error('The ACP protocol does not provide workspace file downloads');
    }
}
//# sourceMappingURL=acp.adapter.js.map