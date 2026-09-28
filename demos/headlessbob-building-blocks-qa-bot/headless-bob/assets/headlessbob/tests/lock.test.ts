import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/storage.js';

test('storage lock excludes a second process and releases after SIGKILL', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'headlessbob-lock-'));
  const source = `import { Store } from ${JSON.stringify(new URL('../src/storage.ts', import.meta.url).href)}; new Store(process.argv[1]); console.log('READY'); setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', source, dir], { stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Lock subprocess did not start')), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    });
    assert.throws(() => new Store(dir), /Another service instance/);
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
    const store = new Store(dir); store.close();
  } finally { child.kill('SIGKILL'); rmSync(dir, { recursive: true, force: true }); }
});
