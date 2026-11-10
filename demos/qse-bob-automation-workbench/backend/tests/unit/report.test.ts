import { describe, expect, it } from 'vitest';
import { classifyHeading, parseSections } from '../../src/services/report.service.js';
import { markdownToPdf } from '../../src/services/pdf.service.js';
import { buildPrompt } from '../../src/orchestrators/prompt-builder.js';
import { LineBuffer, outputText, statusOf } from '../../src/integrations/headless-bob/events.js';

describe('report section parsing', () => {
  it('classifies headings and keeps fenced code intact', () => {
    const md = ['# Report', '## 1. Executive Summary', 'Hi', '## Quantum-Safe Assessment', '```', '## not a heading', '```', '## Recommendations', 'Do x', '## Conclusion', 'Done'].join('\n');
    const s = parseSections(md);
    expect(s.map((x) => x.key)).toEqual(['summary', 'findings', 'recommendations', 'conclusion']);
    expect(s[1].markdown).toContain('## not a heading');
  });

  it('keeps content before the first heading and never invents sections', () => {
    expect(parseSections('plain text only')).toEqual([{ key: 'other', title: 'Overview', markdown: 'plain text only' }]);
    expect(parseSections('')).toEqual([]);
  });

  it('classifies common titles', () => {
    expect(classifyHeading('3) Quantum-Safe Assessment')).toBe('findings');
    expect(classifyHeading('Execution Artifacts')).toBe('other');
    expect(classifyHeading('Prioritized next steps')).toBe('recommendations');
  });
});

describe('pdf export', () => {
  it('produces a PDF document', async () => {
    const pdf = await markdownToPdf('# Title\n\n- a\n- b\n\n```\ncode\n```\n\n| a | b |\n| - | - |\n| 1 | 2 |', 't');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('prompt builder', () => {
  const ctx = {
    executionId: 'e1',
    userPrompt: 'Scan it',
    repositoryUrl: 'https://github.com/a/b',
    branch: 'main',
    commit: 'abc',
    bobRepoPath: '/shared/workspaces/r/repo',
    bobQsePath: '/opt/qse-cli/cli.sh',
    qseVersion: '1.0',
    qseUsageHint: 'hint',
    supportsFiles: true
  };
  it('carries context, treats the repo as untrusted and forbids fabrication', () => {
    const p = buildPrompt(ctx);
    expect(p).toContain('/shared/workspaces/r/repo');
    expect(p).toContain('/opt/qse-cli/cli.sh');
    expect(p).toContain('untrusted DATA');
    expect(p).toContain('Do not invent findings');
    expect(p).toContain('qse-e2e-report.md');
    expect(buildPrompt({ ...ctx, supportsFiles: false })).not.toContain('qse-e2e-report.md');
  });
});

describe('Headless Bob event helpers', () => {
  it('extracts status and output', () => {
    expect(statusOf({ type: 'run.completed', run: { status: 'completed' } })).toBe('completed');
    expect(statusOf({ type: 'generic', generic: { status: 'cancelling' } })).toBe('cancelling');
    expect(statusOf({ type: 'message.part' })).toBeNull();
    expect(outputText({ output: [{ parts: [{ content: 'a' }, { content: 'b' }] }] })).toBe('a\nb');
  });
  it('buffers partial lines', () => {
    const out: string[] = [];
    const b = new LineBuffer((l) => out.push(l));
    b.push('hel');
    b.push('lo\nwor');
    b.push('ld');
    expect(out).toEqual(['hello']);
    b.flush();
    expect(out).toEqual(['hello', 'world']);
  });
});
