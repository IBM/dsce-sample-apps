import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

if (!process.env.BOB_API_KEY) throw new Error('Set BOB_API_KEY in .env before running the live smoke test');
const dataDir = mkdtempSync(join(tmpdir(), 'headlessbob-smoke-'));
const app = await createApp(loadConfig({ ...process.env, DATA_DIR: dataDir, PORT: '0', HOST: '127.0.0.1', AUTH_TOKENS: '{}', BOB_ENABLE_CONTINUATION: 'true', BOB_MAX_COST: '0.3', RUN_TIMEOUT_MS: '90000' }));
try {
  await app.listen();
  const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
  const request = async (path: string, value?: unknown) => {
    const r = await fetch(base + path, { method: value === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    const data = await r.json() as any;
    assert.ok(r.ok, `HTTP ${r.status}: ${JSON.stringify(data)}`); return data;
  };
  const input = (content: string, extra = {}) => ({ agent_name: 'headlessbob', input: [{ role: 'user', parts: [{ content_type: 'text/plain', content }] }], ...extra });
  const first = await request('/runs', input('Create a file named smoke.txt containing exactly HEADLESSBOB_OK. Do not inspect any other files. Then respond DONE.'));
  assert.equal(first.status, 'completed', JSON.stringify(first.error));
  const session = app.store.session(first.session_id, 'local')!;
  assert.equal(readFileSync(join(session.workspace, 'smoke.txt'), 'utf8').trim(), 'HEADLESSBOB_OK');
  console.log('PASS real Bob file creation through ACP');
  const second = await request('/runs', input('Append a new line containing CONTINUED to the file you just created. Do not create a different file. Then respond DONE.', { session_id: first.session_id }));
  assert.equal(second.status, 'completed', JSON.stringify(second.error));
  assert.match(readFileSync(join(session.workspace, 'smoke.txt'), 'utf8'), /HEADLESSBOB_OK\s+CONTINUED/);
  console.log('PASS real Bob continuation with the same task ID and workspace');
  const slow = await request('/runs', input('Run this exact shell command once: touch cancellation-started; sleep 60. Wait for it to finish.', { mode: 'async' }));
  const slowSession = app.store.session(slow.session_id, 'local')!;
  for (let i = 0; i < 300 && !existsSync(join(slowSession.workspace, 'cancellation-started')); i++) await delay(100);
  assert.ok(existsSync(join(slowSession.workspace, 'cancellation-started')), 'Bob started the long-running command');
  await request(`/runs/${slow.run_id}/cancel`, {});
  const cancelled = await app.manager.wait(slow.run_id, 'local');
  assert.equal(cancelled.status, 'cancelled');
  console.log('PASS real Bob cancellation after tool execution starts');
} finally { await app.close(); rmSync(dataDir, { recursive: true, force: true }); }
