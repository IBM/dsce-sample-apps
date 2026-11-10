/**
 * Workspace Context extraction.
 *
 * Produces the content of the workspace Context tab (company background, RFP requirements,
 * gaps / unclear items) from the LIVE Box documents. The Source Documents section is simply
 * the live document list and needs no extraction.
 *
 * Strategy (live mode):
 *   1. Ask Headless Bob (LLM) via `/api/headless-bob/context` to extract the context from the
 *      focus documents (Incoming RFPs, Customers, root-level addenda).
 *   2. If Headless Bob is offline or returns something unusable, fall back to a deterministic
 *      text extraction from the same live documents (`deriveWorkspaceContext`).
 * In mock mode (no live Box) the context is built from the synthetic findings layer instead.
 */

import {
  BoxDocument,
  ContextItem,
  ContextSourceRef,
  Finding,
  WorkspaceContext,
} from '../types';
import { detectCustomerName } from './assetGenerator';

const MAX_ITEMS_PER_SECTION = 12;
const MAX_TEXT_LENGTH = 600;
const BOB_CONTEXT_TIMEOUT_MS = 340_000;

// ─── Document selection ───────────────────────────────────────────────────────

const pathSegments = (doc: BoxDocument): string[] =>
  doc.folderPath.split('/').map(s => s.trim()).filter(Boolean);

const isIncomingRfp = (doc: BoxDocument): boolean => pathSegments(doc).includes('Incoming RFPs');

const isRootLevelDoc = (doc: BoxDocument): boolean => {
  const segments = pathSegments(doc);
  return segments[segments.length - 1] === 'Box_Upload_Folder';
};

/**
 * The documents the Context tab is derived from: the incoming RFP, customer folders and
 * root-level files (e.g. the late addendum). Knowledge-base folders (product docs, pricing,
 * past responses, ...) ground the RFP *response*, not the context of the request.
 */
export function selectContextSourceDocuments(documents: BoxDocument[]): BoxDocument[] {
  return documents.filter(
    doc => isIncomingRfp(doc) || pathSegments(doc).includes('Customers') || isRootLevelDoc(doc)
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Re-joins PDF/DOCX hard line wraps (next line starts lowercase, or follows "vs.") so sentences stay whole. */
const unwrapLines = (text: string): string => text.replace(/\bvs\.[ \t]*\n[ \t]*/gi, 'vs. ').replace(/[ \t]*\n[ \t]*(?=[a-z])/g, ' ');

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim();

const refFor = (doc: BoxDocument): ContextSourceRef => ({ documentId: doc.id, documentName: doc.name });

function customerNameFor(documents: BoxDocument[]): string {
  const rfp = documents.find(isIncomingRfp);
  const fromFile = rfp?.name.split(' - ')[0]?.trim();
  return fromFile && fromFile !== rfp?.name ? fromFile : detectCustomerName(documents);
}

function makeItems(
  prefix: string,
  items: Array<Omit<ContextItem, 'id'>>
): ContextItem[] {
  return items.slice(0, MAX_ITEMS_PER_SECTION).map((item, i) => ({ ...item, id: `${prefix}-${i + 1}` }));
}

// ─── Deterministic extraction (live documents, Headless Bob unavailable) ──────

const RFP_FACT_LABELS = [
  'Issuing Organization',
  'Contact Officer',
  'Target Platform',
  'Required Repositories',
  'RFP Reference',
];

const GAP_PATTERN =
  /unresolved|unknown|unmetered|pending (?:final|operational|decision|confirmation)|tbd|to be (?:determined|confirmed)|not yet (?:decided|determined)|still unresolved|currently (?:reviewing|evaluating|undergoing)|undergoing|debating|evaluating (?:whether|if)|open (?:question|policy)/i;

/**
 * Extracts context with plain text patterns from the live document content. Deterministic,
 * works offline, but only understands the document shapes found in `Box_Upload_Folder`.
 */
export function deriveWorkspaceContext(documents: BoxDocument[]): WorkspaceContext {
  const sources = selectContextSourceDocuments(documents);
  const background: Array<Omit<ContextItem, 'id'>> = [];
  const requirements: Array<Omit<ContextItem, 'id'>> = [];
  const gaps: Array<Omit<ContextItem, 'id'>> = [];

  for (const doc of sources) {
    const text = doc.fullContent ?? '';

    if (isIncomingRfp(doc)) {
      for (const label of RFP_FACT_LABELS) {
        const m = text.match(new RegExp(`^\\s*${label}[:\\s]+(.+)$`, 'im'));
        if (m) background.push({ title: label, detail: clean(m[1]), sources: [refFor(doc)] });
      }
      const due = text.match(/Due Date:\s*([^|\n]+)/i);
      if (due) background.push({ title: 'Due Date', detail: clean(due[1]), sources: [refFor(doc)] });

      const objective = text.match(/Objective\s*&?\s*Context\s*\n+([\s\S]+?)(?:\n\s*\n|$)/i);
      if (objective) {
        background.push({
          title: 'Objective & Context',
          detail: truncate(clean(objective[1]), MAX_TEXT_LENGTH),
          sources: [refFor(doc)],
        });
      }

      for (const para of text.split(/\n\s*\n/)) {
        const m = clean(para).match(/^\d+\.\s*(Section\s*\d+):\s*([^:]+):\s*(.+)$/i);
        if (m) {
          requirements.push({
            title: `${m[1]}: ${clean(m[2])}`,
            detail: truncate(m[3], MAX_TEXT_LENGTH),
            sources: [refFor(doc)],
          });
        }
      }
    }

    if (isRootLevelDoc(doc) && /addendum/i.test(doc.name)) {
      for (const para of text.split(/\n\s*\n/)) {
        const m = para.trim().match(/^\d+\.\s*([^\n:]+):\s*\n?([\s\S]+)$/);
        if (m) {
          requirements.push({
            title: `Late addendum: ${clean(m[1])}`,
            detail: truncate(clean(m[2]), MAX_TEXT_LENGTH),
            sources: [refFor(doc)],
          });
        }
      }
      gaps.push({
        title: `Late addendum outside the RFP package: ${doc.name}`,
        detail:
          'Issued separately from the RFP and adds new mandatory requirements. Confirm with the customer that they are in scope for the response.',
        sources: [refFor(doc)],
      });
    }

    if (pathSegments(doc).includes('Customers')) {
      const summary = text.match(/EXECUTIVE SUMMARY:\s*\n?([\s\S]+?)(?:\n\s*\n|$)/i);
      if (summary) {
        background.push({
          title: 'Customer summary',
          detail: truncate(clean(summary[1]), MAX_TEXT_LENGTH),
          sources: [refFor(doc)],
        });
      }
    }

    const sentences = unwrapLines(text)
      .split(/(?<=[.!?])(?<!\bvs\.)\s+|\n+/)
      .map(s => clean(s).replace(/^(?:\d+[.)]|[-•*])\s*/, ''))
      .filter(s => s.length > 30 && s.length < 400);
    for (const sentence of sentences) {
      if (!GAP_PATTERN.test(sentence)) continue;
      const key = sentence.slice(0, 60).toLowerCase();
      if (gaps.some(g => g.title.slice(0, 60).toLowerCase() === key)) continue;
      gaps.push({ title: truncate(sentence, 140), detail: sentence.length > 140 ? sentence : undefined, sources: [refFor(doc)] });
    }
  }

  return {
    origin: 'derived',
    customerName: customerNameFor(sources),
    companyBackground: makeItems('ctx-bg', background),
    requirements: makeItems('ctx-req', requirements),
    openQuestions: makeItems('ctx-gap', gaps),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Mock mode (synthetic findings layer) ─────────────────────────────────────

/** Mock-mode fallback so the demo renders without live Box. Built from the synthetic findings. */
export function buildMockWorkspaceContext(documents: BoxDocument[], findings: Finding[]): WorkspaceContext {
  const toItems = (prefix: string, categories: Finding['category'][]): ContextItem[] =>
    makeItems(
      prefix,
      findings
        .filter(f => categories.includes(f.category))
        .map(f => ({
          title: f.title,
          detail: f.groundedSummary || f.statement,
          sources: f.supportingDocumentIds
            .map(id => documents.find(d => d.id === id))
            .filter((d): d is BoxDocument => Boolean(d))
            .map(refFor),
        }))
    );

  return {
    origin: 'mock',
    customerName: detectCustomerName(documents),
    companyBackground: toItems('ctx-bg', ['pain_points']),
    requirements: toItems('ctx-req', ['what_acme_wants_to_see', 'technical_requirements']),
    openQuestions: toItems('ctx-gap', ['open_questions']),
    generatedAt: new Date().toISOString(),
  };
}

// ─── Headless Bob extraction (live mode) ──────────────────────────────────────

function normalizeItems(raw: unknown, prefix: string, documents: BoxDocument[]): ContextItem[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map(documents.map(d => [d.id, d]));
  const items: Array<Omit<ContextItem, 'id'>> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.title !== 'string' || !e.title.trim()) continue;
    const ids = Array.isArray(e.sourceDocumentIds) ? e.sourceDocumentIds : [];
    items.push({
      title: truncate(clean(e.title), 200),
      detail: typeof e.detail === 'string' && e.detail.trim() ? truncate(clean(e.detail), MAX_TEXT_LENGTH) : undefined,
      sources: ids
        .map(id => (typeof id === 'string' ? byId.get(id) : undefined))
        .filter((d): d is BoxDocument => Boolean(d))
        .map(refFor),
    });
  }
  return makeItems(prefix, items);
}

async function extractWithBob(documents: BoxDocument[]): Promise<WorkspaceContext | null> {
  const focus = selectContextSourceDocuments(documents);
  if (focus.length === 0) return null;

  const res = await fetch('/api/headless-bob/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documents: focus.map(d => ({ id: d.id, name: d.name, folderPath: d.folderPath, fullContent: d.fullContent })),
    }),
    signal: AbortSignal.timeout(BOB_CONTEXT_TIMEOUT_MS),
  });
  if (!res.ok) return null;

  const data = await res.json();
  const r = data?.success ? data.result : null;
  if (!r || typeof r !== 'object') return null;

  const context: WorkspaceContext = {
    origin: 'bob',
    customerName:
      typeof r.customerName === 'string' && r.customerName.trim() ? clean(r.customerName) : customerNameFor(focus),
    companyBackground: normalizeItems(r.companyBackground, 'ctx-bg', documents),
    requirements: normalizeItems(r.requirements, 'ctx-req', documents),
    openQuestions: normalizeItems(r.openQuestions, 'ctx-gap', documents),
    generatedAt: new Date().toISOString(),
  };
  const total = context.companyBackground.length + context.requirements.length + context.openQuestions.length;
  return total > 0 ? context : null;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export interface ExtractWorkspaceContextOptions {
  /** `'mock'` uses the synthetic findings; `'live_mcp'` extracts from the live documents. */
  mode: 'mock' | 'live_mcp';
  /** Synthetic findings, used only in mock mode. */
  findings?: Finding[];
}

/**
 * Produces the Context tab content. Live mode: Headless Bob first, deterministic extraction
 * as fallback (never throws because Bob is offline). Mock mode: synthetic findings.
 */
export async function extractWorkspaceContext(
  documents: BoxDocument[],
  { mode, findings = [] }: ExtractWorkspaceContextOptions
): Promise<WorkspaceContext> {
  if (mode === 'mock') return buildMockWorkspaceContext(documents, findings);

  try {
    const viaBob = await extractWithBob(documents);
    if (viaBob) return viaBob;
  } catch (err) {
    console.warn('[Context] Headless Bob extraction unavailable, deriving locally:', err);
  }
  return deriveWorkspaceContext(documents);
}
