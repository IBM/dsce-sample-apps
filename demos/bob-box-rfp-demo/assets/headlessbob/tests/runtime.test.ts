import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { BobRuntime } from '../src/runtime/bob.js';
import { setTimeout as delay } from 'node:timers/promises';

const binary = fileURLToPath(new URL('./fixtures/bob.mjs', import.meta.url)); chmodSync(binary, 0o755);
function setup(t: any, options: Record<string, string> = {}) {
  const workspace = mkdtempSync(join(tmpdir(), 'headlessbob-runtime-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const config = loadConfig({ PATH: process.env.PATH, HOME: process.env.HOME, BOB_BIN: binary, RUN_TIMEOUT_MS: '3000', KILL_GRACE_MS: '60', BOB_API_KEY: 'fixture', UNRELATED_SECRET: 'must-not-leak', AUTH_TOKENS: JSON.stringify({ owner: 'a'.repeat(24) }), ...options });
  const runtime = new BobRuntime(config);
  return { runtime, workspace, run: (prompt: string, signal = new AbortController().signal) => runtime.run({ workspace, mode: 'agent', prompt, signal, onText() {} }) };
}
test('fixture runner supports success and filters the child environment', async t => {
  const { run } = setup(t);
  assert.deepEqual(await run('hello'), { text: 'hello', taskId: 'fixture-task' });
});
for (const [prompt, reason] of [['MALFORMED', 'invalid_output'], ['NO_RESULT', 'missing_result'], ['ERROR_ZERO', 'execution_limit'], ['NONZERO', 'bob_exit'], ['OVERFLOW', 'output_limit']]) test(`runner handles ${prompt}`, async t => {
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
