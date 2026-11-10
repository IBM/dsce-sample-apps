import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { ADMIN_PASSWORD, BOB_TOKEN, createHarness, waitFor, type Harness } from '../helpers/harness.js';

let h: Harness;
afterEach(async () => h?.cleanup());

describe('authentication, sessions and CSRF', () => {
  it('requires authentication for every API route except login', async () => {
    h = await createHarness();
    for (const [m, u] of [
      ['get', '/api/bob/status'],
      ['get', '/api/executions'],
      ['get', '/api/settings'],
      ['post', '/api/executions'],
      ['get', '/api/reports/x']
    ] as const) {
      const r = await request(h.app)[m](u);
      expect(r.status, u).toBe(401);
    }
  });

  it('rejects bad credentials uniformly and sets a hardened cookie on success', async () => {
    h = await createHarness();
    const bad = await request(h.app).post('/api/auth/login').send({ username: 'admin', password: 'nope-nope-nope' });
    const unknown = await request(h.app).post('/api/auth/login').send({ username: 'ghost', password: 'nope-nope-nope' });
    expect(bad.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);
    const ok = await request(h.app).post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
    const cookie = (ok.headers['set-cookie'] as unknown as string[])[0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('enforces CSRF tokens and same-origin on state-changing requests', async () => {
    h = await createHarness();
    const noToken = await h.agent.post('/api/bob/disconnect');
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('csrf_invalid');
    const wrong = await h.agent.post('/api/bob/disconnect').set('x-csrf-token', 'wrong');
    expect(wrong.status).toBe(403);
    const crossOrigin = await h.agent.post('/api/bob/disconnect').set('x-csrf-token', h.csrf).set('origin', 'https://evil.example');
    expect(crossOrigin.status).toBe(403);
    const ok = await h.api('post', '/api/bob/disconnect');
    expect(ok.status).toBe(200);
  });

  it('rejects a state-changing request without a CSRF token before it reaches routing', async () => {
    h = await createHarness();
    // A route that does not exist: 403 (not 404) proves the app-level guard ran ahead of the router.
    const noToken = await h.agent.post('/api/does-not-exist');
    expect(noToken.status).toBe(403);
    expect(noToken.body.error.code).toBe('csrf_invalid');
    const crossOrigin = await h.agent.delete('/api/repositories/x').set('x-csrf-token', h.csrf).set('origin', 'https://evil.example');
    expect(crossOrigin.status).toBe(403);
    // Safe methods and sign-in are not affected.
    expect((await h.agent.get('/api/bob/status')).status).toBe(200);
    expect((await h.agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD })).status).toBe(200);
    // Without a session the request is still an ordinary 401.
    expect((await request(h.app).post('/api/bob/disconnect')).status).toBe(401);
  });

  it('invalidates the session on logout', async () => {
    h = await createHarness();
    expect((await h.api('post', '/api/auth/logout')).status).toBe(204);
    expect((await h.agent.get('/api/bob/status')).status).toBe(401);
  });

  it('enforces roles', async () => {
    h = await createHarness();
    const { hashPassword } = await import('../../src/utils/passwords.js');
    h.ctx.users.create('viewer1', await hashPassword('viewer-password-123'), 'viewer');
    const a = request.agent(h.app);
    const login = await a.post('/api/auth/login').send({ username: 'viewer1', password: 'viewer-password-123' });
    const r = await a.post('/api/bob/test-connection').set('x-csrf-token', login.body.csrfToken);
    expect(r.status).toBe(403);
    expect((await a.get('/api/bob/status')).status).toBe(200);
    expect((await a.post('/api/admin/rotate-secrets').set('x-csrf-token', login.body.csrfToken)).status).toBe(403);
  });

  it('applies secure headers, hides x-powered-by and returns correlation ids', async () => {
    h = await createHarness();
    const r = await request(h.app).get('/healthz').set('x-request-id', 'trace-abc-12345');
    expect(r.headers['x-request-id']).toBe('trace-abc-12345');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['strict-transport-security']).toBeTruthy();
    expect(r.headers['content-security-policy']).toContain("default-src 'none'");
    const evil = await request(h.app).get('/healthz').set('x-request-id', 'bad id with spaces');
    expect(evil.headers['x-request-id']).not.toContain(' ');
  });

  it('rate limits login attempts', async () => {
    h = await createHarness({ env: { LOGIN_RATE_LIMIT_MAX: '3' } });
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await request(h.app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-wrong-wrong' })).status;
    expect(last).toBe(429);
  });

  it('exposes probes without authentication', async () => {
    h = await createHarness();
    expect((await request(h.app).get('/healthz')).body.status).toBe('ok');
    const ready = await request(h.app).get('/readyz');
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe(true);
  });
});

describe('Headless Bob connection', () => {
  const connect = (body: Record<string, unknown>) => h.api('post', '/api/bob/connect', body);

  it('starts in the not-configured state', async () => {
    h = await createHarness();
    expect((await h.api('get', '/api/bob/status')).body.state).toBe('not_configured');
  });

  it('connects, retrieves capabilities and never returns the API key', async () => {
    h = await createHarness();
    const r = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(r.body.state).toBe('connected');
    expect(r.body.capabilities.features.cancellation).toBe(true);
    expect(r.body.capabilities.limits.maxMessageCharacters).toBe(20000);
    expect(r.body.apiKeyHint).toBe(`••••${BOB_TOKEN.slice(-4)}`);
    expect(JSON.stringify(r.body)).not.toContain(BOB_TOKEN);
    const status = await h.api('get', '/api/bob/status');
    expect(JSON.stringify(status.body)).not.toContain(BOB_TOKEN);
    // stored encrypted at rest
    const row = h.ctx.db.get<{ api_key_enc: string }>('SELECT api_key_enc FROM bob_connection');
    expect(row!.api_key_enc).not.toContain(BOB_TOKEN);
    // the key was sent as a bearer token to Bob
    expect(h.bob.requests.some((q) => q.auth === `Bearer ${BOB_TOKEN}`)).toBe(true);
  });

  it('reports authentication failures distinctly', async () => {
    h = await createHarness();
    const r = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: 'wrong-token-value-1234' });
    expect(r.body.state).toBe('auth_failed');
    expect(r.body.message).toContain('401');
    expect(JSON.stringify(r.body)).not.toContain('wrong-token-value-1234');
  });

  it('reports connection failures distinctly', async () => {
    h = await createHarness();
    const r = await connect({ endpoint: 'http://127.0.0.1:1', adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(r.body.state).toBe('connection_failed');
    expect(r.body.message).toMatch(/refused|reach|resolve|timed/i);
  });

  it('flags a wrong API base path instead of pretending success', async () => {
    h = await createHarness();
    const r = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/nope', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(r.body.state).toBe('connection_failed');
    expect(r.body.message).toContain('/nope/capabilities');
  });

  it('requires an API key and keeps the stored one when re-saving the same endpoint', async () => {
    h = await createHarness();
    const missing = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer' });
    expect(missing.status).toBe(400);
    await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    const again = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer' });
    expect(again.body.state).toBe('connected');
  });

  it('disconnect clears the stored configuration and secret', async () => {
    h = await createHarness();
    await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    const d = await h.api('post', '/api/bob/disconnect');
    expect(d.body.state).toBe('not_configured');
    expect(h.ctx.db.get('SELECT * FROM bob_connection')).toBeUndefined();
  });

  it('blocks SSRF targets: metadata addresses, unlisted hosts and bad schemes', async () => {
    h = await createHarness({ env: { BOB_ALLOW_PRIVATE_NETWORK: 'false' } });
    const meta = await connect({ endpoint: 'http://169.254.169.254', adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(meta.status).toBe(400);
    expect(meta.body.error.code).toBe('endpoint_not_allowed');
    expect(meta.body.error.message).toMatch(/blocked address/);
    const loop = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(loop.status).toBe(400);
    expect(loop.body.error.message).toMatch(/private or loopback/);
    // hostnames are checked at connect time (DNS-rebinding safe)
    const named = await connect({ endpoint: `http://localhost:${new URL(h.bob.url).port}`, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(named.body.state).toBe('connection_failed');
    expect(named.body.message).toMatch(/private or loopback/);
    expect((await connect({ endpoint: 'file:///etc/passwd', adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN })).status).toBe(400);
    expect(h.bob.requests.length).toBe(0); // nothing reached the target
  });

  it('honours an allow-list of Bob hosts', async () => {
    h = await createHarness({ env: { BOB_ALLOWED_HOSTS: 'headless-bob' } });
    const r = await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('endpoint_not_allowed');
  });

  it('rejects the removed mock adapter kind in realtime mode', async () => {
    h = await createHarness();
    const r = await connect({ adapter: 'mock' });
    expect(r.status).toBe(400);
    const status = await h.api('get', '/api/bob/status');
    expect(status.body.mock).toBe(false);
    expect(status.body.state).toBe('not_configured');
  });

  it('rotates the encryption key for stored secrets', async () => {
    h = await createHarness();
    await connect({ endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    const r = await h.api('post', '/api/admin/rotate-secrets');
    expect(r.body.bobApiKeyReencrypted).toBe(true);
    expect((await h.api('post', '/api/bob/test-connection')).body.state).toBe('connected');
  });
});

describe('GitHub repository endpoints', () => {
  it('rejects malicious URLs and branches before any git process is started', async () => {
    h = await createHarness();
    for (const url of ['https://evil.example.com/a/b', 'https://github.com/a/b;id', 'git@github.com:a/b.git', 'https://tok@github.com/a/b']) {
      const r = await h.api('post', '/api/repositories/validate', { url, branch: 'main' });
      expect(r.status, url).toBe(400);
    }
    const b = await h.api('post', '/api/repositories/validate', { url: 'https://github.com/a/b', branch: '--upload-pack=touch /tmp/x' });
    expect(b.status).toBe(400);
  });

  it('validates a reachable repository and reports unknown branches', async () => {
    h = await createHarness();
    const ok = await h.api('post', '/api/repositories/validate', { url: 'https://github.com/acme/crypto-demo', branch: 'main' });
    expect(ok.status).toBe(200);
    expect(ok.body.commit).toMatch(/^[0-9a-f]{40}$/);
    const missing = await h.api('post', '/api/repositories/validate', { url: 'https://github.com/acme/crypto-demo', branch: 'nope' });
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe('branch_not_found');
  });

  it('encrypts and never exposes the access token', async () => {
    h = await createHarness();
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const r = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/acme/crypto-demo', branch: 'main', token });
    expect(r.body.hasToken).toBe(true);
    expect(JSON.stringify(r.body)).not.toContain(token);
    await waitFor(async () => (await h.api('get', `/api/repositories/${r.body.id}`)).body.status !== 'cloning');
    const row = h.ctx.db.get<{ token_enc: string }>('SELECT token_enc FROM repositories');
    expect(row!.token_enc).not.toContain(token);
    const final = await h.api('get', `/api/repositories/${r.body.id}`);
    expect(JSON.stringify(final.body)).not.toContain(token);
  });

  it('reclone refreshes the checkout and clear workspace removes it', async () => {
    h = await createHarness();
    const c = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/acme/crypto-demo', branch: 'main' });
    await waitFor(async () => (await h.api('get', `/api/repositories/${c.body.id}`)).body.status === 'cloned');
    const before = (await h.api('get', `/api/repositories/${c.body.id}`)).body.lastClonedAt;
    await new Promise((r) => setTimeout(r, 15));
    expect((await h.api('post', `/api/repositories/${c.body.id}/reclone`, {})).status).toBe(202);
    await waitFor(async () => {
      const v = (await h.api('get', `/api/repositories/${c.body.id}`)).body;
      return v.status === 'cloned' && v.lastClonedAt !== before;
    });
    expect((await h.api('delete', `/api/repositories/${c.body.id}`)).status).toBe(204);
    expect((await h.api('get', `/api/repositories/${c.body.id}`)).status).toBe(404);
  });

  it('surfaces clone failures with an explanation', async () => {
    h = await createHarness();
    const c = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/acme/does-not-exist', branch: 'main' });
    const v = await waitFor(async () => {
      const r = (await h.api('get', `/api/repositories/${c.body.id}`)).body;
      return r.status === 'failed' ? r : false;
    });
    expect(v.error).toBeTruthy();
  });
});

describe('QSE CLI discovery and validation', () => {
  it('discovers candidates from QSE_CLI_PATH and search dirs without executing them', async () => {
    h = await createHarness();
    const r = await h.api('get', '/api/qse/discover');
    const paths = r.body.candidates.map((c: any) => c.path);
    expect(paths).toContain(`${h.qseDir}/cli.sh`);
    expect(r.body.candidates.every((c: any) => c.allowed && c.executable)).toBe(true);
  });

  it('validates by running the version command and captures the version', async () => {
    h = await createHarness();
    const r = await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/cli.sh` });
    expect(r.body.status).toBe('valid');
    expect(r.body.version).toBe('App Version : 9.9.9-test');
    expect(r.body.validatedAt).toBeTruthy();
    expect(r.body.bobVisiblePath).toBe('/opt/qse-cli/cli.sh');
    const again = await h.api('post', '/api/qse/validate');
    expect(again.body.status).toBe('valid');
  });

  it('reports a CLI that fails its version command', async () => {
    h = await createHarness();
    const r = await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/qse-cli` });
    expect(r.body.status).toBe('invalid');
    expect(r.body.message).toContain('exited with code 1');
  });

  it('rejects relative paths, missing files, arbitrary binaries and bad version args', async () => {
    h = await createHarness();
    expect((await h.api('post', '/api/qse/configure', { mode: 'manual', path: 'cli.sh' })).status).toBe(400);
    expect((await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/missing` })).body.message).toContain('does not exist');
    const bin = await h.api('post', '/api/qse/configure', { mode: 'manual', path: '/bin/sh' });
    expect(bin.body.status).toBe('invalid');
    expect(bin.body.message).toMatch(/must be one of|must be inside/);
    expect((await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/cli.sh`, versionArgs: ['--version; id'] })).status).toBe(400);
  });

  it('refuses a symlink that escapes the allowed directory', async () => {
    h = await createHarness();
    const fs = await import('node:fs');
    fs.symlinkSync('/bin/sh', `${h.qseDir}/evil`);
    const r = await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/evil` });
    expect(r.body.status).toBe('invalid');
  });

  it('marks a valid CLI outside shared mounts as not reachable and blocks execution', async () => {
    h = await createHarness({ env: { QSE_MOUNT_DIR: '/somewhere/else' } });
    const r = await h.api('post', '/api/qse/configure', { mode: 'manual', path: `${h.qseDir}/cli.sh` });
    expect(r.body.status).toBe('valid');
    expect(r.body.reachableFromBob).toBe(false);
    expect(r.body.bobVisiblePath).toBeNull();
    expect(r.body.message).toContain('not under a directory shared');
  });
});
