import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { extractVersion, validateQseCli } from '../../src/integrations/qse-cli/validator.js';

describe('extractVersion', () => {
  it('prefers the version line over a JVM banner', () => {
    const text = 'Picked up JAVA_TOOL_OPTIONS\nMax heap 4096M\nApp Version : 2.3.1.0 Build Version : 99\n';
    expect(extractVersion(text)).toBe('App Version : 2.3.1.0 Build Version : 99');
  });

  it('ignores usage lines that merely mention a version option', () => {
    const text = 'usage: cli\n-app_ver <app_ver> app_version : Version of the application being scanned.\nApp Version : 2.3.1.0';
    expect(extractVersion(text)).toBe('App Version : 2.3.1.0');
  });

  it('falls back to the first non-empty line', () => {
    expect(extractVersion('\n  tool 1.2.3  \nother')).toBe('tool 1.2.3');
  });

  it('returns an empty string for empty output', () => {
    expect(extractVersion('  \n ')).toBe('');
  });
});

describe('validateQseCli', () => {
  function cli(body: string): { dir: string; file: string } {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qse-val-')));
    const file = path.join(dir, 'cli.sh');
    fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    return { dir, file };
  }
  function config(dir: string) {
    const base = loadConfig({
      NODE_ENV: 'test',
      SECRETS_KEYS: `k1:${Buffer.alloc(32, 1).toString('base64')}`,
      ADMIN_PASSWORD: 'a-long-test-password',
      DATA_DIR: dir,
      QSE_CLI_ALLOWED_DIRS: dir,
      QSE_CLI_SEARCH_DIRS: dir
    } as NodeJS.ProcessEnv);
    return base.qse;
  }

  it('reports invalid when the licence has not been accepted, even with exit code 0', async () => {
    const { dir, file } = cli('echo "License Agreement have not been accepted.Please accept the license agreement to continue."; exit 0');
    const r = await validateQseCli(config(dir), file, ['-v'], { reachableFromBob: true, strategy: 'colocated' });
    expect(r.valid).toBe(false);
    expect(r.version).toBeNull();
    expect(r.message).toMatch(/licence agreement has not been accepted/i);
  });

  it('records the App Version line', async () => {
    const { dir, file } = cli('echo "JVM banner"; echo "App Version : 2.3.1.0"; exit 0');
    const r = await validateQseCli(config(dir), file, ['-v'], { reachableFromBob: true, strategy: 'colocated' });
    expect(r.valid).toBe(true);
    expect(r.version).toBe('App Version : 2.3.1.0');
  });
});
