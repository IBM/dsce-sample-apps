import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const alice = 'alice-token-'.padEnd(32, 'a'), bob = 'bob-token-'.padEnd(32, 'b');
test('MCP SDK lifecycle, authentication, ownership, retries, continuation and cancellation', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'headlessbob-mcp-'));
  const binary = fileURLToPath(new URL('./fixtures/bob.mjs', import.meta.url));
  chmodSync(binary, 0o755);
  const config = loadConfig({ PATH: process.env.PATH, HOME: process.env.HOME, BOB_BIN: binary, BOB_API_KEY: 'fixture', DATA_DIR: dataDir, PORT: '0', BOB_ENABLE_CONTINUATION: 'true', KILL_GRACE_MS: '25', RUN_TIMEOUT_MS: '3000', AUTH_TOKENS: JSON.stringify({ alice, bob }) });
  const app = await createApp(config); await app.listen();
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const clients: Client[] = [];
  t.after(async () => { for (const client of clients) await client.close(); await app.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const connect = async (token: string) => {
    const client = new Client({ name: 'test', version: '1.0.0' }); clients.push(client);
    await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
    return client;
  };
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) {
    const r = await fetch(base + '/mcp', { method: 'POST', headers });
    assert.equal(r.status, 401); assert.equal(r.headers.get('www-authenticate'), 'Bearer'); await r.text();
  }
  const forbidden = await fetch(base + '/mcp', { method: 'POST', headers: { authorization: `Bearer ${alice}`, origin: 'https://evil.example' } });
  assert.equal(forbidden.status, 403); await forbidden.text();
  const get = await fetch(base + '/mcp', { headers: { authorization: `Bearer ${alice}` } });
  assert.equal(get.status, 405); await get.text();
  const client = await connect(alice), other = await connect(bob);
  assert.deepEqual((await client.listTools()).tools.map(x => x.name).sort(), ['bob_cancel_run', 'bob_create_thread', 'bob_get_run', 'bob_send_message']);
  const call = async (name: string, args: Record<string, unknown>, caller = client) => {
    const result = await caller.callTool({ name, arguments: args });
    return { error: result.isError, data: result.structuredContent as any };
  };
  const thread = (await call('bob_create_thread', { title: 'MCP test' })).data;
  assert.ok(thread.id);
  const input = { thread_id: thread.id, content: 'SLOW hello', request_id: 'first' };
  const run = (await call('bob_send_message', input)).data.run;
  assert.equal((await call('bob_send_message', input)).data.run.run_id, run.run_id);
  assert.equal((await call('bob_send_message', { ...input, content: 'different' })).error, true);
  for (const [name, args] of [['bob_send_message', input], ['bob_get_run', { run_id: run.run_id }], ['bob_cancel_run', { run_id: run.run_id }]] as const) {
    assert.equal((await call(name, args, other)).error, true);
  }
  assert.equal((await call('bob_get_run', { run_id: 'bad' })).error, true);
  const done = async (id: string) => {
    for (let i = 0; i < 150; i++) {
      const result = (await call('bob_get_run', { run_id: id })).data;
      if (['completed', 'failed', 'cancelled'].includes(result.status)) return result;
      await delay(20);
    }
    throw new Error('Run did not finish');
  };
  assert.equal((await done(run.run_id)).status, 'completed');
  const next = (await call('bob_send_message', { ...input, content: 'follow-up', request_id: 'next' })).data.run;
  assert.equal(next.session_id, run.session_id);
  assert.equal((await done(next.run_id)).output[0].parts[0].content, 'continued');
  const history = await fetch(base + `/api/v1/threads/${thread.id}/messages`, { headers: { authorization: `Bearer ${alice}` } });
  assert.equal((await history.json() as any).items.length, 4);
  const cancel = (await call('bob_send_message', { ...input, content: 'SLOW', request_id: 'cancel' })).data.run;
  await call('bob_cancel_run', { run_id: cancel.run_id });
  assert.equal((await done(cancel.run_id)).status, 'cancelled');
});
