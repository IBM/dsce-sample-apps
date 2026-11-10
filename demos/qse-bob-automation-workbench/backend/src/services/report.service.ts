import crypto from 'node:crypto';
import type { ExecutionRecord, ExecutionRepository } from '../repositories/execution.repository.js';
import type { ArtifactView, ExecutionView, ReportSection, ReportSource, ReportView, SectionKey } from '../models/types.js';
import { DEMO_BANNER } from './demo.service.js';

const SECTION_RULES: Array<{ key: SectionKey; test: RegExp }> = [
  { key: 'summary', test: /executive summary|^summary|overview/i },
  { key: 'findings', test: /finding|assessment|quantum|crypto|repository analysis|vulnerab/i },
  { key: 'recommendations', test: /recommend|remediation|next steps|migration/i },
  { key: 'conclusion', test: /conclusion|takeaway/i }
];

export function classifyHeading(title: string): SectionKey {
  const t = title.replace(/^[\d.\s)-]+/, '').trim();
  // "Execution Artifacts"/"Execution Details" are rendered from backend data, not classified.
  if (/artifact|execution details/i.test(t)) return 'other';
  for (const rule of SECTION_RULES) if (rule.test.test(t)) return rule.key;
  return 'other';
}

/** Splits Headless Bob's markdown into sections. Fenced code is respected. */
export function parseSections(markdown: string): ReportSection[] {
  const lines = markdown.split(/\r?\n/);
  const counts = [0, 0, 0, 0];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence ? /^(#{1,3})\s+\S/.exec(line) : null;
    if (m) counts[m[1].length]++;
  }
  // A single "# Title" followed by "## Section" headings means sections are level 2.
  let level = counts[1] > 1 ? 1 : counts[2] > 0 ? 2 : counts[1] === 1 ? 1 : counts[3] > 0 ? 3 : 0;
  if (level === 0) level = 1;
  const headingRe = new RegExp(`^#{${level}}\\s+(.+?)\\s*#*\\s*$`);
  const sections: Array<{ title: string; body: string[]; synthetic: boolean }> = [];
  let current: (typeof sections)[number] | null = null;
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence ? headingRe.exec(line) : null;
    if (m) {
      current = { title: m[1].trim(), body: [], synthetic: false };
      sections.push(current);
    } else if (current) current.body.push(line);
    else if (!fence && /^#{1,6}\s/.test(line)) continue; // document title above the first section
    else if (line.trim()) {
      current = { title: 'Overview', body: [line], synthetic: true };
      sections.push(current);
    }
  }
  return sections
    .map((s) => ({ key: s.synthetic ? ('other' as SectionKey) : classifyHeading(s.title), title: s.title, markdown: s.body.join('\n').trim() }))
    .filter((s) => s.markdown || s.title);
}

export function toExecutionView(e: ExecutionRecord, repo: ExecutionRepository): ExecutionView {
  const start = e.startedAt ? Date.parse(e.startedAt) : null;
  const end = e.finishedAt ? Date.parse(e.finishedAt) : null;
  return {
    id: e.id,
    status: e.status,
    currentActivity: e.currentActivity,
    prompt: e.prompt,
    promptSummary: e.prompt.replace(/\s+/g, ' ').trim().slice(0, 140),
    repositoryId: e.repositoryId,
    repositoryUrl: e.repositoryUrl,
    repositoryName: e.repositoryName,
    branch: e.branch,
    commit: e.commit,
    qseVersion: e.qseVersion,
    adapter: e.adapter,
    mock: e.mock,
    bobRunId: e.bobRunId,
    bobThreadId: e.bobThreadId,
    createdAt: e.createdAt,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    durationMs: start !== null ? (end ?? Date.now()) - start : null,
    error: e.error,
    warnings: e.warnings,
    steps: repo.steps(e.id),
    reportId: e.reportId,
    usage: e.usage,
    bobStreamedChars: e.bobStreamedChars
  };
}

export interface BuildReportInput {
  execution: ExecutionRecord;
  bobMarkdown: string | null;
  source: ReportSource;
  sourceDetail: string;
  /** Demo only: explains where the recorded content came from. */
  notice?: string;
}

export class ReportService {
  constructor(private readonly repo: ExecutionRepository) {}

  /**
   * Stores the report. Content comes only from Headless Bob; the backend adds factual execution
   * details (from its own records) and never synthesises findings or recommendations.
   */
  create(input: BuildReportInput): ReportView {
    const e = input.execution;
    const bob = input.bobMarkdown?.trim() ? input.bobMarkdown : null;
    const sections = bob ? parseSections(bob) : [];
    const markdown = this.compose(e, bob, input.source, input.sourceDetail, input.notice);
    const rec = this.repo.saveReport({
      id: crypto.randomUUID(),
      executionId: e.id,
      source: input.source,
      sourceDetail: input.sourceDetail,
      mock: e.mock,
      bobMarkdown: bob,
      markdown,
      sections,
      generatedAt: new Date().toISOString()
    });
    this.repo.update(e.id, { reportId: rec.id });
    return this.view(rec.id)!;
  }

  view(id: string): ReportView | undefined {
    const r = this.repo.report(id);
    if (!r) return undefined;
    const e = this.repo.get(r.executionId)!;
    return {
      id: r.id,
      executionId: r.executionId,
      source: r.source,
      sourceDetail: r.sourceDetail,
      mock: r.mock,
      generatedAt: r.generatedAt,
      sections: r.sections,
      bobMarkdown: r.bobMarkdown,
      markdown: r.markdown,
      execution: toExecutionView(e, this.repo),
      artifacts: this.repo.artifacts(e.id)
    };
  }

  private compose(e: ExecutionRecord, bob: string | null, source: ReportSource, detail: string, notice?: string): string {
    const out: string[] = [];
    out.push(`# QSE End-to-End Execution Report`);
    if (e.mock) {
      out.push('', `> **${DEMO_BANNER}**`, '> This document was NOT produced by a Headless Bob execution started from this Workbench.');
      if (notice) out.push('>', ...notice.split('\n').map((l) => `> ${l}`.trimEnd()));
    }
    out.push('', '## Execution Details', '');
    const rows: Array<[string, string]> = [
      ['Execution ID', e.id],
      ['Status', e.status],
      ['Repository', e.repositoryUrl],
      ['Branch', e.branch],
      ['Commit', e.commit ?? 'unknown'],
      ['QSE CLI version', e.qseVersion ?? 'unknown'],
      ['Headless Bob adapter', e.adapter],
      ['Headless Bob run ID', e.bobRunId ?? 'n/a'],
      ['Started', e.startedAt ?? 'n/a'],
      ['Completed', e.finishedAt ?? 'n/a'],
      ['Report source', `${source} (${detail})`]
    ];
    out.push('| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`));
    out.push('', '## User Objective', '', e.prompt.trim().split('\n').map((l) => `> ${l}`).join('\n'));
    if (bob) out.push('', '---', '', '# Report from Headless Bob', '', bob.trim());
    else out.push('', '---', '', '## Report from Headless Bob', '', '_Headless Bob did not return report content for this execution._');
    const arts = this.repo.artifacts(e.id);
    out.push('', '---', '', '## Artifacts retrieved by the Workbench', '');
    if (!arts.length) out.push('_No files were retrieved from the Headless Bob workspace._');
    else out.push(...arts.map((a: ArtifactView) => `- \`${a.path}\` (${a.size} bytes${a.retrieved ? '' : ', not retrieved'}${a.note ? ` - ${a.note}` : ''})`));
    return out.join('\n');
  }
}
