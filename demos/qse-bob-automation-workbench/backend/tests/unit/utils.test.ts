import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { classifyAddress, parseEndpoint } from '../../src/utils/ssrf.js';
import { PathMapper, isInside, resolveInside, sanitizeRelativePath } from '../../src/utils/paths.js';
import { redact, redactor } from '../../src/utils/redact.js';
import { SecretBox } from '../../src/utils/secret-box.js';
import { hashPassword, verifyPassword } from '../../src/utils/passwords.js';
import { runFile, minimalEnv } from '../../src/utils/safe-exec.js';
import { loadConfig } from '../../src/config/env.js';

const key = () => crypto.randomBytes(32).toString('base64');

describe('SSRF address classification', () => {
  it.each([
    ['169.254.169.254', 'blocked'],
    ['0.0.0.0', 'blocked'],
    ['224.0.0.1', 'blocked'],
    ['127.0.0.1', 'loopback'],
    ['::1', 'loopback'],
    ['10.1.2.3', 'private'],
    ['172.20.0.5', 'private'],
    ['192.168.1.1', 'private'],
    ['fd12::1', 'private'],
    ['::ffff:169.254.169.254', 'blocked'],
    ['::ffff:10.0.0.1', 'private'],
    ['fe80::1', 'blocked'],
    ['8.8.8.8', 'public'],
    ['2606:4700::1111', 'public']
  ])('%s -> %s', (ip, cls) => expect(classifyAddress(ip)).toBe(cls));

  it('rejects non-http schemes, credentials and queries in endpoints', () => {
    for (const bad of ['file:///etc/passwd', 'gopher://x', 'ftp://x', 'http://u:p@host', 'http://host?x=1', 'not a url']) {
      expect(() => parseEndpoint(bad), bad).toThrow();
    }
    expect(parseEndpoint('http://headless-bob:3000').hostname).toBe('headless-bob');
  });
});

describe('paths', () => {
  it('detects traversal', () => {
    expect(isInside('/a/b', '/a/b/c')).toBe(true);
    expect(isInside('/a/b', '/a/bc')).toBe(false);
    expect(isInside('/a/b', '/a/b/../c')).toBe(false);
    expect(() => resolveInside('/a/b', '../c')).toThrow();
    expect(() => sanitizeRelativePath('../x')).toThrow();
    expect(() => sanitizeRelativePath('/abs')).toThrow();
    expect(() => sanitizeRelativePath('a\\b')).toThrow();
    expect(sanitizeRelativePath('a/b.txt')).toBe('a/b.txt');
  });

  it('maps only shared directories into the Bob container view', () => {
    const m = new PathMapper([
      { label: 'ws', backend: '/data/workspaces', bob: '/shared/workspaces' },
      { label: 'qse', backend: '/opt/qse-cli', bob: '/opt/qse-cli' }
    ]);
    expect(m.toBob('/data/workspaces/repo-1/repo')).toBe('/shared/workspaces/repo-1/repo');
    expect(m.toBob('/opt/qse-cli/cli.sh')).toBe('/opt/qse-cli/cli.sh');
    expect(m.toBob('/usr/local/bin/qse')).toBeNull();
    expect(m.toBob('/data/workspaces-evil/x')).toBeNull();
  });
});

describe('redaction', () => {
  it('removes tokens, auth headers and registered secrets', () => {
    expect(redact('token ghp_abcdefghijklmnopqrstuvwxyz0123456789')).not.toContain('ghp_abc');
    expect(redact('Authorization: Bearer abcdefghijkl')).not.toContain('abcdefghijkl');
    expect(redact('https://user:pass1234@github.com/x/y')).not.toContain('pass1234');
    redactor.register('super-secret-value');
    expect(redact('the key is super-secret-value ok')).toBe('the key is [REDACTED] ok');
    expect(redact('api_key=abcdef123456')).not.toContain('abcdef123456');
  });
});

describe('SecretBox', () => {
  it('round-trips and rotates keys', () => {
    const k1 = `k1:${key()}`;
    const k2 = `k2:${key()}`;
    const old = new SecretBox(k1);
    const sealed = old.seal('s3cret');
    expect(sealed).not.toContain('s3cret');
    const rotated = new SecretBox(`${k2},${k1}`);
    expect(rotated.open(sealed)).toBe('s3cret');
    const resealed = rotated.seal(rotated.open(sealed));
    expect(rotated.keyIdOf(resealed)).toBe('k2');
    expect(new SecretBox(k2).open(resealed)).toBe('s3cret');
    expect(() => new SecretBox(k2).open(sealed)).toThrow();
  });

  it('detects tampering and bad keys', () => {
    const box = new SecretBox(`k1:${key()}`);
    const sealed = JSON.parse(box.seal('x'));
    sealed.ct = Buffer.from('tampered').toString('base64');
    expect(() => box.open(JSON.stringify(sealed))).toThrow();
    expect(() => new SecretBox('k1:c2hvcnQ=')).toThrow(/32 bytes/);
    expect(() => new SecretBox('nokid')).toThrow();
  });
});

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const h = await hashPassword('hunter2-hunter2');
    expect(await verifyPassword('hunter2-hunter2', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(h).not.toContain('hunter2');
  });
});

describe('safe-exec', () => {
  it('passes arguments without shell interpretation', async () => {
    const r = await runFile('/bin/echo', ['$(whoami); `id` && echo pwned'], { env: minimalEnv(), timeoutMs: 5000 });
    expect(r.stdout.trim()).toBe('$(whoami); `id` && echo pwned');
  });

  it('enforces timeouts', async () => {
    const r = await runFile('/bin/sleep', ['5'], { env: minimalEnv(), timeoutMs: 200 });
    expect(r.timedOut).toBe(true);
  });

  it('reports spawn errors', async () => {
    const r = await runFile('/nonexistent/bin', [], { env: minimalEnv(), timeoutMs: 1000 });
    expect(r.spawnError).toBeTruthy();
  });

  it('does not leak parent secrets into children', async () => {
    process.env.SUPER_SECRET_FOR_TEST = 'leak';
    const r = await runFile('/usr/bin/env', [], { env: minimalEnv(), timeoutMs: 3000 });
    expect(r.stdout).not.toContain('SUPER_SECRET_FOR_TEST');
  });
});

describe('config validation', () => {
  const base = { SECRETS_KEYS: `k:${key()}`, ADMIN_PASSWORD: 'a-long-enough-password' };
  it('requires secrets and a strong admin password', () => {
    expect(() => loadConfig({})).toThrow(/SECRETS_KEYS/);
    expect(() => loadConfig({ SECRETS_KEYS: base.SECRETS_KEYS, ADMIN_PASSWORD: 'short' })).toThrow(/ADMIN_PASSWORD/);
    expect(loadConfig(base).execution.strategy).toBe('shared-volume');
  });
  it('defaults STREAM_MODE to mock and accepts only mock or realtime', () => {
    expect(loadConfig(base).streamMode).toBe('mock');
    expect(loadConfig({ ...base, STREAM_MODE: 'realtime' }).streamMode).toBe('realtime');
    expect(() => loadConfig({ ...base, STREAM_MODE: 'live' })).toThrow(/STREAM_MODE/);
  });
  it('keeps demo and real data in separate databases by default', () => {
    expect(loadConfig(base).databasePath).toMatch(/workbench-demo\.sqlite$/);
    expect(loadConfig({ ...base, STREAM_MODE: 'realtime' }).databasePath).toMatch(/workbench\.sqlite$/);
  });
  it('forces secure cookies in production, including for the demo', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production', STREAM_MODE: 'mock' }).streamMode).toBe('mock');
    expect(loadConfig({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'false' }).cookieSecure).toBe(true);
  });
});
