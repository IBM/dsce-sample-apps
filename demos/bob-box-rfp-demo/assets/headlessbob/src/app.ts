import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Config } from './config.js';
import { Store } from './storage.js';
import { RunManager } from './runs.js';
import type { Runtime } from './runtime/bob.js';
import { BobClientRuntime } from './runtime/client.js';
import { manifest, validateCreate } from './protocol.js';
import { ApiError, terminal, type Event } from './types.js';
import { Threads } from './threads.js';
import { WorkspaceFiles, MAX_DOWNLOAD_BYTES } from './files.js';
import { pipeline } from 'node:stream/promises';
import { handleMcp } from './mcp.js';

function json(response: ServerResponse, status: number, body: unknown) {
  if (response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(body));
}
async function readBody(request: IncomingMessage, limit: number): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'invalid_input', 'Content-Type must be application/json');
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') throw new ApiError(415, 'invalid_input', 'Compressed request bodies are unsupported');
  if (Number(request.headers['content-length']) > limit) throw new ApiError(413, 'invalid_input', 'Request body is too large');
  return new Promise((resolve, reject) => {
    let bytes = 0; const chunks: Buffer[] = [];
    const cleanup = () => { clearTimeout(timer); request.off('data', data); request.off('end', end); request.off('error', error); request.off('aborted', aborted); };
    const error = (e: Error) => { cleanup(); reject(e); };
    const aborted = () => error(new ApiError(400, 'invalid_input', 'Request body was interrupted'));
    const data = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) { cleanup(); request.pause(); reject(new ApiError(413, 'invalid_input', 'Request body is too large')); }
      else chunks.push(chunk);
    };
    const end = () => { cleanup(); try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new ApiError(400, 'invalid_input', 'Malformed JSON')); } };
    const timer = setTimeout(() => { cleanup(); request.pause(); reject(new ApiError(408, 'invalid_input', 'Request body timed out')); }, 10000);
    request.on('data', data); request.on('end', end); request.on('error', error); request.on('aborted', aborted);
  });
}
export async function createApp(config: Config, runtime: Runtime = new BobClientRuntime(config)) {
  const store = new Store(config.dataDir);
  const manager = new RunManager(store, runtime, config);
  const threads = new Threads(manager);
  const files = new WorkspaceFiles(manager, threads);
  let downloads = 0;
  const assets = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/markdown.js', ['markdown.js', 'text/javascript; charset=utf-8']],
    ['/style.css', ['style.css', 'text/css; charset=utf-8']],
    ['/docs', ['docs.html', 'text/html; charset=utf-8']],
    ['/docs.js', ['docs.js', 'text/javascript; charset=utf-8']],
    ['/acp', ['acp.html', 'text/html; charset=utf-8']],
    ['/acp/openapi.json', ['acp-openapi.json', 'application/json']],
    ['/api/openapi.json', ['openapi.json', 'application/json']]
  ].map(([path, [file, type]]) => [path, { type, body: readFileSync(new URL(`../public/${file}`, import.meta.url)) }]));
  for (const file of ['client.py', 'rest.py', 'acp.py', 'cancel.py', 'README.md']) {
    assets.set(`/examples/python/${file}`, { type: 'text/plain; charset=utf-8', body: readFileSync(new URL(`../examples/python/${file}`, import.meta.url)) });
  }
  let readiness = await runtime.ready();
  let checking = false;
  const readinessTimer = setInterval(() => { if (!checking) { checking = true; void runtime.ready().then(r => { readiness = r; }).catch(() => { readiness = { ready: false, reason: 'Runtime readiness failed' }; }).finally(() => { checking = false; }); } }, 30000);
  readinessTimer.unref();
  let shuttingDown = false;
  const credentials = Object.entries(config.tokens).map(([owner, token]) => [owner, createHash('sha256').update(token).digest()] as const);
  function authenticate(request: IncomingMessage, browser = false) {
    // Only the thread wrapper admits same-origin browser requests. Never expose
    // permissive CORS or accept cross-site requests, even with a valid token.
    if (request.headers['sec-fetch-site'] === 'cross-site') throw new ApiError(403, 'invalid_input', 'Cross-site requests are unsupported');
    if (request.headers.origin) {
      let sameOrigin = false;
      try { const origin = new URL(request.headers.origin); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host.toLowerCase() === request.headers.host?.toLowerCase(); } catch {}
      if (!browser || !sameOrigin) throw new ApiError(403, 'invalid_input', 'Cross-origin requests are unsupported');
    }
    if (!credentials.length) {
      const host = request.headers.host?.toLowerCase();
      const allowed = ['localhost', '127.0.0.1', '[::1]'];
      if (!host || !allowed.some(value => host === value || host.startsWith(`${value}:`))) throw new ApiError(403, 'invalid_input', 'Invalid Host header');
      return 'local';
    }
    const header = request.headers.authorization;
    const digest = createHash('sha256').update(header?.startsWith('Bearer ') ? header.slice(7) : '').digest();
    const match = credentials.find(([, expected]) => timingSafeEqual(digest, expected));
    if (!match) throw new ApiError(401, 'invalid_input', 'A valid bearer token is required', 'unauthorized');
    return match[0];
  }
  let streams = 0;
  function stream(id: string, response: ServerResponse, after = 0, withIds = false) {
    if (streams >= 100) throw new ApiError(429, 'server_error', 'Too many streaming clients');
    const history = store.events(id);
    if (after > history.length) throw new ApiError(400, 'invalid_input', 'Event cursor is beyond the event log');
    streams++;
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
    response.flushHeaders();
    let closed = false;
    let sequence = 0;
    const cleanup = () => { if (!closed) { closed = true; streams--; clearInterval(heartbeat); manager.bus.off(id, send); } };
    const send = (event: Event) => {
      if (closed) return;
      sequence++;
      // The persisted event log is the replay buffer. Disconnect slow clients
      // rather than accumulating an unbounded per-client queue.
      if (response.writableLength > 262144) { response.destroy(); cleanup(); return; }
      if (sequence > after) response.write(`${withIds ? `id: ${sequence}\n` : ''}data: ${JSON.stringify(event)}\n\n`);
      if (event.run && terminal(event.run)) { response.end(); cleanup(); }
    };
    const heartbeat = setInterval(() => { if (response.writableLength > 262144) response.destroy(); else response.write(': heartbeat\n\n'); }, 15000);
    response.once('close', cleanup);
    manager.bus.on(id, send);
    // Synchronous SQLite reads cannot race lifecycle callbacks on this event loop.
    for (const event of history) send(event);
  }
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = url.pathname;
      const method = request.method;
      const asset = assets.get(path);
      if (asset && (method === 'GET' || method === 'HEAD')) {
        response.writeHead(200, {
          'content-type': asset.type, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
          'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow'
        });
        return response.end(method === 'HEAD' ? undefined : asset.body);
      }
      if (method === 'GET' && (path === '/healthz' || path === '/ping')) return json(response, 200, { status: 'ok' });
      const wrapper = path.startsWith('/api/v1/');
      const owner = authenticate(request, wrapper);
      if (method === 'GET' && path === '/readyz') return json(response, readiness.ready && !shuttingDown ? 200 : 503, shuttingDown ? { ready: false, reason: 'Shutting down' } : readiness);
      if (shuttingDown) throw new ApiError(503, 'server_error', 'Service is shutting down');
      if (path === '/mcp') {
        if (method !== 'POST') {
          response.setHeader('allow', 'POST');
          return json(response, 405, { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Method not allowed' } });
        }
        const body = await readBody(request, config.maxBodyBytes);
        return handleMcp(request, response, body, owner, threads, manager, () => {
          if (!readiness.ready) throw new ApiError(503, 'server_error', readiness.reason ?? 'Runtime is not ready', 'runtime_unavailable');
        });
      }
      if (method === 'GET' && path === '/api/v1/capabilities') return json(response, 200, {
        caller: owner, runtime: readiness, apis: { docs_url: '/docs', mcp: { url: '/mcp', transport: 'streamable-http', authentication: 'service-token', oauth: false }, rest: { base_path: '/api/v1', openapi_url: '/api/openapi.json' }, acp: { version: '0.2.0', base_path: '/', docs_url: '/acp', openapi_url: '/acp/openapi.json', discovery_url: '/agents' } }, features: { threads: true, archive_threads: true, delete_threads: true, streaming: true, cancellation: true, continuation: config.continuation, file_downloads: true, attachments: false, thread_forking: false },
        limits: { max_download_bytes: MAX_DOWNLOAD_BYTES, max_message_characters: 20000, max_concurrent_runs: config.maxConcurrent, max_turns: null, max_cost: null, timeout_ms: config.timeoutMs },
        runtime_protocol: 'agent-client-protocol', runtime_protocol_version: 1
      });
      if (path === '/api/v1/threads') {
        if (method === 'GET') return json(response, 200, threads.list(url.searchParams, owner));
        if (method === 'POST') return json(response, 201, threads.create(await readBody(request, config.maxBodyBytes), owner));
      }
      const fileRoute = /^\/api\/v1\/threads\/([a-f0-9-]{36})\/files(?:\/(download))?$/.exec(path);
      if (method === 'GET' && fileRoute) {
        const [, id, download] = fileRoute, relative = url.searchParams.get('path') ?? '';
        if (!download) return json(response, 200, files.list(id, owner, relative));
        if (downloads >= 8) throw new ApiError(429, 'server_error', 'Too many active downloads');
        const file = files.download(id, owner, relative);
        downloads++;
        response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': file.size, 'content-disposition': file.disposition, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "sandbox; default-src 'none'" });
        try { await pipeline(file.stream, response); } finally { downloads--; }
        return;
      }
      const threadMatch = /^\/api\/v1\/threads\/([a-f0-9-]{36})(?:\/(messages))?$/.exec(path);
      if (threadMatch) {
        const [, id, action] = threadMatch;
        if (method === 'GET' && !action) return json(response, 200, threads.get(id, owner));
        if (method === 'PATCH' && !action) return json(response, 200, threads.update(id, await readBody(request, config.maxBodyBytes), owner));
        if (method === 'DELETE' && !action) { threads.delete(id, owner); response.writeHead(204, { 'cache-control': 'no-store' }); return response.end(); }
        if (method === 'GET' && action === 'messages') return json(response, 200, threads.messages(id, url.searchParams, owner));
        if (method === 'POST' && action === 'messages') {
          const body = await readBody(request, config.maxBodyBytes);
          if (!readiness.ready) throw new ApiError(503, 'server_error', readiness.reason ?? 'Runtime is not ready', 'runtime_unavailable');
          const key = request.headers['idempotency-key'];
          if (Array.isArray(key)) throw new ApiError(400, 'invalid_input', 'Invalid Idempotency-Key');
          return json(response, 202, threads.send(id, body, owner, key));
        }
      }
      const restRun = /^\/api\/v1\/runs\/([a-f0-9-]{36})(?:\/(cancel|events))?$/.exec(path);
      if (restRun) {
        const [, id, action] = restRun;
        const run = manager.get(id, owner);
        if (method === 'GET' && !action) return json(response, 200, run);
        if (method === 'POST' && action === 'cancel') return json(response, 202, manager.cancel(id, owner));
        if (method === 'GET' && action === 'events') {
          const after = request.headers['last-event-id'] ?? url.searchParams.get('after') ?? '0';
          if (typeof after !== 'string' || !/^\d{1,10}$/.test(after)) throw new ApiError(400, 'invalid_input', 'Invalid event cursor');
          return stream(id, response, Number(after), true);
        }
      }
      if (method === 'GET' && path === '/agents') {
        const limit = Number(url.searchParams.get('limit') ?? 10), offset = Number(url.searchParams.get('offset') ?? 0);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0) throw new ApiError(400, 'invalid_input', 'Invalid pagination');
        return json(response, 200, { agents: offset > 0 ? [] : [manifest(config.continuation)] });
      }
      if (method === 'GET' && path === '/agents/headlessbob') return json(response, 200, manifest(config.continuation));
      if (method === 'POST' && path === '/runs') {
        const input = validateCreate(await readBody(request, config.maxBodyBytes));
        if (!readiness.ready) throw new ApiError(503, 'server_error', readiness.reason ?? 'Runtime is not ready', 'runtime_unavailable');
        if (input.mode === 'stream' && streams >= 100) throw new ApiError(429, 'server_error', 'Too many streaming clients');
        const run = manager.create(input, owner);
        if (input.mode === 'stream') return stream(run.run_id, response);
        if (input.mode === 'async') return json(response, 202, run);
        return json(response, 200, await manager.wait(run.run_id, owner));
      }
      const match = /^\/runs\/([a-f0-9-]{36})(?:\/(cancel|events))?$/.exec(path);
      if (match) {
        const [, id, action] = match;
        const run = manager.get(id, owner);
        if (method === 'GET' && !action) return json(response, 200, run);
        if (method === 'GET' && action === 'events') return json(response, 200, { events: store.events(id) });
        if (method === 'POST' && action === 'cancel') return json(response, 202, manager.cancel(id, owner));
        if (method === 'POST' && !action) throw new ApiError(400, 'invalid_input', 'ACP Await/resume is not supported by this Bob adapter', 'unsupported_resume');
      }
      const sessionMatch = /^\/session\/([a-f0-9-]{36})$/.exec(path);
      if (method === 'GET' && sessionMatch) {
        const session = manager.getSession(sessionMatch[1], owner);
        return json(response, 200, { id: session.id, history: store.history(session.id) });
      }
      throw new ApiError(404, 'not_found', 'Route not found');
    })().catch(error => {
      const apiError = error instanceof ApiError ? error : new ApiError(500, 'server_error', 'Internal server error');
      if (response.headersSent) { response.destroy(); return; }
      if (apiError.status === 401) response.setHeader('www-authenticate', 'Bearer');
      if ([408, 413, 415].includes(apiError.status)) response.setHeader('connection', 'close');
      json(response, apiError.status, request.url?.startsWith('/api/v1/') ? { error: { code: apiError.reason ?? apiError.code, message: apiError.message } } : apiError.body());
    });
  });
  server.maxConnections = 128;
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return { server, manager, store, threads,
    async listen() { await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, config.host, () => { server.off('error', reject); resolve(); }); }); return server.address(); },
    async close() {
      shuttingDown = true; clearInterval(readinessTimer);
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      await manager.close(); server.closeAllConnections(); await closed; store.close();
    }
  };
}
