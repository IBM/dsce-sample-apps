/**
 * Pure helpers for the workspace artifact tabs: prompt -> artifact type inference and the
 * versioning rules ("every generation creates a new versioned tab").
 *
 * No React / network here so the logic stays trivially testable.
 */

import { WorkspaceArtifact, WorkspaceArtifactType } from '../types';

/** Id of the always-present Context tab (same value as `CONTEXT_TAB_ID` in WorkspaceScreen). */
export const CONTEXT_ARTIFACT_ID = 'context';

export const DEFAULT_ARTIFACT_TYPE: WorkspaceArtifactType = 'rfp_response';

/** Human readable tab labels; unknown types fall back to a title-cased type name. */
export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  rfp_response: 'RFP Response',
  presentation: 'Presentation',
};

/**
 * Structured payload stored in `WorkspaceArtifact.data` for `presentation` artifacts.
 * (`slideDeckData.tsx` slides hold React nodes and cannot be serialised, so the generated
 * deck uses this plain data shape; `WorkspaceArtifact.content` holds the same deck as a
 * markdown outline.)
 */
export interface PresentationSlideData {
  /** 1-based slide number. */
  id: number;
  title: string;
  subtitle?: string;
  bullets: string[];
  /** Speaker notes. */
  notes?: string;
}

export interface PresentationData {
  slides: PresentationSlideData[];
}

/** Narrowing helper for renderers (`artifact.data` is `unknown`). */
export function isPresentationData(data: unknown): data is PresentationData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as PresentationData).slides) &&
    (data as PresentationData).slides.every(
      s => s && typeof s.title === 'string' && Array.isArray(s.bullets)
    )
  );
}

// ─── Type inference ───────────────────────────────────────────────────────────

/** Ordered keyword map: the first matching entry wins. */
const TYPE_KEYWORDS: Array<{ type: WorkspaceArtifactType; patterns: RegExp[] }> = [
  { type: 'presentation', patterns: [/\bpresentations?\b/i, /\bslides?\b/i, /\bdecks?\b/i] },
  {
    type: 'rfp_response',
    patterns: [/\brfp response\b/i, /\bproposals?\b/i, /\brespond\b/i, /\bresponse\b/i, /\bdraft\b/i],
  },
];

/**
 * Infers which artifact type a prompt asks for. With no keyword match it falls back to the
 * type of the active artifact tab, then the most recently added artifact, then `rfp_response`.
 */
export function inferArtifactType(
  prompt: string,
  artifacts: WorkspaceArtifact[] = [],
  activeArtifactId?: string
): WorkspaceArtifactType {
  for (const { type, patterns } of TYPE_KEYWORDS) {
    if (patterns.some(p => p.test(prompt))) return type;
  }

  const generated = artifacts.filter(a => a.type !== 'context');
  const active = generated.find(a => a.id === activeArtifactId);
  if (active) return active.type;
  if (generated.length > 0) return generated[generated.length - 1].type;
  return DEFAULT_ARTIFACT_TYPE;
}

// ─── Versioning ───────────────────────────────────────────────────────────────

export function getArtifactLabel(type: WorkspaceArtifactType): string {
  return (
    ARTIFACT_TYPE_LABELS[type] ??
    type
      .split('_')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  );
}

/** Newest version of `type` (the one marked `isLatest`, else the highest version), if any. */
export function getLatestArtifact(
  artifacts: WorkspaceArtifact[],
  type: WorkspaceArtifactType
): WorkspaceArtifact | undefined {
  const versions = artifacts.filter(a => a.type === type);
  return versions.find(a => a.isLatest) ?? versions.sort((a, b) => b.version - a.version)[0];
}

export interface NewArtifactInput {
  type: WorkspaceArtifactType;
  content: string;
  data?: unknown;
  /** ISO timestamp; defaults to now. */
  lastUpdated?: string;
}

/**
 * Appends a new artifact version. A first artifact of a type becomes v1; otherwise the new
 * version is `max(existing) + 1`, every previous version of that type gets `isLatest: false`
 * and the new artifact is `isLatest: true`. Returns a new array; the input is not mutated.
 */
export function addArtifactVersion(
  artifacts: WorkspaceArtifact[],
  input: NewArtifactInput
): { artifacts: WorkspaceArtifact[]; artifact: WorkspaceArtifact } {
  const maxVersion = artifacts
    .filter(a => a.type === input.type)
    .reduce((max, a) => Math.max(max, a.version), 0);
  const version = maxVersion + 1;
  const artifact: WorkspaceArtifact = {
    id: `${input.type}-v${version}`,
    type: input.type,
    title: `${getArtifactLabel(input.type)} v${version}`,
    content: input.content,
    data: input.data,
    version,
    isLatest: true,
    lastUpdated: input.lastUpdated ?? new Date().toISOString(),
  };
  const updated = artifacts.map(a => (a.type === input.type ? { ...a, isLatest: false } : a));
  return { artifacts: [...updated, artifact], artifact };
}

// ─── Presentation helpers ─────────────────────────────────────────────────────

/** Markdown outline of a deck (used as `content` for presentation artifacts). */
export function slidesToMarkdown(slides: PresentationSlideData[]): string {
  return slides
    .map(s => {
      const lines = [`## Slide ${s.id}: ${s.title}`];
      if (s.subtitle) lines.push(`_${s.subtitle}_`);
      lines.push('', ...s.bullets.map(b => `- ${b}`));
      if (s.notes) lines.push('', `**Speaker notes:** ${s.notes}`);
      return lines.join('\n');
    })
    .join('\n\n');
}
