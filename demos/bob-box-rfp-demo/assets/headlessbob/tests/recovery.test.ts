import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../src/storage.js';
import { RunManager } from '../src/runs.js';
import { loadConfig } from '../src/config.js';
test('restart marks unfinished runs interrupted, taints session, and does not replay', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'headlessbob-recovery-'));
  const config = loadConfig({ DATA_DIR: dataDir });
  let store = new Store(dataDir);
  const session = { id: randomUUID(), owner: 'local', workspace: '', mode: 'agent', broken: false };
  session.workspace = store.newWorkspace(session.id); store.saveSession(session);
  const id = randomUUID();
  store.saveRun({ run_id: id, agent_name: 'headlessbob', session_id: session.id, status: 'in-progress', output: [], created_at: new Date().toISOString() }, 'local');
  store.close(); store = new Store(dataDir);
  try {
    let calls = 0;
    const manager = new RunManager(store, { ready: async () => ({ ready: true }), run: async () => { calls++; throw new Error('must not run'); } }, config);
    assert.equal(manager.get(id, 'local').error?.data?.reason, 'interrupted');
    assert.equal(store.session(session.id, 'local')?.broken, true);
    assert.equal(store.events(id).at(-1)?.type, 'run.failed'); assert.equal(calls, 0);
    await manager.close();
  } finally { store.close(); rmSync(dataDir, { recursive: true, force: true }); }
});
