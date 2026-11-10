import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BOB_TOKEN, createHarness, readyWorkflow, waitFor, type Harness } from '../helpers/harness.js';

let h: Harness;
afterEach(async () => h?.cleanup());

const finished = (h: Harness, id: string) =>
  waitFor(async () => {
    const r = await h.api('get', `/api/executions/${id}`);
    return ['completed', 'failed', 'cancelled'].includes(r.body.status) ? r.body : false;
  }, 20000);

describe('end-to-end workflow against a Headless Bob contract double', () => {
  it('connect -> clone -> validate QSE -> execute -> report -> history', async () => {
    h = await createHarness();
    const repoId = await readyWorkflow(h);

    const start = await h.api('post', '/api/executions', { repositoryId: repoId, prompt: 'Analyze this repository using QSE CLI.' });
    expect(start.status).toBe(202);
    const id = start.body.id as string;
    const exec = await finished(h, id);
    expect(exec.status).toBe('completed');
    expect(exec.mock).toBe(false);
    expect(exec.qseVersion).toBe('App Version : 9.9.9-test');
    expect(exec.bobRunId).toBeTruthy();

    // lifecycle: backend steps and the Headless Bob step are distinguishable
    const bySource = Object.fromEntries(exec.steps.map((s: any) => [s.key, s.source]));
    expect(bySource.bob_processing).toBe('headless-bob');
    expect(bySource.prepare_repo).toBe('backend');
    expect(exec.steps.every((s: any) => s.status === 'completed')).toBe(true);

    // the prompt carries mapped (container-visible) paths, not backend paths
    const prompt = [...h.bob.runs.values()][0].prompt as string;
    expect(prompt).toMatch(/\/shared\/workspaces\/repo-[0-9a-f]+\/repo/);
    expect(prompt).toContain('/opt/qse-cli/cli.sh');
    expect(prompt).toContain('Analyze this repository using QSE CLI.');
    expect(prompt).not.toContain(h.tmp);

    // logs include Bob streamed output with provenance
    const logs = (await h.api('get', `/api/executions/${id}/logs`)).body.items as any[];
    expect(logs.some((l) => l.source === 'headless-bob' && l.message.includes('QSE scan finished'))).toBe(true);
    expect(logs.some((l) => l.source === 'backend')).toBe(true);

    // report comes from the Bob-written file, with real content
    const rep = await h.api('get', `/api/executions/${id}/report`);
    expect(rep.status).toBe(200);
    expect(rep.body.source).toBe('headless-bob-file');
    expect(rep.body.mock).toBe(false);
    expect(rep.body.bobMarkdown).toContain('RSA-2048');
    expect(rep.body.sections.map((s: any) => s.key)).toEqual(expect.arrayContaining(['summary', 'findings', 'recommendations', 'conclusion']));
    expect(rep.body.artifacts.map((a: any) => a.path)).toEqual(expect.arrayContaining(['qse-e2e-report.md', 'scan-output.json']));

    // downloads
    const md = await h.api('get', `/api/reports/${rep.body.id}/download?format=markdown`);
    expect(md.status).toBe(200);
    expect(md.text).toContain('RSA-2048');
    expect(md.headers['content-disposition']).toContain('.md');
    const pdf = await h.api('get', `/api/reports/${rep.body.id}/download?format=pdf`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    const json = await h.api('get', `/api/reports/${rep.body.id}/export`);
    expect(json.body.report.executionId).toBe(id);
    expect(json.body.logs.length).toBeGreaterThan(0);

    // artifact download proxies the real file from Bob
    const art = rep.body.artifacts.find((a: any) => a.path === 'scan-output.json');
    const dl = await h.api('get', `/api/executions/${id}/artifacts/${art.id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('scan-output.json');

    // history
    const hist = await h.api('get', '/api/executions?status=completed&search=crypto-demo');
    expect(hist.body.total).toBe(1);
    expect(hist.body.items[0].reportId).toBe(rep.body.id);
    expect((await h.api('get', '/api/executions?status=failed')).body.total).toBe(0);
    const prompts = await h.api('get', '/api/executions/prompts');
    expect(prompts.body.items[0].prompt).toContain('Analyze this repository');
  });

  it('falls back to the final answer when Bob does not write the report file, and says so', async () => {
    h = await createHarness({ bob: { writeReportFile: false } });
    const repoId = await readyWorkflow(h);
    const id = (await h.api('post', '/api/executions', { repositoryId: repoId, prompt: 'scan' })).body.id;
    const exec = await finished(h, id);
    expect(exec.status).toBe('completed');
    const rep = (await h.api('get', `/api/executions/${id}/report`)).body;
    expect(rep.source).toBe('headless-bob-output');
    expect(exec.warnings.join(' ')).toContain('did not write');
  });

  it('records a Headless Bob failure honestly and produces no report', async () => {
    h = await createHarness({ bob: { fail: true } });
    const repoId = await readyWorkflow(h);
    const id = (await h.api('post', '/api/executions', { repositoryId: repoId, prompt: 'scan' })).body.id;
    const exec = await finished(h, id);
    expect(exec.status).toBe('failed');
    expect(exec.error).toContain('Bob ACP exited');
    expect(exec.reportId).toBeNull();
    expect((await h.api('get', `/api/executions/${id}/report`)).status).toBe(404);
    const failedStep = exec.steps.find((s: any) => s.status === 'failed');
    expect(failedStep.key).toBe('bob_processing');
    expect(exec.steps.filter((s: any) => s.status === 'skipped').length).toBeGreaterThan(0);
  });

  it('cancels a running execution through the Headless Bob cancel API', async () => {
    h = await createHarness({ bob: { hold: true } });
    const repoId = await readyWorkflow(h);
    const id = (await h.api('post', '/api/executions', { repositoryId: repoId, prompt: 'long task' })).body.id;
    await waitFor(async () => (await h.api('get', `/api/executions/${id}`)).body.bobRunId);
    await waitFor(async () => (await h.api('get', `/api/executions/${id}/logs`)).body.items.some((l: any) => l.source === 'headless-bob'));
    const c = await h.api('post', `/api/executions/${id}/cancel`);
    expect(c.status).toBe(202);
    const exec = await finished(h, id);
    expect(exec.status).toBe('cancelled');
    expect(h.bob.requests.some((r) => r.method === 'POST' && r.path.endsWith('/cancel'))).toBe(true);
    expect((await h.api('post', `/api/executions/${id}/cancel`)).status).toBe(409);
  });

  it('enforces start preconditions with clear messages', async () => {
    h = await createHarness();
    const fakeRepo = '11111111-1111-4111-8111-111111111111';
    let r = await h.api('post', '/api/executions', { repositoryId: fakeRepo, prompt: 'x' });
    expect(r.body.error.code).toBe('bob_not_connected');
    await h.api('post', '/api/bob/connect', { endpoint: h.bob.url, adapter: 'rest-threads', apiBasePath: '/api/v1', authMode: 'bearer', apiKey: BOB_TOKEN });
    r = await h.api('post', '/api/executions', { repositoryId: fakeRepo, prompt: 'x' });
    expect(r.status).toBe(404);
    const clone = await h.api('post', '/api/repositories/clone', { url: 'https://github.com/acme/crypto-demo', branch: 'main' });
    await waitFor(async () => (await h.api('get', `/api/repositories/${clone.body.id}`)).body.status === 'cloned');
    r = await h.api('post', '/api/executions', { repositoryId: clone.body.id, prompt: 'x' });
    expect(r.body.error.code).toBe('qse_not_validated');
    await h.api('post', '/api/qse/configure', { mode: 'auto' });
    r = await h.api('post', '/api/executions', { repositoryId: clone.body.id, prompt: '   ' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('prompt_required');
  });

  it('clone removes symlinks escaping the checkout and never runs repository content', async () => {
    h = await createHarness();
    const repoId = await readyWorkflow(h);
    const view = (await h.api('get', `/api/repositories/${repoId}`)).body;
    expect(view.fileCount).toBe(2); // README.md + src/crypto.java; evil-link removed
    expect(view.workspaceLabel).toMatch(/^repo-[0-9a-f]+\/repo$/);
    expect(JSON.stringify(view)).not.toContain(h.tmp); // no internal paths exposed
    const dir = fs.readdirSync(h.config.workspaceRoot).find((d) => d.startsWith('repo-'))!;
    expect(fs.existsSync(path.join(h.config.workspaceRoot, dir, 'repo', 'evil-link'))).toBe(false);
    const remote = fs.readFileSync(path.join(h.config.workspaceRoot, dir, 'repo', '.git', 'config'), 'utf8');
    expect(remote).not.toContain('[remote "origin"]');
  });
});
