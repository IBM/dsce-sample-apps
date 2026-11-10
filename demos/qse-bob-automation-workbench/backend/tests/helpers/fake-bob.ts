import http from 'node:http';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

interface FakeRun {
  id: string;
  threadId: string;
  status: 'in-progress' | 'completed' | 'failed' | 'cancelled';
  events: Array<Record<string, unknown>>;
  output: string;
  prompt: string;
}

export interface FakeBobOptions {
  token: string;
  /** Run stays in-progress until cancelled. */
  hold?: boolean;
  /** Run ends as failed. */
  fail?: boolean;
  /** Write the report file into the workspace. */
  writeReportFile?: boolean;
  runtimeReady?: boolean;
}

/** In-process stand-in that implements the documented Headless Bob REST threads contract. */
export class FakeBob {
  server!: http.Server;
  url = '';
  runs = new Map<string, FakeRun>();
  files = new Map<string, Map<string, Buffer>>();
  requests: Array<{ method: string; path: string; auth: string | undefined }> = [];
  constructor(public opts: FakeBobOptions) {}

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((r) => this.server.close(() => r()));
  }

  private json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private async body(req: http.IncomingMessage): Promise<any> {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString();
    return text ? JSON.parse(text) : {};
  }

  private publicRun(r: FakeRun) {
    return {
      agent_name: 'headlessbob',
      run_id: r.id,
      session_id: r.threadId,
      status: r.status,
      output: r.status === 'in-progress' ? [] : [{ role: 'agent/headlessbob', parts: [{ content_type: 'text/plain', content: r.output }] }],
      created_at: new Date().toISOString(),
      ...(r.status === 'failed' ? { error: { code: 'server_error', message: 'Bob ACP exited before completion' } } : {})
    };
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://x');
    const p = url.pathname;
    this.requests.push({ method: req.method ?? '', path: p, auth: req.headers.authorization });
    if (p === '/healthz') return this.json(res, 200, { status: 'ok' });
    if (req.headers.authorization !== `Bearer ${this.opts.token}`) {
      return this.json(res, 401, { error: { code: 'unauthorized', message: 'A valid bearer token is required' } });
    }
    if (req.method === 'GET' && p === '/api/v1/capabilities') {
      return this.json(res, 200, {
        caller: 'owner',
        runtime: { ready: this.opts.runtimeReady ?? true },
        features: { streaming: true, cancellation: true, continuation: false, file_downloads: true, threads: true },
        limits: { timeout_ms: 300000, max_message_characters: 20000, max_concurrent_runs: 2, max_download_bytes: 26214400 }
      });
    }
    if (req.method === 'POST' && p === '/api/v1/threads') {
      const b = await this.body(req);
      return this.json(res, 201, { id: crypto.randomUUID(), title: b.title ?? 'New thread', status: 'empty' });
    }
    const msg = /^\/api\/v1\/threads\/([a-f0-9-]{36})\/messages$/.exec(p);
    if (req.method === 'POST' && msg) {
      const b = await this.body(req);
      const run: FakeRun = { id: crypto.randomUUID(), threadId: msg[1], status: 'in-progress', events: [], output: '', prompt: b.content };
      this.runs.set(run.id, run);
      run.events.push({ type: 'run.created', run: { status: 'created' } }, { type: 'run.in-progress', run: { status: 'in-progress' } });
      void this.simulate(run);
      return this.json(res, 202, { thread: { id: msg[1] }, run: this.publicRun(run), events_url: `/api/v1/runs/${run.id}/events` });
    }
    const runRoute = /^\/api\/v1\/runs\/([a-f0-9-]{36})(?:\/(cancel|events))?$/.exec(p);
    if (runRoute) {
      const run = this.runs.get(runRoute[1]);
      if (!run) return this.json(res, 404, { error: { code: 'not_found', message: 'Run not found' } });
      if (!runRoute[2]) return this.json(res, 200, this.publicRun(run));
      if (runRoute[2] === 'cancel') {
        if (run.status === 'in-progress') this.finish(run, 'cancelled');
        return this.json(res, 202, this.publicRun(run));
      }
      const after = Number(url.searchParams.get('after') ?? 0);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      let sent = after;
      const tick = () => {
        while (sent < run.events.length) {
          sent++;
          res.write(`id: ${sent}\ndata: ${JSON.stringify(run.events[sent - 1])}\n\n`);
        }
        if (run.status !== 'in-progress') {
          clearInterval(timer);
          res.end();
        }
      };
      const timer = setInterval(tick, 20);
      res.on('close', () => clearInterval(timer));
      tick();
      return;
    }
    const filesRoute = /^\/api\/v1\/threads\/([a-f0-9-]{36})\/files(?:\/(download))?$/.exec(p);
    if (req.method === 'GET' && filesRoute) {
      const ws = this.files.get(filesRoute[1]) ?? new Map();
      if (!filesRoute[2]) {
        return this.json(res, 200, {
          path: '',
          truncated: false,
          items: [...ws.entries()].map(([name, buf]) => ({ name, path: name, type: 'file', size: buf.length, modified_at: new Date().toISOString(), downloadable: true }))
        });
      }
      const file = ws.get(url.searchParams.get('path') ?? '');
      if (!file) return this.json(res, 404, { error: { code: 'not_found', message: 'File or directory is unavailable' } });
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(file);
    }
    this.json(res, 404, { error: { code: 'not_found', message: 'Route not found' } });
  }

  private finish(run: FakeRun, status: FakeRun['status']) {
    run.status = status;
    run.events.push({ type: `run.${status}`, run: this.publicRun(run) });
  }

  private async simulate(run: FakeRun) {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    run.events.push({ type: 'message.created', message: { role: 'agent/headlessbob', parts: [{ content_type: 'text/plain', content: '' }] } });
    const chunks = ['Running QSE scan...\n', 'QSE scan finished.\n'];
    for (const c of chunks) {
      await sleep(30);
      if (run.status !== 'in-progress') return;
      run.output += c;
      run.events.push({ type: 'message.part', part: { content_type: 'text/plain', content: c } });
    }
    if (this.opts.hold) return;
    await sleep(30);
    if (run.status !== 'in-progress') return;
    if (this.opts.fail) return this.finish(run, 'failed');
    const report = [
      '## Executive Summary',
      'Scanned the repository with the QSE CLI.',
      '',
      '## Quantum-Safe Assessment',
      '- RSA-2048 key generation found in `src/crypto.java` (from QSE output).',
      '',
      '## Recommendations',
      '1. Migrate RSA to ML-KEM hybrid.',
      '',
      '## Conclusion',
      'Plan migration.'
    ].join('\n');
    run.output = report;
    if (this.opts.writeReportFile) {
      this.files.set(run.threadId, new Map([['qse-e2e-report.md', Buffer.from(report)], ['scan-output.json', Buffer.from('{"findings":1}')]]));
    }
    this.finish(run, 'completed');
  }
}
