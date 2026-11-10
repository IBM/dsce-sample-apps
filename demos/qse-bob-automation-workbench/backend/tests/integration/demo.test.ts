import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createHarness, waitFor, type Harness } from '../helpers/harness.js';
import { DEMO_BANNER } from '../../src/services/demo.service.js';

let h: Harness;
afterEach(async () => h?.cleanup());

const DEMO = { STREAM_MODE: 'mock' };
const PROMPT = 'Any prompt at all - it must not be sent anywhere in demo mode.';

async function demoWorkflow(hh: Harness) {
  const bob = await hh.api('post', '/api/bob/connect', { endpoint: 'http://anything.example:3000', adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: 'not-a-real-key-123456' });
  const clone = await hh.api('post', '/api/repositories/clone', { url: 'https://github.com/someone/whatever', branch: 'main' });
  const qse = await hh.api('post', '/api/qse/configure', { mode: 'auto' });
  return { bob, clone, qse };
}

describe('STREAM_MODE=mock (demo replay of a recorded real run)', () => {
  it('serves the whole workflow without Headless Bob, git or the QSE CLI', async () => {
    // Real adapters are impossible here: git is a nonexistent binary and the QSE CLI is a missing path.
    h = await createHarness({ env: { ...DEMO, GIT_BIN: '/nonexistent/git', QSE_CLI_PATH: '/nonexistent/cli.sh', QSE_CLI_SEARCH_DIRS: '/nonexistent', QSE_CLI_ALLOWED_DIRS: '/nonexistent' } });
    const { bob, clone, qse } = await demoWorkflow(h);

    expect(bob.status).toBe(200);
    expect(bob.body.state).toBe('connected');
    expect(bob.body.mock).toBe(true);
    expect(bob.body.message).toContain(DEMO_BANNER);
    expect(bob.body.endpoint).toBeNull();
    expect(bob.body.apiKeyHint).toBeNull();
    expect(bob.body.capabilities.limits.maxConcurrentRuns).toBe(2);
    expect(h.bob.requests.length).toBe(0); // the address entered was never contacted

    expect(clone.status).toBe(202);
    expect(clone.body.status).toBe('cloned');
    expect(clone.body.name).toBe('crypto-inventory-demo');
    expect(clone.body.fileCount).toBe(55);
    expect(clone.body.progress.join('\n')).toContain('No git clone was performed');
    expect(JSON.stringify(clone.body)).not.toMatch(/\/Users\/|\/tmp\//);

    expect(qse.body.status).toBe('valid');
    expect(qse.body.version).toContain('2.3.1.0');
    expect(qse.body.message).toContain('not executed');

    const start = await h.api('post', '/api/executions', { repositoryId: clone.body.id, prompt: PROMPT });
    expect(start.status).toBe(202);
    expect(start.body.mock).toBe(true);
    const id = start.body.id as string;
    const exec = await waitFor(async () => {
      const r = (await h.api('get', `/api/executions/${id}`)).body;
      return r.status === 'completed' ? r : r.status === 'failed' ? Promise.reject(new Error(r.error)) : false;
    }, 20000);
    expect(exec.steps.every((s: { status: string }) => s.status === 'completed')).toBe(true);
    expect(exec.steps.find((s: { key: string }) => s.key === 'bob_processing').source).toBe('headless-bob');
    expect(h.bob.requests.length).toBe(0);

    const logs = (await h.api('get', `/api/executions/${id}/logs`)).body.items as Array<{ message: string; source: string }>;
    expect(logs.some((l) => l.message.includes(DEMO_BANNER))).toBe(true);
    expect(logs.filter((l) => l.source === 'headless-bob').length).toBeGreaterThan(100);
    expect(logs.map((l) => l.message).join('\n')).not.toMatch(/\/Users\/|sunilgajula/);

    const rep = (await h.api('get', `/api/executions/${id}/report`)).body;
    expect(rep.mock).toBe(true);
    expect(rep.markdown).toContain(DEMO_BANNER);
    expect(rep.markdown).toContain('NOT produced by a Headless Bob execution started from this Workbench');
    expect(rep.markdown).toContain('Analyze this repository using QSE CLI'); // the recorded prompt, not the typed one
    expect(rep.markdown).toContain('was NOT sent anywhere');
    expect(rep.bobMarkdown).toBe(fs.readFileSync(h.config.demo.dataDir + '/workspace/qse-e2e-report.md', 'utf8'));
    expect(rep.bobMarkdown).toContain('Quantum Safe');
    expect(rep.sections.length).toBeGreaterThan(3);
    expect(rep.sourceDetail).toContain('DEMO');
    expect(JSON.stringify(rep)).not.toMatch(/\/Users\/|sunilgajula/);

    const dl = await h.api('get', `/api/reports/${rep.id}/download?format=markdown`);
    expect(dl.headers['content-disposition']).toContain('DEMO');
    const pdf = await h.api('get', `/api/reports/${rep.id}/download?format=pdf`);
    expect(pdf.status).toBe(200);

    // recorded files are downloadable from the bundled recording only
    const arts = (await h.api('get', `/api/executions/${id}/artifacts`)).body.items as Array<{ id: string; path: string }>;
    expect(arts.length).toBe(4);
    for (const a of arts) {
      const f = await h.api('get', `/api/executions/${id}/artifacts/${a.id}/download`);
      expect(f.status).toBe(200);
      expect(f.body.length ?? f.text.length).toBeGreaterThan(0);
    }

    const history = (await h.api('get', '/api/executions')).body;
    expect(history.total).toBe(1);
    expect(history.items[0].mock).toBe(true);
  });

  it('is the default when STREAM_MODE is unset', async () => {
    h = await createHarness({ env: { STREAM_MODE: undefined as unknown as string } });
    const settings = (await h.api('get', '/api/settings')).body;
    expect(settings.streamMode).toBe('mock');
  });

  it('still validates input and rejects an invalid repository URL', async () => {
    h = await createHarness({ env: DEMO });
    const bad = await h.api('post', '/api/repositories/clone', { url: 'https://evil.example.com/a/b', branch: 'main' });
    expect(bad.status).toBe(400);
    const badBranch = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/a/b', branch: '--upload-pack=x' });
    expect(badBranch.status).toBe(400);
    const noPrompt = await h.api('post', '/api/executions', { repositoryId: '00000000-0000-4000-8000-000000000000', prompt: '   ' });
    expect([404, 422, 400]).toContain(noPrompt.status);
  });

  it('refuses to start until the demo workflow is set up', async () => {
    h = await createHarness({ env: DEMO });
    const clone = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/a/b', branch: 'main' });
    const r = await h.api('post', '/api/executions', { repositoryId: clone.body.id, prompt: PROMPT });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('bob_not_connected');
  });

  it('can be cancelled mid-replay', async () => {
    h = await createHarness({ env: { ...DEMO, DEMO_BOB_WAIT_MS: '30000' } });
    const { clone } = await demoWorkflow(h);
    const start = await h.api('post', '/api/executions', { repositoryId: clone.body.id, prompt: PROMPT });
    const id = start.body.id as string;
    await waitFor(async () => (await h.api('get', `/api/executions/${id}`)).body.steps.find((s: { key: string }) => s.key === 'bob_processing').status === 'running');
    await h.api('post', `/api/executions/${id}/cancel`);
    const done = await waitFor(async () => {
      const r = (await h.api('get', `/api/executions/${id}`)).body;
      return r.status === 'cancelled' ? r : false;
    });
    expect(done.reportId).toBeNull();
  });

  it('fails fast when the recording is missing', async () => {
    await expect(createHarness({ env: { ...DEMO, DEMO_DATA_DIR: '/nonexistent/demo' } })).rejects.toThrow(/recorded demo data/);
  });
});

describe('STREAM_MODE=realtime never serves demo data', () => {
  it('reports realtime and never marks anything as a demo', async () => {
    h = await createHarness();
    expect((await h.api('get', '/api/settings')).body.streamMode).toBe('realtime');
    expect((await h.api('get', '/api/bob/status')).body.mock).toBe(false);
    expect(h.config.streamMode).toBe('realtime');
  });

  it('does not report a connected Bob, a cloned repository or a valid CLI without real ones', async () => {
    h = await createHarness({ env: { QSE_CLI_PATH: '/nonexistent/cli.sh', QSE_CLI_SEARCH_DIRS: '/nonexistent', QSE_CLI_ALLOWED_DIRS: '/nonexistent' } });
    expect((await h.api('get', '/api/bob/status')).body.state).toBe('not_configured');
    expect((await h.api('post', '/api/qse/configure', { mode: 'auto' })).status).toBe(404);
    expect((await h.api('get', '/api/qse/status')).body.status).toBe('not_configured');
    const start = await h.api('post', '/api/executions', { repositoryId: '00000000-0000-4000-8000-000000000000', prompt: 'x' });
    expect(start.status).toBeGreaterThanOrEqual(400);
  });

  it('really contacts the configured Headless Bob and fails honestly when it is unreachable', async () => {
    h = await createHarness();
    const r = await h.api('post', '/api/bob/connect', { endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: 'wrong-token-0123456789' });
    expect(r.body.state).toBe('auth_failed');
    expect(h.bob.requests.length).toBeGreaterThan(0);
  });

  it('does not require or load the recording', async () => {
    h = await createHarness({ env: { DEMO_DATA_DIR: '/nonexistent/demo' } });
    expect((await h.api('get', '/api/settings')).status).toBe(200);
  });
});
