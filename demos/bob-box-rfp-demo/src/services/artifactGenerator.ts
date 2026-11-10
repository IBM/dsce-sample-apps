/**
 * Workspace artifact generation (RFP response, presentation).
 *
 * Strategy (live mode):
 *   1. Ask Headless Bob via `/api/headless-bob/generate`, grounded in the live Box documents
 *      (incoming RFP, past responses, product / security / pricing docs ...) plus the extracted
 *      WorkspaceContext. Revisions pass the previous version's content and the user's instruction.
 *   2. If Headless Bob is offline or returns something unusable, fall back to a deterministic
 *      draft built from the WorkspaceContext and the same documents (`origin: 'derived'`).
 * Mock mode skips Bob and always uses the deterministic draft (`origin: 'mock'`).
 *
 * Nothing here throws because Bob is offline.
 */

import { BoxDocument, WorkspaceArtifactType, WorkspaceContext } from '../types';
import { deriveWorkspaceContext } from './contextExtractor';
import {
  PresentationData,
  PresentationSlideData,
  getArtifactLabel,
  isPresentationData,
  slidesToMarkdown,
} from './workspaceArtifacts';

const BOB_GENERATE_TIMEOUT_MS = 340_000;
const MAX_DOCS = 60;
/** Mirrors the server-side prompt windows; keeps the request body well under the route limit. */
const MAX_RFP_CHARS = 12_000;
const MAX_KB_CHARS = 4_000;
const MAX_PREVIOUS_CHARS = 60_000;

export type GeneratedArtifactOrigin = 'bob' | 'derived' | 'mock';

export interface GeneratedArtifact {
  /** Chat reply summarising what was generated or changed. */
  summary: string;
  /** Markdown body (RFP response text, or the slide outline for presentations). */
  content: string;
  /** `PresentationData` for presentations; undefined for other types. */
  data?: PresentationData;
  origin: GeneratedArtifactOrigin;
  /** Ids of the documents the artifact is grounded in (best effort). */
  supportingDocIds: string[];
}

export interface GenerateArtifactParams {
  type: WorkspaceArtifactType;
  prompt: string;
  documents: BoxDocument[];
  context?: WorkspaceContext | null;
  /** Content of the latest version of this type, when the prompt is a tweak. */
  previous?: { content: string; version: number; data?: unknown };
  mode: 'mock' | 'live_mcp';
}

// ─── Document selection ───────────────────────────────────────────────────────

const segments = (doc: BoxDocument): string[] =>
  doc.folderPath.split('/').map(s => s.trim()).filter(Boolean);

const isIncomingRfp = (doc: BoxDocument) => segments(doc).includes('Incoming RFPs');
const isGeneratedOutput = (doc: BoxDocument) => segments(doc).includes('Generated RFP Responses');
const isCustomerDoc = (doc: BoxDocument) => segments(doc).includes('Customers');
const isRootLevel = (doc: BoxDocument) => segments(doc)[segments(doc).length - 1] === 'Box_Upload_Folder';

/** Knowledge-base documents that ground the answers (everything except RFP/customer/addendum/outputs). */
const isKnowledgeDoc = (doc: BoxDocument) =>
  !isIncomingRfp(doc) && !isGeneratedOutput(doc) && !isCustomerDoc(doc) && !isRootLevel(doc);

/**
 * Documents used to ground generation: the incoming RFP, root-level addenda, customer files and
 * the knowledge base. Previously generated responses are excluded so drafts are not circular.
 */
export function selectGenerationDocuments(documents: BoxDocument[]): BoxDocument[] {
  const usable = documents.filter(d => !isGeneratedOutput(d));
  const ordered = [
    ...usable.filter(isIncomingRfp),
    ...usable.filter(isRootLevel),
    ...usable.filter(isCustomerDoc),
    ...usable.filter(isKnowledgeDoc),
  ];
  return ordered.slice(0, MAX_DOCS);
}

// ─── Deterministic fallback ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'will', 'must', 'shall', 'have', 'has', 'are', 'not',
  'all', 'any', 'its', 'their', 'into', 'than', 'such', 'each', 'per', 'out', 'was', 'were', 'who', 'what',
]);

const keywordsOf = (text: string): string[] =>
  Array.from(new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))));

const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

interface Evidence {
  docId: string;
  docName: string;
  sentence: string;
}

/** Best supporting sentence for a requirement from the knowledge-base documents. */
function findEvidence(query: string, knowledge: BoxDocument[]): Evidence | null {
  const words = keywordsOf(query);
  if (words.length === 0) return null;

  let best: (Evidence & { score: number }) | null = null;
  for (const doc of knowledge) {
    const sentences = (doc.fullContent || doc.summary || '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map(oneLine)
      .filter(s => s.length >= 40 && s.length <= 320);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hits = words.filter(w => lower.includes(w)).length;
      if (hits >= 2 && (!best || hits > best.score)) {
        best = { docId: doc.id, docName: doc.name, sentence, score: hits };
      }
    }
  }
  return best ? { docId: best.docId, docName: best.docName, sentence: best.sentence } : null;
}

const uniq = <T,>(items: T[]): T[] => Array.from(new Set(items));

function buildFallbackRfpResponse(
  params: GenerateArtifactParams,
  context: WorkspaceContext,
  origin: 'derived' | 'mock'
): GeneratedArtifact {
  const { documents, prompt, previous } = params;
  const customer = context.customerName || 'the Customer';
  const knowledge = documents.filter(isKnowledgeDoc);
  const rfpDoc = documents.find(isIncomingRfp);
  const supporting: string[] = [];

  const requirementRows = context.requirements.map((req, i) => {
    const evidence = findEvidence(`${req.title} ${req.detail ?? ''}`, knowledge);
    if (evidence) supporting.push(evidence.docId);
    return { req, evidence, index: i + 1 };
  });

  const lines: string[] = [
    `# ${customer} - RFP Response (First Draft)`,
    `**Prepared by:** IBM Bob${rfpDoc ? ` | **In response to:** ${rfpDoc.name}` : ''}`,
    `**Status:** Draft generated from ${origin === 'mock' ? 'sample' : 'Box'} content - review OPEN ITEMS before submission`,
    '',
    '## Section 1: Executive Summary',
    `IBM is pleased to respond to ${customer}'s request. This draft addresses each requirement identified in the RFP and its addenda using IBM's product, security, pricing and delivery documentation.`,
    '',
    ...context.companyBackground.slice(0, 4).map(b => `- **${b.title}**${b.detail ? `: ${b.detail}` : ''}`),
    '',
    '## Section 2: Requirements Response',
    ...(requirementRows.length > 0
      ? requirementRows.flatMap(({ req, evidence, index }) => [
          `### 2.${index} ${req.title}`,
          req.detail ? `_Requirement:_ ${req.detail}` : '',
          evidence
            ? `**IBM response:** ${evidence.sentence} [${evidence.docName}]`
            : '**OPEN ITEM:** No confirmed supporting statement found in the knowledge base; confirm the answer with the solution owner.',
          '',
        ])
      : ['No requirements were extracted from the RFP documents.', '']),
    '## Section 3: Open Items and Clarifications',
    ...(context.openQuestions.length > 0
      ? context.openQuestions.map(q => `- **OPEN ITEM - ${q.title}**${q.detail ? `: ${q.detail}` : ''}`)
      : ['- None identified.']),
  ];

  if (previous) {
    lines.push(
      '',
      `## Revision Notes (v${previous.version + 1})`,
      `Requested change: "${oneLine(prompt)}"`,
      'This offline draft is regenerated from the source documents; the requested wording change must be applied manually, or regenerate once Headless Bob is online.'
    );
  }

  const content = lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  const evidenceCount = requirementRows.filter(r => r.evidence).length;
  const summary = previous
    ? `I created a revised RFP response for ${customer} (offline draft; Headless Bob was unavailable, so the revision note records your request rather than rewriting the text).`
    : `I drafted an RFP response for ${customer} covering ${requirementRows.length} requirement${requirementRows.length === 1 ? '' : 's'}; ${evidenceCount} are backed by knowledge-base evidence and ${context.openQuestions.length} open item${context.openQuestions.length === 1 ? ' is' : 's are'} flagged for follow-up.`;

  return { summary, content, origin, supportingDocIds: uniq([...(rfpDoc ? [rfpDoc.id] : []), ...supporting]) };
}

function buildFallbackPresentation(
  params: GenerateArtifactParams,
  context: WorkspaceContext,
  origin: 'derived' | 'mock'
): GeneratedArtifact {
  const { documents, prompt, previous } = params;
  const customer = context.customerName || 'the Customer';
  const knowledge = documents.filter(isKnowledgeDoc);
  const supporting: string[] = [];

  const security = context.requirements
    .map(r => findEvidence(`${r.title} ${r.detail ?? ''}`, knowledge))
    .filter((e): e is Evidence => Boolean(e))
    .slice(0, 4);
  security.forEach(e => supporting.push(e.docId));

  const short = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

  const slides: Omit<PresentationSlideData, 'id'>[] = [
    {
      title: `IBM Bob for ${customer}`,
      subtitle: 'Evidence-grounded response to your RFP',
      bullets: [`Prepared from ${documents.length} documents in Box`, 'Every claim is traceable to a source file'],
      notes: 'Opening slide. Set the expectation that everything is grounded in the documents shared.',
    },
    {
      title: `Understanding ${customer}`,
      subtitle: 'What we heard',
      bullets: context.companyBackground.slice(0, 5).map(b => short(b.title + (b.detail ? `: ${b.detail}` : ''))),
      notes: 'Company background extracted from the RFP and customer files.',
    },
    {
      title: 'Key RFP requirements',
      subtitle: 'What the RFP asks of the bidder',
      bullets: context.requirements.slice(0, 6).map(r => short(r.title)),
      notes: 'Walk through the mandatory sections and any late addenda.',
    },
    {
      title: 'How IBM Bob meets them',
      subtitle: 'Backed by our documentation',
      bullets:
        security.length > 0
          ? security.map(e => short(`${e.sentence} [${e.docName}]`, 180))
          : ['Detailed responses are in the accompanying RFP response document'],
      notes: 'Each statement cites its source file.',
    },
    {
      title: 'Open items to confirm',
      subtitle: 'Unclear or conflicting requirements',
      bullets:
        context.openQuestions.length > 0
          ? context.openQuestions.slice(0, 6).map(q => short(q.title))
          : ['No open items identified'],
      notes: 'Agree owners and dates for each open item.',
    },
    {
      title: 'Next steps',
      subtitle: 'Moving to submission',
      bullets: ['Review the RFP response draft', 'Resolve open items with the customer', 'Confirm pricing and delivery timeline'],
      notes: 'Close with clear actions.',
    },
  ];

  if (previous) {
    slides.push({
      title: `Revision v${previous.version + 1}`,
      subtitle: 'Requested change',
      bullets: [short(oneLine(prompt), 200), 'Apply this change manually or regenerate once Headless Bob is online'],
      notes: 'Offline revision: the request is recorded rather than applied.',
    });
  }

  const numbered = slides.map((s, i) => ({ ...s, id: i + 1 }));
  const data: PresentationData = { slides: numbered };
  return {
    summary: `I created a ${numbered.length}-slide presentation for ${customer} built from the RFP context${previous ? ' (offline revision note added)' : ''}.`,
    content: slidesToMarkdown(numbered),
    data,
    origin,
    supportingDocIds: uniq(supporting),
  };
}

/** Deterministic draft built from the WorkspaceContext and documents (no network). */
export function buildFallbackArtifact(
  params: GenerateArtifactParams,
  origin: 'derived' | 'mock' = 'derived'
): GeneratedArtifact {
  const context = params.context ?? deriveWorkspaceContext(params.documents);
  return params.type === 'presentation'
    ? buildFallbackPresentation(params, context, origin)
    : buildFallbackRfpResponse(params, context, origin);
}

// ─── Headless Bob ─────────────────────────────────────────────────────────────

function normalizeSlides(raw: unknown): PresentationSlideData[] | null {
  if (!Array.isArray(raw)) return null;
  const slides: PresentationSlideData[] = [];
  for (const s of raw.slice(0, 20)) {
    if (!s || typeof s.title !== 'string' || !s.title.trim()) continue;
    slides.push({
      id: slides.length + 1,
      title: oneLine(s.title).slice(0, 120),
      subtitle: typeof s.subtitle === 'string' && s.subtitle.trim() ? oneLine(s.subtitle).slice(0, 200) : undefined,
      bullets: (Array.isArray(s.bullets) ? s.bullets : [])
        .filter((b: unknown): b is string => typeof b === 'string' && b.trim().length > 0)
        .slice(0, 8)
        .map((b: string) => oneLine(b).slice(0, 400)),
      notes: typeof s.notes === 'string' && s.notes.trim() ? s.notes.trim().slice(0, 1200) : undefined,
    });
  }
  return slides.length > 0 ? slides : null;
}

async function generateWithBob(params: GenerateArtifactParams): Promise<GeneratedArtifact | null> {
  const docs = selectGenerationDocuments(params.documents);
  if (docs.length === 0) return null;

  const previous = params.previous
    ? { content: params.previous.content.slice(0, MAX_PREVIOUS_CHARS), version: params.previous.version }
    : undefined;

  const res = await fetch('/api/headless-bob/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: params.type,
      prompt: params.prompt,
      documents: docs.map(d => ({
        id: d.id,
        name: d.name,
        folderPath: d.folderPath,
        fullContent: (d.fullContent || '').slice(0, isIncomingRfp(d) ? MAX_RFP_CHARS : MAX_KB_CHARS),
      })),
      context: params.context
        ? {
            customerName: params.context.customerName,
            companyBackground: params.context.companyBackground.map(i => ({ title: i.title, detail: i.detail })),
            requirements: params.context.requirements.map(i => ({ title: i.title, detail: i.detail })),
            openQuestions: params.context.openQuestions.map(i => ({ title: i.title, detail: i.detail })),
          }
        : undefined,
      previous,
    }),
    signal: AbortSignal.timeout(BOB_GENERATE_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const r = data?.success ? data.result : null;
  if (!r || typeof r !== 'object') return null;

  const supportingDocIds = docs.filter(d => isIncomingRfp(d)).map(d => d.id);
  const label = getArtifactLabel(params.type);
  const summaryOr = (fallback: string) =>
    typeof r.summary === 'string' && r.summary.trim() ? r.summary.trim() : fallback;

  if (params.type === 'presentation') {
    const slides = normalizeSlides(r.slides);
    if (!slides) return null;
    const deck: PresentationData = { slides };
    if (!isPresentationData(deck)) return null;
    return {
      summary: summaryOr(`I created a ${slides.length}-slide ${label.toLowerCase()} grounded in your Box documents.`),
      content: slidesToMarkdown(slides),
      data: deck,
      origin: 'bob',
      supportingDocIds,
    };
  }

  if (typeof r.content !== 'string' || !r.content.trim()) return null;
  return {
    summary: summaryOr(`I drafted the ${label} grounded in your Box documents.`),
    content: r.content.trim(),
    origin: 'bob',
    supportingDocIds,
  };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generates (or revises, when `previous` is set) an artifact. Live mode tries Headless Bob first
 * and falls back to a deterministic draft; mock mode always uses the deterministic draft.
 */
export async function generateArtifact(params: GenerateArtifactParams): Promise<GeneratedArtifact> {
  if (params.mode === 'mock') return buildFallbackArtifact(params, 'mock');

  try {
    const viaBob = await generateWithBob(params);
    if (viaBob) return viaBob;
  } catch (err) {
    console.warn('[Workspace] Headless Bob generation unavailable, using derived draft:', err);
  }
  return buildFallbackArtifact(params, 'derived');
}
