import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { validator } from '../src/protocol.js';
import { terminal } from '../src/types.js';

const binary = fileURLToPath(new URL('./fixtures/bob.mjs', import.meta.url)); chmodSync(binary, 0o755);
const alice = 'alice-token-'.padEnd(32, 'a'), bob = 'bob-token-'.padEnd(32, 'b');
const body = (text = 'hello', extra = {}) => ({ agent_name: 'headlessbob', input: [{ role: 'user', parts: [{ content_type: 'text/plain', content: text }] }], ...extra });
async function setup(t: any, extra: Record<string, string> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'headlessbob-http-'));
  const config = loadConfig({ PATH: process.env.PATH, HOME: process.env.HOME, BOB_BIN: binary, BOB_API_KEY: 'fixture', DATA_DIR: dataDir, PORT: '0', BOB_ENABLE_CONTINUATION: 'true', KILL_GRACE_MS: '30', RUN_TIMEOUT_MS: '3000', AUTH_TOKENS: JSON.stringify({ alice, bob }), ...extra });
  const app = await createApp(config); await app.listen();
  const address = app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await app.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const request = async (path: string, data?: unknown, token = alice) => {
    const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, data: await response.json() as any };
  };
  const completed = async (id: string) => {
    for (let i = 0; i < 200; i++) { const result = await request(`/runs/${id}`); if (terminal(result.data)) return result.data; await delay(20); }
    throw new Error('Run did not finish');
  };
  return { app, request, completed, config, base, dataDir };
}
function valid(name: string, value: unknown) { const check = validator(name); assert.ok(check(value), JSON.stringify(check.errors)); }
test('ACP discovery, sync, async, session continuation and event contract', async t => {
  const { request, completed } = await setup(t);
  const discovery = await request('/agents'); valid('AgentsListResponse', discovery.data);
  assert.equal(discovery.data.agents[0].name, 'headlessbob');
  const first = await request('/runs', body());
  assert.equal(first.status, 200); valid('Run', first.data); assert.equal(first.data.status, 'completed');
  const second = await request('/runs', body('SLOW', { mode: 'async', session_id: first.data.session_id }));
  assert.equal(second.status, 202); assert.equal(second.data.status, 'created');
  const result = await completed(second.data.run_id); assert.equal(result.output[0].parts[0].content, 'continued');
  const events = await request(`/runs/${second.data.run_id}/events`); valid('RunEventsListResponse', events.data);
  assert.deepEqual(events.data.events.map((e: any) => e.type), ['run.created', 'run.in-progress', 'message.created', 'message.part', 'message.completed', 'run.completed']);
  assert.ok(!JSON.stringify(events.data).includes('hidden reasoning'));
  const session = await request(`/session/${first.data.session_id}`); valid('Session', session.data); assert.equal(session.data.history.length, 2);
});
test('stream responses use ACP SSE events and disconnect does not cancel execution', async t => {
  const { base, completed, app } = await setup(t);
  const response = await fetch(base + '/runs', { method: 'POST', headers: { authorization: `Bearer ${alice}`, 'content-type': 'application/json' }, body: JSON.stringify(body('SLOW', { mode: 'stream' })) });
  assert.match(response.headers.get('content-type')!, /text\/event-stream/);
  const events = (await response.text()).trim().split('\n\n').map(line => JSON.parse(line.slice(6)));
  events.forEach(event => valid('Event', event)); assert.equal(events.at(-1).type, 'run.completed');
  const controller = new AbortController();
  const other = await fetch(base + '/runs', { method: 'POST', headers: { authorization: `Bearer ${alice}`, 'content-type': 'application/json' }, body: JSON.stringify(body('SLOW', { mode: 'stream' })), signal: controller.signal });
  const first = await other.body!.getReader().read(); const event = JSON.parse(new TextDecoder().decode(first.value).split('\n\n')[0].slice(6));
  controller.abort();
  assert.equal((await completed(event.run.run_id)).status, 'completed');
  assert.equal(app.manager.bus.listenerCount(event.run.run_id), 0);
});
test('caller isolation, input validation and unsupported features', async t => {
  const { request, base } = await setup(t);
  const first = await request('/runs', body());
  for (const path of [`/runs/${first.data.run_id}`, `/runs/${first.data.run_id}/events`, `/session/${first.data.session_id}`]) assert.equal((await request(path, undefined, bob)).status, 404);
  assert.equal((await request(`/runs/${first.data.run_id}/cancel`, {}, bob)).status, 404);
  assert.equal((await request('/runs', body('hello', { session_id: first.data.session_id }), bob)).status, 404);
  assert.equal((await request('/agents', undefined, 'wrong')).status, 401);
  for (const extra of [{ workspace: '../../etc' }, { task_id: 'arbitrary' }, { mode: 'agent' }, { session: { id: randomUUID(), history: [] } }]) assert.equal((await request('/runs', body('hello', extra))).status, 400);
  const media = body(); media.input[0].parts[0].content_type = 'image/png';
  assert.equal((await request('/runs', media)).status, 400);
  const resume = await request(`/runs/${first.data.run_id}`, { run_id: first.data.run_id, await_resume: {}, mode: 'sync' });
  assert.equal(resume.status, 400); valid('Error', resume.data);
  const origin = await fetch(base + '/agents', { headers: { authorization: `Bearer ${alice}`, origin: 'https://example.com' } }); assert.equal(origin.status, 403);
});
test('serializes same-session jobs and cancels queued and active runs', async t => {
  const { request, completed } = await setup(t, { MAX_CONCURRENT: '2' });
  const first = await request('/runs', body());
  const [a, b] = await Promise.all([request('/runs', body('SLOW', { mode: 'async', session_id: first.data.session_id })), request('/runs', body('SLOW', { mode: 'async', session_id: first.data.session_id }))]);
  assert.equal((await completed(a.data.run_id)).status, 'completed'); assert.equal((await completed(b.data.run_id)).status, 'completed');
  const active = await request('/runs', body('HANG', { mode: 'async', session_id: first.data.session_id }));
  const queued = await request('/runs', body('hello', { mode: 'async', session_id: first.data.session_id }));
  assert.equal((await request(`/runs/${queued.data.run_id}/cancel`, {})).data.status, 'cancelled');
  assert.equal((await request(`/runs/${active.data.run_id}/cancel`, {})).status, 202);
  assert.equal((await completed(active.data.run_id)).status, 'cancelled');
  assert.equal((await request('/runs', body('hello', { session_id: first.data.session_id }))).status, 409);
});
test('missing Bob history and changed workspace symlinks fail explicitly', async t => {
  const { app, request, dataDir } = await setup(t);
  const first = await request('/runs', body());
  const session = app.store.session(first.data.session_id, 'alice')!;
  unlinkSync(join(session.workspace, 'task.txt'));
  const next = await request('/runs', body('hello', { session_id: session.id }));
  assert.equal(next.data.status, 'failed'); assert.equal(next.data.error.data.reason, 'session_recovery');
  const other = await request('/runs', body());
  const path = app.store.session(other.data.session_id, 'alice')!.workspace;
  rmSync(path, { recursive: true }); symlinkSync(dataDir, path);
  const redirected = await request('/runs', body('hello', { session_id: other.data.session_id }));
  assert.equal(redirected.data.error.data.reason, 'workspace_invalid');
});
test('single-instance lock prevents two managers from sharing storage', async t => {
  const { config } = await setup(t);
  await assert.rejects(createApp(config), /Another service instance/);
});
test('bounds admission and rejects oversized bodies', async t => {
  const { request } = await setup(t, { MAX_CONCURRENT: '1', MAX_QUEUED: '1', MAX_BODY_BYTES: '1024' });
  const active = await request('/runs', body('HANG', { mode: 'async' }));
  const queued = await request('/runs', body('SLOW', { mode: 'async' }));
  assert.equal(active.status, 202); assert.equal(queued.status, 202);
  const overflow = await request('/runs', body('hello', { mode: 'async' }));
  assert.equal(overflow.status, 429); assert.equal(overflow.data.data.reason, 'queue_full');
  assert.equal((await request('/runs', body('x'.repeat(2000)))).status, 413);
});
test('continuation remains explicitly gated when disabled', async t => {
  const { request } = await setup(t, { BOB_ENABLE_CONTINUATION: 'false' });
  const first = await request('/runs', body());
  const next = await request('/runs', body('hello', { session_id: first.data.session_id }));
  assert.equal(next.status, 400); assert.equal(next.data.data.reason, 'unsupported_continuation');
});
test('rejects mismatched resumed task IDs without silently changing sessions', async t => {
  const { request } = await setup(t);
  const first = await request('/runs', body());
  const next = await request('/runs', body('WRONG_TASK', { session_id: first.data.session_id }));
  assert.equal(next.data.status, 'failed'); assert.equal(next.data.error.data.reason, 'session_recovery');
});
