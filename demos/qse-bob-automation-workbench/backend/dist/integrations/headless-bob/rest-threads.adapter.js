import { setTimeout as sleep } from 'node:timers/promises';
import { isTerminal, outputText, statusOf } from './events.js';
import { BobHttpError, BobNetworkError } from './types.js';
/**
 * Adapter for the Headless Bob "threads" REST API (`<base>/capabilities`,
 * `<base>/threads`, `<base>/threads/{id}/messages`, `<base>/runs/{id}[/events|/cancel]`,
 * `<base>/threads/{id}/files`). Contract source: headlessbob README + src/app.ts.
 */
export class RestThreadsAdapter {
    http;
    pollMs;
    kind = 'rest-threads';
    supportsFiles = true;
    constructor(http, pollMs = 2000) {
        this.http = http;
        this.pollMs = pollMs;
    }
    async testConnection() {
        try {
            // 1. Availability: unauthenticated liveness probe.
            await this.http.json('GET', '/healthz', { withApiBase: false, auth: false });
        }
        catch (e) {
            if (e instanceof BobNetworkError)
                return { state: 'connection_failed', message: e.message, capabilities: null };
            if (e instanceof BobHttpError && e.status !== 404) {
                return { state: 'connection_failed', message: `Health probe failed: ${e.message}`, capabilities: null };
            }
            if (!(e instanceof BobHttpError))
                return { state: 'connection_failed', message: e.message, capabilities: null };
        }
        try {
            // 2. Authentication + capabilities.
            const { data } = await this.http.json('GET', '/capabilities');
            const capabilities = this.toCapabilities(data);
            return {
                state: 'connected',
                message: capabilities.runtimeReady
                    ? 'Connected. Headless Bob runtime is ready.'
                    : `Connected, but Headless Bob reports its runtime is not ready${capabilities.runtimeReason ? `: ${capabilities.runtimeReason}` : ''}.`,
                capabilities
            };
        }
        catch (e) {
            if (e instanceof BobHttpError) {
                if (e.status === 401 || e.status === 403) {
                    return { state: 'auth_failed', message: `Authentication failed (HTTP ${e.status}): ${e.message}`, capabilities: null };
                }
                if (e.status === 404) {
                    return {
                        state: 'connection_failed',
                        message: `Capabilities endpoint not found at "${this.http.apiBasePath}/capabilities". Check the API base path and adapter type.`,
                        capabilities: null
                    };
                }
                return { state: 'connection_failed', message: `Unexpected response (HTTP ${e.status}): ${e.message}`, capabilities: null };
            }
            return { state: 'connection_failed', message: e.message, capabilities: null };
        }
    }
    toCapabilities(data) {
        return {
            adapter: 'rest-threads',
            runtimeReady: data.runtime?.ready === true,
            runtimeReason: data.runtime?.reason,
            features: {
                streaming: data.features?.streaming === true,
                cancellation: data.features?.cancellation === true,
                fileDownloads: data.features?.file_downloads === true,
                threads: data.features?.threads === true,
                continuation: data.features?.continuation === true
            },
            limits: {
                timeoutMs: data.limits?.timeout_ms ?? null,
                maxMessageCharacters: data.limits?.max_message_characters ?? null,
                maxConcurrentRuns: data.limits?.max_concurrent_runs ?? null,
                maxDownloadBytes: data.limits?.max_download_bytes ?? null
            },
            raw: data
        };
    }
    async startRun(input) {
        const thread = await this.http.json('POST', '/threads', { body: { title: input.title.slice(0, 120) } });
        const sent = await this.http.json('POST', `/threads/${thread.data.id}/messages`, {
            body: { content: input.prompt },
            headers: { 'idempotency-key': input.idempotencyKey }
        });
        return { runId: sent.data.run.run_id, threadId: thread.data.id };
    }
    async followRun(handle, hooks) {
        let cursor = 0;
        let streamed = '';
        let failures = 0;
        while (!hooks.signal.aborted) {
            try {
                for await (const ev of this.http.sse(`/runs/${handle.runId}/events`, hooks.signal, cursor ? `?after=${cursor}` : '')) {
                    if (ev.id && /^\d+$/.test(ev.id))
                        cursor = Number(ev.id);
                    else
                        cursor += 1;
                    const event = ev.data;
                    if (event.type === 'message.part' && event.part?.content) {
                        streamed += event.part.content;
                        hooks.onText(event.part.content);
                    }
                    const status = statusOf(event);
                    if (status)
                        hooks.onStatus(status);
                }
                failures = 0;
            }
            catch (e) {
                if (e.name === 'AbortError')
                    break;
                if (e instanceof BobHttpError && (e.status === 401 || e.status === 403 || e.status === 404))
                    throw e;
                failures += 1;
                if (failures > 10)
                    throw e instanceof Error ? e : new Error('Lost connection to Headless Bob');
            }
            // Stream ended (terminal event, proxy timeout or network drop): the run record is the source of truth.
            const run = await this.fetchRun(handle.runId).catch(() => null);
            if (run && isTerminal(run.status))
                return this.toResult(run, streamed);
            if (hooks.signal.aborted)
                break;
            await sleep(this.pollMs, undefined, { signal: hooks.signal }).catch(() => undefined);
        }
        // Aborted locally (cancellation or timeout): report Bob's actual final state if reachable.
        const final = await this.fetchRun(handle.runId).catch(() => null);
        if (final && isTerminal(final.status))
            return this.toResult(final, streamed);
        return { status: 'cancelled', output: streamed, error: 'Execution was cancelled before Headless Bob reported a final state', usage: null };
    }
    async fetchRun(runId) {
        return (await this.http.json('GET', `/runs/${runId}`)).data;
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
    async listFiles(handle, dir) {
        if (!handle.threadId)
            return [];
        const q = dir ? `?path=${encodeURIComponent(dir)}` : '';
        const { data } = await this.http.json('GET', `/threads/${handle.threadId}/files${q}`);
        return (data.items ?? []).map((i) => ({
            name: i.name,
            path: i.path,
            type: i.type === 'directory' ? 'directory' : 'file',
            size: i.size,
            downloadable: i.downloadable
        }));
    }
    async downloadFile(handle, relPath, maxBytes) {
        if (!handle.threadId)
            throw new Error('No thread available for file download');
        return this.http.binary(`/threads/${handle.threadId}/files/download?path=${encodeURIComponent(relPath)}`, maxBytes);
    }
}
//# sourceMappingURL=rest-threads.adapter.js.map