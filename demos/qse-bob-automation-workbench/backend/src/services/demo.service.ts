import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { BobCapabilities } from '../models/types.js';
import { isInside } from '../utils/paths.js';

/**
 * STREAM_MODE=mock serves a RECORDING of one real Headless Bob + QSE CLI execution. Every
 * finding, log line and file comes from that recording; the Workbench invents nothing. All
 * demo output is labelled so it cannot be mistaken for a live result.
 */
export const DEMO_LABEL = 'DEMO - recorded data';

export const DEMO_BANNER =
  'DEMO - RECORDED DATA: this is a replay of a real earlier Headless Bob + QSE CLI execution (STREAM_MODE=mock). Headless Bob, git and the QSE CLI were NOT contacted for this run.';

export const DEMO_ENDPOINT = 'demo://recorded-run';

const recordingSchema = z.object({
  schema: z.literal(1),
  description: z.string(),
  recordedFrom: z.object({
    executionId: z.string(),
    startedAt: z.string(),
    finishedAt: z.string(),
    durationMs: z.number(),
    headlessBobRunId: z.string(),
    headlessBobThreadId: z.string(),
    adapter: z.enum(['rest-threads', 'acp'])
  }),
  repository: z.object({
    url: z.string(),
    owner: z.string(),
    name: z.string(),
    branch: z.string(),
    commit: z.string(),
    fileCount: z.number().int()
  }),
  qse: z.object({ executablePath: z.string(), version: z.string(), versionArgs: z.array(z.string()) }),
  bobCapabilities: z.custom<BobCapabilities>((v) => typeof v === 'object' && v !== null),
  prompt: z.string(),
  reportFile: z.string(),
  bobEvents: z.array(z.object({ offsetMs: z.number().min(0), text: z.string() })).min(1),
  files: z
    .array(z.object({ path: z.string(), contentType: z.string(), file: z.string(), size: z.number().int() }))
    .min(1)
});

export type RecordedRun = z.infer<typeof recordingSchema>;

export class DemoService {
  readonly recording: RecordedRun;
  private readonly root: string;

  /** Fails fast when the recording is missing or inconsistent. */
  constructor(dataDir: string) {
    this.root = path.resolve(dataDir);
    const manifest = path.join(this.root, 'recorded-run.json');
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    } catch (e) {
      throw new Error(`STREAM_MODE=mock needs the recorded demo data, but ${manifest} could not be read: ${(e as Error).message}`);
    }
    const parsed = recordingSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Recorded demo data is invalid: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    this.recording = parsed.data;
    for (const f of this.recording.files) {
      const abs = this.resolve(f.file);
      if (!fs.existsSync(abs) || fs.statSync(abs).size !== f.size) throw new Error(`Recorded demo file is missing or changed: ${f.file}`);
    }
    if (!this.recording.files.some((f) => f.path === this.recording.reportFile)) throw new Error('Recorded demo data does not include its report file');
  }

  private resolve(rel: string): string {
    const abs = path.resolve(this.root, rel);
    if (!isInside(this.root, abs) || abs === this.root) throw new Error('Recorded demo file escapes the demo data directory');
    return abs;
  }

  /** Looks up by the recorded workspace path; callers never supply filesystem paths. */
  file(workspacePath: string): { data: Buffer; name: string; contentType: string } | null {
    const entry = this.recording.files.find((f) => f.path === workspacePath);
    if (!entry) return null;
    return { data: fs.readFileSync(this.resolve(entry.file)), name: entry.path.split('/').pop() ?? 'artifact', contentType: entry.contentType };
  }

  reportMarkdown(): string {
    return this.file(this.recording.reportFile)!.data.toString('utf8');
  }

  /** Shown above every demo report so the replay is never mistaken for a live analysis. */
  reportNote(): string {
    const r = this.recording.recordedFrom;
    return [
      `Recorded from a real execution (${r.startedAt} - ${r.finishedAt}, ${Math.round(r.durationMs / 1000)} s) of repository ${this.recording.repository.url}.`,
      'The prompt entered in the Workbench was NOT sent anywhere; the recorded result below answers the prompt that was used for the recording:',
      '',
      ...this.recording.prompt.split('\n').map((l) => `> ${l}`)
    ].join('\n');
  }
}
