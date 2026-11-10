import { setTimeout as sleep } from 'node:timers/promises';
import type { BobCapabilities } from '../../models/types.js';
import { BobHttpClient } from './http-client.js';
import { isTerminal, outputText, statusOf, type BobEvent } from './events.js';
import {
  BobHttpError,
  BobNetworkError,
  type BobAdapter,
  type BobFileEntry,
  type BobRunHandle,
  type BobRunResult,
  type ConnectionTestResult,
  type FollowHooks
} from './types.js';

interface AcpRun {
  run_id: string;
  session_id?: string;
  status: string;
  output?: NonNullable<BobEvent['run']>['output'];
  usage?: Record<string, unknown>;
  error?: { message?: string };
}

/**
 * Adapter for Headless Bob's ACP 0.2.0 endpoints (`/agents`, `/runs`, `/runs/{id}/events`).
 * ACP exposes no workspace file API, so artifacts cannot be retrieved: the report is
 * built from the final agent output only. Events are polled (async mode) so the
 * adapter works through proxies that do not support SSE.
 */
export class AcpAdapter implements BobAdapter {
  readonly kind = 'acp' as const;
  readonly supportsFiles = false;

  constructor(private readonly http: BobHttpClient, private readonly pollMs = 2000, private readonly agentName = 'headlessbob') {}

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.http.json('GET', '/ping', { auth: false });
    } catch (e) {
      if (e instanceof BobHttpError && e.status !== 404) {
        return { state: 'connection_failed', message: `Health probe failed: ${e.message}`, capabilities: null };
      }
      if (e instanceof BobNetworkError) return { state: 'connection_failed', message: e.message, capabilities: null };
    }
    try {
      const { data } = await this.http.json<{ agents?: Array<{ name: string }> }>('GET', '/agents');
      if (!data.agents?.some((a) => a.name === this.agentName)) {
        return { state: 'connection_failed', message: `Agent "${this.agentName}" is not advertised by this endpoint.`, capabilities: null };
      }
      let runtimeReady = true;
      let runtimeReason: string | undefined;
      try {
        await this.http.json('GET', '/readyz');
      } catch (e) {
        if (e instanceof BobHttpError && e.status === 503) {
          runtimeReady = false;
          runtimeReason = e.message;
        } else if (!(e instanceof BobHttpError)) throw e;
      }
      const capabilities: BobCapabilities = {
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
    } catch (e) {
      if (e instanceof BobHttpError) {
        if (e.status === 401 || e.status === 403) {
          return { state: 'auth_failed', message: `Authentication failed (HTTP ${e.status}): ${e.message}`, capabilities: null };
        }
        return { state: 'connection_failed', message: `Unexpected response (HTTP ${e.status}): ${e.message}`, capabilities: null };
      }
      return { state: 'connection_failed', message: (e as Error).message, capabilities: null };
    }
  }

  async startRun(input: { prompt: string }): Promise<BobRunHandle> {
    const { data } = await this.http.json<AcpRun>('POST', '/runs', {
      body: {
        agent_name: this.agentName,
        mode: 'async',
        input: [{ role: 'user', parts: [{ content_type: 'text/plain', content: input.prompt }] }]
      }
    });
    return { runId: data.run_id, threadId: data.session_id ?? null };
  }

  async followRun(handle: BobRunHandle, hooks: FollowHooks): Promise<BobRunResult> {
    let seen = 0;
    let streamed = '';
    let failures = 0;
    while (!hooks.signal.aborted) {
      try {
        const { data } = await this.http.json<{ events?: BobEvent[] }>('GET', `/runs/${handle.runId}/events`, { signal: hooks.signal });
        const events = data.events ?? [];
        for (const event of events.slice(seen)) {
          if (event.type === 'message.part' && event.part?.content) {
            streamed += event.part.content;
            hooks.onText(event.part.content);
          }
          const status = statusOf(event);
          if (status) hooks.onStatus(status);
        }
        seen = events.length;
        failures = 0;
        const run = (await this.http.json<AcpRun>('GET', `/runs/${handle.runId}`, { signal: hooks.signal })).data;
        if (isTerminal(run.status)) return this.toResult(run, streamed);
      } catch (e) {
        if ((e as Error).name === 'AbortError') break;
        if (e instanceof BobHttpError && [401, 403, 404].includes(e.status)) throw e;
        if (++failures > 10) throw e;
      }
      await sleep(this.pollMs, undefined, { signal: hooks.signal }).catch(() => undefined);
    }
    const final = (await this.http.json<AcpRun>('GET', `/runs/${handle.runId}`).catch(() => null))?.data;
    if (final && isTerminal(final.status)) return this.toResult(final, streamed);
    return { status: 'cancelled', output: streamed, error: 'Execution was cancelled before Headless Bob reported a final state', usage: null };
  }

  private toResult(run: AcpRun, streamed: string): BobRunResult {
    const status = run.status as 'completed' | 'failed' | 'cancelled';
    return {
      status,
      output: outputText(run as BobEvent['run']) || streamed,
      error: status === 'completed' ? null : (run.error?.message ?? `Headless Bob run ${status}`),
      usage: run.usage ?? null
    };
  }

  async cancelRun(handle: BobRunHandle): Promise<void> {
    await this.http.json('POST', `/runs/${handle.runId}/cancel`);
  }

  async listFiles(): Promise<BobFileEntry[]> {
    return [];
  }

  async downloadFile(): Promise<Buffer> {
    throw new Error('The ACP protocol does not provide workspace file downloads');
  }
}
