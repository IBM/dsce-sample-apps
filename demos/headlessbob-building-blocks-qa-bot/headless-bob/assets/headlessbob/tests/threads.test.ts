import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { terminal } from '../src/types.js';
import { BobRuntime } from '../src/runtime/bob.js';

const binary = fileURLToPath(new URL('./fixtures/bob.mjs', import.meta.url)); chmodSync(binary, 0o755);
const alice = 'alice-token-'.padEnd(32, 'a'), bob = 'bob-token-'.padEnd(32, 'b');
async function setup(t: any, legacyUsage = false) {
  const dataDir = mkdtempSync(join(tmpdir(), 'headlessbob-threads-'));
  const config = loadConfig({ PATH: process.env.PATH, HOME: process.env.HOME, BOB_BIN: binary, BOB_API_KEY: 'fixture', DATA_DIR: dataDir, PORT: '0', BOB_ENABLE_CONTINUATION: 'true', KILL_GRACE_MS: '25', RUN_TIMEOUT_MS: '3000', AUTH_TOKENS: JSON.stringify({ alice, bob }) });
  const runtime = legacyUsage ? new BobRuntime(config) : undefined;
  let app = await createApp(config, runtime); await app.listen();
  const base = () => `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  t.after(async () => { await app.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const raw = (path: string, options: RequestInit = {}) => fetch(base() + path, { ...options, headers: { authorization: `Bearer ${alice}`, ...options.headers } });
  const request = async (path: string, method = 'GET', value?: unknown, headers = {}) => {
    const r = await raw('/api/v1' + path, { method, headers: { ...(value === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    return { status: r.status, data: await r.json() as any };
  };
  const done = async (id: string) => {
    for (let i = 0; i < 150; i++) { const r = await request(`/runs/${id}`); if (terminal(r.data)) return r.data; await delay(20); }
    throw new Error('Run did not complete');
  };
  return { raw, request, done, base, get app() { return app; }, async restart() { await app.close(); app = await createApp(config, runtime); await app.listen(); } };
}
test('UI assets are public; REST remains authenticated and accepts only same-origin browsers', async t => {
  const { raw, request, base } = await setup(t);
  const page = await fetch(base() + '/'); assert.equal(page.status, 200); assert.match(await page.text(), /Service access token/);
  assert.match(page.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  for (const path of ['/app.js', '/style.css', '/api/openapi.json']) assert.equal((await fetch(base() + path)).status, 200);
  const blocked = await fetch(base() + '/api/v1/threads'); assert.equal(blocked.status, 401); assert.equal((await blocked.json() as any).error.code, 'unauthorized');
  assert.equal((await request('/capabilities', 'GET', undefined, { origin: base() })).status, 200);
  assert.equal((await request('/threads', 'GET', undefined, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/threads', 'GET', undefined, { origin: 'null' })).status, 403);
  assert.equal((await raw('/agents', { headers: { origin: base() } })).status, 403, 'ACP origin policy is preserved');
});
test('threads persist messages, continue Bob sessions, and replay idempotent sends', async t => {
  const api = await setup(t);
  const created = await api.request('/threads', 'POST', {}); assert.equal(created.status, 201); assert.equal(created.data.status, 'empty');
  const id = created.data.id;
  const send = await api.request(`/threads/${id}/messages`, 'POST', { content: 'SLOW hello' }, { 'Idempotency-Key': 'request-1' });
  assert.equal(send.status, 202); assert.equal(send.data.thread.status, 'running'); assert.equal(send.data.thread.title, 'SLOW hello');
  const replay = await api.request(`/threads/${id}/messages`, 'POST', { content: 'SLOW hello' }, { 'Idempotency-Key': 'request-1' });
  assert.equal(replay.data.run.run_id, send.data.run.run_id);
  const conflict = await api.request(`/threads/${id}/messages`, 'POST', { content: 'different' }, { 'Idempotency-Key': 'request-1' });
  assert.equal(conflict.status, 409); assert.equal(conflict.data.error.code, 'idempotency_conflict');
  assert.equal((await api.request(`/threads/${id}/messages`, 'POST', { content: 'concurrent' })).data.error.code, 'thread_busy');
  assert.equal((await api.done(send.data.run.run_id)).status, 'completed');
  await api.restart();
  const history = await api.request(`/threads/${id}/messages`); assert.deepEqual(history.data.items.map((m: any) => m.content), ['SLOW hello', 'hello']);
  const repeated = await api.request(`/threads/${id}/messages`, 'POST', { content: 'SLOW hello' }, { 'Idempotency-Key': 'request-1' });
  assert.equal(repeated.data.run.run_id, send.data.run.run_id, 'idempotency survives restart');
  const next = await api.request(`/threads/${id}/messages`, 'POST', { content: 'follow-up' });
  assert.equal((await api.done(next.data.run.run_id)).output[0].parts[0].content, 'continued');
  assert.equal(next.data.run.session_id, send.data.run.session_id);
  assert.equal((await api.request(`/threads/${id}`)).data.status, 'ready');
});
test('thread and message reads/writes are scoped to the caller', async t => {
  const { request } = await setup(t);
  const thread = (await request('/threads', 'POST', { title: 'Private' })).data;
  const other = { authorization: `Bearer ${bob}` };
  assert.deepEqual((await request('/threads', 'GET', undefined, other)).data.items, []);
  for (const [path, method, data] of [[`/threads/${thread.id}`, 'GET', undefined], [`/threads/${thread.id}`, 'PATCH', { title: 'stolen' }], [`/threads/${thread.id}/messages`, 'GET', undefined], [`/threads/${thread.id}/messages`, 'POST', { content: 'steal' }]] as const) assert.equal((await request(path, method, data, other)).status, 404);
});
test('renaming, archive/restore, search escaping and pagination work', async t => {
  const { request, done } = await setup(t);
  const ids = [];
  for (const title of ['First', 'Second', '100% done']) ids.push((await request('/threads', 'POST', { title })).data.id);
  const first = (await request('/threads?limit=1')).data;
  const second = (await request(`/threads?limit=1&cursor=${first.next_cursor}`)).data;
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal((await request('/threads?q=%25')).data.items.length, 1);
  const id = ids[0];
  assert.equal((await request(`/threads/${id}`, 'PATCH', { title: 'Renamed' })).data.title, 'Renamed');
  assert.equal((await request(`/threads/${id}`, 'PATCH', { archived: true })).data.status, 'archived');
  assert.equal((await request(`/threads/${id}/messages`, 'POST', { content: 'hello' })).data.error.code, 'thread_archived');
  assert.equal((await request('/threads?archived=true')).data.items[0].id, id);
  await request(`/threads/${id}`, 'PATCH', { archived: false });
  for (const content of ['hello', 'again']) { const run = (await request(`/threads/${id}/messages`, 'POST', { content })).data.run; await done(run.run_id); }
  const newest = (await request(`/threads/${id}/messages?limit=1`)).data;
  assert.equal(newest.items[0].content, 'again'); assert.ok(newest.next_cursor);
  const older = (await request(`/threads/${id}/messages?limit=1&before=${newest.next_cursor}`)).data;
  assert.equal(older.items[0].content, 'hello'); assert.equal(older.next_cursor, null);
  assert.equal((await request('/threads?cursor=garbage')).status, 400);
  assert.equal((await request(`/threads/${id}/messages?before=-1`)).status, 400);
});
test('REST SSE supports live output, cursor replay and terminal empty replay', async t => {
  const { request, raw } = await setup(t);
  const id = (await request('/threads', 'POST', {})).data.id;
  const run = (await request(`/threads/${id}/messages`, 'POST', { content: 'SLOW' })).data.run;
  const response = await raw(`/api/v1/runs/${run.run_id}/events`);
  const blocks = (await response.text()).trim().split('\n\n');
  const events = blocks.map(block => JSON.parse(block.split('\n').find(line => line.startsWith('data: '))!.slice(6)));
  assert.equal(events[0].type, 'run.created'); assert.equal(events.at(-1).type, 'run.completed');
  blocks.forEach((block, index) => assert.ok(block.startsWith(`id: ${index + 1}\n`)));
  const tail = await raw(`/api/v1/runs/${run.run_id}/events`, { headers: { 'Last-Event-ID': '2' } });
  assert.ok((await tail.text()).startsWith('id: 3\n'));
  const end = await raw(`/api/v1/runs/${run.run_id}/events?after=${blocks.length}`); assert.equal(await end.text(), '');
  assert.equal((await raw(`/api/v1/runs/${run.run_id}/events?after=9999`)).status, 400);
  assert.equal((await raw(`/api/v1/runs/${run.run_id}/events`, { headers: { authorization: `Bearer ${bob}` } })).status, 404);
});
test('failed/cancelled sessions are visible and do not silently start a new task', async t => {
  const { request, done } = await setup(t);
  const id = (await request('/threads', 'POST', {})).data.id;
  const run = (await request(`/threads/${id}/messages`, 'POST', { content: 'HANG' })).data.run;
  await delay(150);
  assert.equal((await request(`/threads/${id}`, 'PATCH', { archived: true })).status, 409);
  assert.equal((await request(`/runs/${run.run_id}/cancel`, 'POST')).status, 202);
  assert.equal((await done(run.run_id)).status, 'cancelled');
  assert.equal((await request(`/threads/${id}`)).data.status, 'needs_new_thread');
  assert.equal((await request(`/threads/${id}/messages`, 'POST', { content: 'retry' })).data.error.code, 'session_recovery');
  const messages = (await request(`/threads/${id}/messages`)).data.items;
  assert.equal(messages[1].status, 'cancelled'); assert.equal(messages[1].error.data.reason, 'cancelled');
});
test('thread-linked run recovers as failed after an interrupted execution', async t => {
  const api = await setup(t);
  const id = (await api.request('/threads', 'POST', {})).data.id;
  const run = (await api.request(`/threads/${id}/messages`, 'POST', { content: 'hello' })).data.run;
  await api.done(run.run_id);
  // Simulate the durable state left behind by an abrupt crash, with no live child.
  api.app.store.saveRun({ ...run, status: 'in-progress' }, 'alice');
  await api.restart();
  assert.equal((await api.request(`/threads/${id}`)).data.status, 'needs_new_thread');
  const messages = (await api.request(`/threads/${id}/messages`)).data.items;
  assert.equal(messages[0].content, 'hello'); assert.equal(messages[1].error.data.reason, 'interrupted');
});
test('deletion checks ownership and active runs, removes wrapper history, and retains run records', async t => {
  const { request, raw, done, app } = await setup(t);
  const id = (await request('/threads', 'POST', {})).data.id;
  const run = (await request(`/threads/${id}/messages`, 'POST', { content: 'HANG' })).data.run;
  await delay(150);
  const denied = await raw(`/api/v1/threads/${id}`, { method: 'DELETE', headers: { authorization: `Bearer ${bob}` } }); assert.equal(denied.status, 404);
  assert.equal((await raw(`/api/v1/threads/${id}`, { method: 'DELETE' })).status, 409);
  await request(`/runs/${run.run_id}/cancel`, 'POST'); await done(run.run_id);
  const removed = await raw(`/api/v1/threads/${id}`, { method: 'DELETE' }); assert.equal(removed.status, 204); assert.equal(await removed.text(), '');
  assert.equal((await request(`/threads/${id}`)).status, 404);
  assert.equal((await request(`/threads/${id}/messages`)).status, 404);
  assert.equal((await request('/threads')).data.items.length, 0);
  assert.equal(Number(app.store.db.prepare('SELECT COUNT(*) AS n FROM thread_turns WHERE thread_id=?').get(id)!.n), 0);
  assert.equal((await request(`/runs/${run.run_id}`)).status, 200, 'run audit record is retained');
  assert.ok(app.store.session(run.session_id, 'alice'), 'workspace/session lifecycle is separate');
});
test('workspace downloads preserve bytes and reject unauthorized or unsafe paths', async t => {
  const { writeFileSync, mkdirSync, symlinkSync, linkSync, truncateSync } = await import('node:fs');
  const api = await setup(t);
  const id = (await api.request('/threads', 'POST', {})).data.id;
  const base = `/api/v1/threads/${id}/files`;
  assert.deepEqual((await (await api.raw(base)).json() as any).items, []);
  const run = (await api.request(`/threads/${id}/messages`, 'POST', { content: 'SLOW' })).data.run;
  assert.equal((await api.raw(base)).status, 409);
  await api.done(run.run_id);
  const root = api.app.store.checkWorkspace(api.app.store.session(run.session_id, 'alice')!);
  mkdirSync(join(root, 'nested'));
  const bytes = Buffer.from('<h1>Tetris</h1>\u0000\u00ff');
  writeFileSync(join(root, 'nested', 'tétris game.html'), bytes);
  writeFileSync(join(root, 'empty.txt'), '');
  writeFileSync(join(root, '.secret'), 'private');
  symlinkSync('/etc/passwd', join(root, 'linked'));
  symlinkSync('/tmp', join(root, 'linked-dir'));
  linkSync(join(root, '.secret'), join(root, 'hardlink'));
  writeFileSync(join(root, 'large.bin'), ''); truncateSync(join(root, 'large.bin'), 26 * 1024 * 1024);
  const listing = await (await api.raw(base)).json() as any;
  assert.ok(listing.items.some((f: any) => f.name === 'nested'));
  assert.ok(!listing.items.some((f: any) => ['.secret', 'linked', 'linked-dir', 'hardlink'].includes(f.name)));
  assert.equal(listing.items.find((f: any) => f.name === 'large.bin').downloadable, false);
  const nested = await (await api.raw(base + '?path=nested')).json() as any;
  const file = await api.raw(nested.items[0].download_url);
  assert.equal(file.status, 200); assert.match(file.headers.get('content-disposition')!, /^attachment;/);
  assert.equal(file.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  assert.equal((await api.raw(base + '/download?path=empty.txt')).headers.get('content-length'), '0');
  for (const path of ['../x', '/etc/passwd', '.secret', 'nested/../../x', 'a\\b']) assert.equal((await api.raw(base + '/download?path=' + encodeURIComponent(path))).status, 400);
  for (const path of ['linked', 'linked-dir/x', 'hardlink', 'missing', 'nested']) assert.equal((await api.raw(base + '/download?path=' + path)).status, 404);
  assert.equal((await api.raw(base + '/download?path=large.bin')).status, 413);
  for (const suffix of ['', '/download?path=empty.txt']) assert.equal((await api.raw(base + suffix, { headers: { authorization: `Bearer ${bob}` } })).status, 404);
  await api.request(`/threads/${id}`, 'PATCH', { archived: true });
  assert.equal((await api.raw(base)).status, 200);
  await api.raw(`/api/v1/threads/${id}`, { method: 'DELETE' });
  assert.equal((await api.raw(base)).status, 404);
});

test('usage survives storage restart and appears in run, replayed completion and assistant history', async t => {
  // Historical CLI usage remains readable even though the ACP runtime omits unavailable totals.
  const api = await setup(t, true);
  const id = (await api.request('/threads', 'POST', {})).data.id;
  const run = (await api.request(`/threads/${id}/messages`, 'POST', { content: 'USAGE' })).data.run;
  const expected = {duration_ms:1000,session_costs:0.01,tool_calls:0,input_tokens:100,output_tokens:20};
  assert.deepEqual((await api.done(run.run_id)).usage, expected);
  await api.restart();
  assert.deepEqual((await api.request(`/runs/${run.run_id}`)).data.usage, expected);
  const messages = (await api.request(`/threads/${id}/messages`)).data.items;
  assert.deepEqual(messages[1].usage,expected); assert.equal(messages[0].usage,undefined);
  const response = await api.raw(`/api/v1/runs/${run.run_id}/events`);
  const events = (await response.text()).trim().split('\n\n').map(block=>JSON.parse(block.split('\n').find(line=>line.startsWith('data: '))!.slice(6)));
  assert.deepEqual(events.at(-1).run.usage,expected);
});
test('ACP is discoverable from UI and capabilities with its own implemented contract', async t => {
  const { raw, request, base } = await setup(t);
  const page = await fetch(base() + '/'); assert.match(await page.text(), /ACP documentation and examples/);
  const guide = await fetch(base() + '/acp'); assert.equal(guide.status, 200); assert.match(await guide.text(), /Continue a session/);
  const response = await fetch(base() + '/acp/openapi.json'); assert.equal(response.status, 200);
  const contract = await response.json() as any;
  assert.equal(contract.servers[0].url, '/'); assert.ok(contract.paths['/agents/headlessbob'].get);
  assert.ok(contract.paths['/runs'].post); assert.equal(contract.paths['/runs/{run_id}'].post, undefined);
  assert.deepEqual(contract.security, [{bearerAuth:[]}]);
  assert.equal(contract.components.schemas.RunCreateRequest.properties.session, undefined);
  const caps = (await request('/capabilities')).data;
  assert.equal(caps.runtime_protocol, 'agent-client-protocol');
  assert.equal(caps.runtime_protocol_version, 1);
  assert.equal(caps.limits.max_cost, null); assert.equal(caps.limits.max_turns, null);
  assert.equal(caps.apis.acp.openapi_url, '/acp/openapi.json');
  assert.equal(caps.apis.rest.base_path, '/api/v1');
  assert.equal((await fetch(base() + '/agents')).status, 401);
  assert.equal((await raw('/agents')).status, 200);
});
test('HTML guide serves only the allowlisted Python sample downloads', async t => {
  const { base, request } = await setup(t);
  const guide = await fetch(base() + '/docs'); assert.equal(guide.status, 200);
  const html = await guide.text(); assert.match(html, /Download the Python samples/); assert.match(html, /\/docs.js/);
  const { readFileSync } = await import('node:fs');
  for (const file of ['client.py', 'rest.py', 'acp.py', 'cancel.py', 'README.md']) {
    const response = await fetch(base() + '/examples/python/' + file);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type')!, /text\/plain/);
    assert.equal(await response.text(), readFileSync(new URL('../examples/python/' + file, import.meta.url), 'utf8'));
  }
  assert.equal((await fetch(base() + '/examples/python/.env')).status, 401);
  assert.equal((await request('/capabilities')).data.apis.docs_url, '/docs');
});
