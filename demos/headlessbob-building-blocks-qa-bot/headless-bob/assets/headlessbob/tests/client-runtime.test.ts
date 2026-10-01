import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { BobClientRuntime } from '../src/runtime/client.js';
import { setTimeout as delay } from 'node:timers/promises';

const binary = fileURLToPath(new URL('./fixtures/bob.mjs', import.meta.url)); chmodSync(binary, 0o755);
function setup(t: any, options: Record<string, string> = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'headlessbob-runtime-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const config = loadConfig({ PATH: process.env.PATH, HOME: process.env.HOME, BOB_BIN: binary, RUN_TIMEOUT_MS: '3000', KILL_GRACE_MS: '60', BOB_API_KEY: 'fixture', UNRELATED_SECRET: 'must-not-leak', AUTH_TOKENS: JSON.stringify({ owner: 'a'.repeat(24) }), ...options });
  const runtime = new BobClientRuntime(config);
  return { runtime, workspace, run: (prompt: string, signal = new AbortController().signal) => runtime.run({ workspace, mode: 'agent', prompt, signal, onText() {} }) };
}
test('fixture runner supports success and filters the child environment', async t => {
  const { run, workspace } = setup(t);
  assert.deepEqual(await run('hello'), { text: 'hello', taskId: 'fixture-task' });
  assert.ok(existsSync(join(workspace, 'closed.txt')), 'session is closed before process cleanup');
});
for (const [prompt, reason] of [['MALFORMED', 'invalid_output'], ['NO_RESULT', 'bob_exit'], ['ERROR_ZERO', 'execution_limit'], ['NONZERO', 'bob_exit'], ['OVERFLOW', 'output_limit'], ['RPC_ERROR', 'acp_error'], ['WRONG_TASK', 'session_recovery']]) test(`runner handles ${prompt}`, async t => {
  const { run } = setup(t, { MAX_OUTPUT_BYTES: '4096' });
  await assert.rejects(run(prompt), (e: any) => e.reason === reason);
});
test('timeout kills a resistant process group including child processes', async t => {
  const { run, workspace } = setup(t, { RUN_TIMEOUT_MS: '400' });
  await assert.rejects(run('CHILD'), (e: any) => e.reason === 'timeout');
  assert.ok(existsSync(join(workspace, 'child.pid')));
  const pid = Number(readFileSync(join(workspace, 'child.pid'), 'utf8'));
  let gone = false;
  for (let i = 0; i < 30; i++) { try { process.kill(pid, 0); } catch { gone = true; break; } await delay(20); }
  // Linux may retain an orphan zombie until PID 1 reaps it; it is no longer executing.
  if (!gone && process.platform === 'linux') gone = /\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  assert.ok(gone, 'descendant is no longer executing');
});
test('explicit abort cancels and missing executable fails', async t => {
  const { run } = setup(t);
  const controller = new AbortController(); const promise = run('HANG', controller.signal);
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(promise, (e: any) => e.reason === 'cancelled');
  const { run: missing } = setup(t, { BOB_BIN: '/no/such/headlessbob' });
  await assert.rejects(missing('hello'), (e: any) => e.reason === 'spawn_error');
});
test('decodes fragmented UTF-8 and filters thought chunks', async t => {
  const { run } = setup(t);
  assert.deepEqual(await run('UNICODE'), { text: 'Hello 🌍', taskId: 'fixture-task' });
});
test('permissions are scoped to one tool invocation and unsupported client methods fail', async t => {
  const { run, workspace } = setup(t);
  assert.equal((await run('PERMISSION')).text, 'permitted');
  assert.deepEqual(JSON.parse(readFileSync(join(workspace, 'permission.json'), 'utf8')), { outcome: { outcome: 'selected', optionId: 'once' } });
  assert.equal((await run('UNKNOWN')).text, 'unsupported');
  assert.equal(JSON.parse(readFileSync(join(workspace, 'unknown.json'), 'utf8')).code, -32601);
});
test('bounds non-text events and does not forward raw RPC errors', async t => {
  const { run } = setup(t, { MAX_EVENTS: '16' });
  await assert.rejects(run('EVENT_FLOOD'), (e: any) => e.reason === 'event_limit');
  await assert.rejects(run('RPC_ERROR'), (e: any) => e.reason === 'acp_error' && !e.message.includes('secret'));
});
test('cancel notification reaches Bob before cleanup and pre-abort never spawns', async t => {
  const { runtime, workspace } = setup(t);
  const controller = new AbortController();
  const promise = runtime.run({ workspace, mode: 'agent', prompt: 'HANG', signal: controller.signal, onText() {} });
  for (let i = 0; i < 100 && !existsSync(join(workspace, 'prompted.txt')); i++) await delay(10);
  assert.ok(existsSync(join(workspace, 'prompted.txt')));
  controller.abort();
  await assert.rejects(promise, (e: any) => e.reason === 'cancelled');
  assert.ok(existsSync(join(workspace, 'cancelled.txt')));
  const { run } = setup(t);
  await assert.rejects(run('hello', controller.signal), (e: any) => e.reason === 'cancelled');
});
