import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../.env');
const bobEnvPath = path.resolve(__dirname, '../assets/headlessbob/.env');

const HEADLESS_BOB_DEFAULT_URL = 'http://127.0.0.1:8000';
const REQUEST_TIMEOUT_MS = 330_000; // Slightly above Headless Bob's RUN_TIMEOUT_MS (300s) so the backend limit applies first

function getEnvVar(key) {
  // Check root .env first, then assets/headlessbob/.env, then process.env
  for (const envFile of [rootEnvPath, bobEnvPath]) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [k, ...v] = trimmed.split('=');
          if (k.trim() === key) {
            return v.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  }
  return process.env[key] || '';
}

function getServiceToken() {
  const authTokensRaw = getEnvVar('AUTH_TOKENS');
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw);
      if (parsed.owner) return parsed.owner;
      const values = Object.values(parsed);
      if (values.length > 0 && typeof values[0] === 'string') return values[0];
    } catch {
      // not json, could be raw token
      return authTokensRaw;
    }
  }
  return getEnvVar('HEADLESSBOB_TOKEN') || '';
}

function getHeadlessBobUrl() {
  return getEnvVar('HEADLESSBOB_URL') || HEADLESS_BOB_DEFAULT_URL;
}

export async function checkHeadlessBobHealth() {
  const baseUrl = getHeadlessBobUrl();
  const token = getServiceToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${baseUrl}/ping`, {
      headers,
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      return { ok: true, url: baseUrl };
    }
    return { ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err?.message || 'Connection refused' };
  }
}

/**
 * Clean and extract JSON from Bob's LLM response text
 */
function extractJsonFromResponse(text) {
  if (!text || typeof text !== 'string') return null;

  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Look for ```json ... ``` blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch {}
  }

  // Look for outermost { ... }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

/**
 * Execute a run on Headless Bob via ACP /runs (sync mode)
 */
async function callHeadlessBobRun(prompt) {
  const baseUrl = getHeadlessBobUrl();
  const token = getServiceToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const payload = {
    agent_name: 'headlessbob',
    input: [
      {
        role: 'user',
        parts: [
          {
            content_type: 'text/plain',
            content: prompt
          }
        ]
      }
    ],
    mode: 'sync'
  };

  const res = await fetch(`${baseUrl}/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Headless Bob run failed (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const outputParts = data.output?.flatMap(m => m.parts?.map(p => p.content) || []) || [];
  const fullText = outputParts.join('\n');
  return fullText;
}

/**
 * Analyzes Box documents and the user prompt with Headless Bob LLM
 */
export async function analyzeBoxContextWithBob(userPrompt, documents) {
  // Format document summaries and content excerpts for the prompt
  const docSummaries = documents.map(d => ({
    id: d.id,
    name: d.name,
    folder: d.folderPath,
    type: d.type,
    summary: d.summary,
    contentPreview: (d.fullContent || '').slice(0, 1800)
  }));

  const systemPrompt = `You are IBM Bob, an AI solution engineer and demo architect.
You are given a user request and a collection of customer documents retrieved from Box via Box MCP.

Your job is to thoroughly analyze the user's goal against the available Box documents and generate a complete, evidence-grounded demo plan, executive brief, and tailored demo deliverables.

USER REQUEST:
"${userPrompt || 'Prepare a comprehensive, tailored executive demo for the customer based on their Box discovery materials.'}"

AVAILABLE BOX DOCUMENTS (${documents.length} files):
${JSON.stringify(docSummaries, null, 2)}

INSTRUCTIONS:
1. Examine each document to identify relevant customer requirements, pain points, compliance needs, architecture constraints, and demo expectations.
2. Produce a single valid JSON object with EXACTLY the following structure (no markdown fences, just pure JSON):

{
  "customerName": "Acme Bank",
  "relevantDocumentIds": ["doc-id-1", "doc-id-2"],
  "execBrief": {
    "customerName": "Acme Bank",
    "stakeholders": ["Sarah Chen (VP Architecture)", "David Miller (CISO)", "Elena Gomez (Lead Clinical Ops)"],
    "corePainPoints": [
      "Fragmented multi-region compliance management across AWS and on-prem",
      "Manual data pipeline handoffs causing 4-hour latency in HL7 ingestion"
    ],
    "demoFocus": "Demonstrate automated policy enforcement, sub-second FHIR stream processing, and multi-cloud governance.",
    "validatedMandates": [
      "HIPAA BAA compliance with AES-256 encryption at rest",
      "Strict data residency within US-East and EU-Central"
    ],
    "openQAItems": [
      "Confirm specific disaster recovery RTO requirements for high-availability nodes"
    ],
    "sourceCount": 5,
    "copyText": "Detailed executive briefing synthesis..."
  },
  "findings": [
    {
      "id": "finding-1",
      "category": "what_acme_wants_to_see",
      "title": "Real-time Multi-Region Data Ingestion",
      "statement": "Acme requires live streaming data ingestion with automated regional routing.",
      "groundedSummary": "Documented in discovery notes and architecture workshop summaries.",
      "strength": "strongly_supported",
      "strengthLabel": "Strongly Supported",
      "supportingSourceCount": 2,
      "supportingDocumentIds": ["doc-1", "doc-2"],
      "excerpts": [
        {
          "documentId": "doc-1",
          "documentName": "Acme Bank Discovery Notes.docx",
          "folderPath": "All Files / Customers / Acme Bank / Discovery Notes",
          "section": "Section 2.1: Key Requirements",
          "text": "Exact quote from document supporting this finding",
          "relevanceNote": "Confirms live streaming requirement"
        }
      ]
    }
  ],
  "demoPlan": {
    "steps": [
      {
        "stepNumber": 1,
        "title": "Hybrid Cloud Architecture & Ingestion",
        "actionToDemonstrate": "Show real-time ingest pipeline connecting Box enterprise repository and cloud brokers.",
        "presenterTalkingPoint": "Highlight how data sovereignty rules are automatically evaluated upon upload.",
        "whyItMattersToAcme": "Directly resolves the 4-hour latency bottleneck mentioned in the workshop.",
        "supportingDocumentIds": ["doc-1"],
        "suggestedTransition": "Now let us examine how compliance policies are enforced across these pipelines.",
        "durationMinutes": 6,
        "category": "Architecture"
      }
    ],
    "confirmationQuestions": [
      {
        "topic": "BAA Scope",
        "question": "Does Acme plan to extend BAA coverage to secondary staging environments?",
        "whyToAsk": "Ensures architectural sizing matches compliance boundaries.",
        "relatedDoc": "Acme Bank - Late Addendum BAA Compliance.pdf"
      }
    ],
    "totalDurationMinutes": 30,
    "customerName": "Acme Bank",
    "stakeholders": ["Sarah Chen", "David Miller"]
  },
  "demoAssets": {
    "customerName": "Acme Bank",
    "scriptContent": "Full presenter script with stage directions and time markers...",
    "talkingPoints": [
      {
        "topic": "Security & Encryption",
        "talkingPoint": "End-to-end TLS 1.3 in transit and envelope encryption with customer-managed keys.",
        "supportingSources": ["Security_Requirements.pdf"],
        "category": "Security"
      }
    ],
    "technicalValidationChecklist": [
      {
        "id": "val-1",
        "requirement": "SAML 2.0 / OIDC identity federation with Azure AD and Okta",
        "status": "documented",
        "sourceDocumentIds": ["doc-1"],
        "notes": "Verified in technical requirements spreadsheet row 14",
        "category": "Security"
      }
    ],
    "followUpQuestions": [
      {
        "category": "Architecture",
        "question": "What is the expected peak throughput during end-of-quarter batch processing?",
        "context": "Needed to size auto-scaling compute groups.",
        "relevantStakeholder": "Infrastructure Architect"
      }
    ]
  }
}

Categories for findings must be one of:
- "what_acme_wants_to_see"
- "pain_points"
- "technical_requirements"
- "open_questions"
- "recent_requests"
- "deprioritized"

Provide at least 4-6 detailed findings with real quotes/excerpts from the documents.
Output ONLY valid JSON.`;

  const rawBobOutput = await callHeadlessBobRun(systemPrompt);
  const parsed = extractJsonFromResponse(rawBobOutput);
  if (!parsed) {
    throw new Error('Failed to parse structured JSON from Headless Bob output: ' + rawBobOutput.slice(0, 300));
  }
  return parsed;
}

const SELECT_STOP_WORDS = new Set(['the','and','for','with','that','this','what','how','can','does','will','from','are','was','were','you','our','your','about','have','has','into','any','all','tell','know','box','explain']);

const folderOf = d => String(d.folderPath || d.category || '');
const folderSegments = d => folderOf(d).split('/').map(s => s.trim()).filter(Boolean);

/** 0 = the incoming RFP and root-level addenda, 1 = customer files, 2 = knowledge base, 3 = Bob's own earlier output. */
function documentTier(d) {
  const segments = folderSegments(d);
  if (segments.includes('Incoming RFPs') || segments[segments.length - 1] === 'IBM Enterprise Content') return 0;
  if (segments.includes('Customers')) return 1;
  if (segments.includes('Generated RFP Responses')) return 3;
  return 2;
}

function keywordScore(d, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = `${d.name} ${String(d.fullContent || '').slice(0, 2000)}`.toLowerCase();
  return keywords.filter(k => haystack.includes(k)).length / keywords.length;
}

/**
 * Chooses which documents go into a prompt. Instead of taking the first N in folder order, it
 * ranks by importance (RFP + addenda, then customer files, then knowledge base by keyword match
 * against `query`, then previously generated drafts) and fills a character budget. The budget
 * keeps the whole request under Headless Bob's request-body limit (64 KB by default).
 * Documents that do not fit are returned by name so the prompt can say they were not reviewed.
 */
export function selectDocumentsForPrompt(
  documents,
  query = '',
  { budgetChars = 40000, perDocChars = 4000, rfpChars = 12000 } = {}
) {
  const keywords = String(query)
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !SELECT_STOP_WORDS.has(w));

  const ranked = (documents || [])
    .map((d, index) => ({ d, index, tier: documentTier(d), score: keywordScore(d, keywords) }))
    .sort((a, b) => a.tier - b.tier || b.score - a.score || a.index - b.index);

  const included = [];
  const omitted = [];
  let used = 0;
  for (const { d, tier } of ranked) {
    const cap = tier === 0 && /Incoming RFPs/i.test(folderOf(d)) ? rfpChars : perDocChars;
    const remaining = budgetChars - used;
    if (remaining < 500) {
      omitted.push(d.name);
      continue;
    }
    const text = String(d.fullContent || d.contentPreview || '').slice(0, Math.min(cap, remaining));
    used += text.length;
    included.push({ id: d.id, name: d.name, folder: folderOf(d), summary: d.summary, content: text });
  }
  return { included, omitted, total: (documents || []).length };
}

const omittedNote = ({ omitted, total }) =>
  omitted.length === 0
    ? ''
    : `\nNOT INCLUDED (${omitted.length} of ${total} files did not fit; names only): ${omitted.join('; ')}.
Do not claim these files are missing or say there is no evidence in the workspace for them. If the answer may depend on them, say they were not reviewed.`;

/**
 * Ask Bob a question grounded in Box documents
 */
export async function askBobQuestionWithContext(question, documents, history = []) {
  const selection = selectDocumentsForPrompt(documents, question);
  const docSummaries = selection.included;

  const prompt = `You are IBM Bob, helping a solution architect prepare an evidence-grounded demo based on Box customer workspace files.

CUSTOMER DOCUMENTS (${docSummaries.length} of ${selection.total} files shown, most relevant first):
${JSON.stringify(docSummaries, null, 2)}${omittedNote(selection)}

USER QUESTION:
"${question}"

Provide a clear, accurate, and evidence-grounded answer based strictly on the customer's Box files above.
Mention the specific file names and sections that support your answer.
If the customer files do not contain sufficient evidence to answer, state clearly that it is unconfirmed or requires follow-up with the customer.

ANSWER FORMAT (the "answer" value is rendered in a narrow chat panel):
- Start with a 1-2 sentence direct answer. No preamble, no restating the question.
- Then 3 to 6 short bullets or a short numbered list, one idea each. Bold only key terms or figures.
- Use at most one "###" heading, and only if it genuinely helps. Do not use emojis, horizontal rules ("---"), or tables.
- Cite sources inline as the plain file name in backticks, e.g. \`Acme Bank Discovery Notes.docx\`, rather than a separate "Source:" line per item.
- Keep the whole answer under about 180 words. If something is unconfirmed, end with one "Unconfirmed:" line.
- Use real line breaks between paragraphs and list items.

Respond in JSON with this structure:
{
  "answer": "Your detailed answer in markdown format...",
  "grounded": true,
  "insufficientEvidence": false,
  "supportingDocumentIds": ["doc-id-1", "doc-id-2"]
}`;

  const rawBobOutput = await callHeadlessBobRun(prompt);
  const parsed = extractJsonFromResponse(rawBobOutput);
  if (parsed && parsed.answer) {
    return parsed;
  }
  return {
    answer: rawBobOutput,
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: []
  };
}

/**
 * Extracts the workspace Context tab content (company background, RFP requirements,
 * gaps / unclear items) from live Box documents.
 * `documents`: [{ id, name, folderPath, fullContent }]
 */
export async function extractWorkspaceContextWithBob(documents) {
  const docs = documents.map(d => ({
    id: d.id,
    name: d.name,
    folder: d.folderPath,
    content: String(d.fullContent || '').slice(0, 6000)
  }));

  const prompt = `You are IBM Bob, helping a solutions team respond to an incoming RFP.
Below are documents retrieved live from Box: the incoming RFP, the customer's folder, and any late addenda.

DOCUMENTS (${docs.length} files):
${JSON.stringify(docs, null, 2)}

Read the documents and produce a single valid JSON object (no markdown fences) with EXACTLY this structure:

{
  "customerName": "Name of the organization issuing the RFP",
  "companyBackground": [
    { "title": "Short fact headline", "detail": "One or two sentences about who the customer is, their situation, systems, stakeholders or timeline", "sourceDocumentIds": ["doc-id"] }
  ],
  "requirements": [
    { "title": "Requirement headline", "detail": "What the RFP or addendum requires of the bidder", "sourceDocumentIds": ["doc-id"] }
  ],
  "openQuestions": [
    { "title": "Gap or unclear item", "detail": "Why it is unclear, conflicting, undecided or outside the RFP package, and what to confirm with the customer", "sourceDocumentIds": ["doc-id"] }
  ]
}

RULES:
- Ground every item strictly in the documents above. Do not invent facts.
- "sourceDocumentIds" must only contain ids from the documents above.
- Prioritise the incoming RFP document. Include every mandatory questionnaire section and every requirement from late addenda in "requirements".
- "openQuestions" must include unresolved decisions, undecided values, conflicts, and requirements that appear outside the main RFP (e.g. late addenda).
- 3 to 8 items per list. Keep each title under 100 characters and each detail under 300 characters.
Output ONLY valid JSON.`;

  const raw = await callHeadlessBobRun(prompt);
  const parsed = extractJsonFromResponse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Could not parse structured context from Headless Bob output');
  }
  return parsed;
}

const RFP_SHAPE_REFERENCE_PATH = path.resolve(
  __dirname,
  '../IBM Enterprise Content/Generated RFP Responses/Acme Bank - First-Draft RFP Response (IBM Bob).txt'
);

function readRfpShapeReference() {
  try {
    return fs.readFileSync(RFP_SHAPE_REFERENCE_PATH, 'utf8').slice(0, 7000);
  } catch {
    return '';
  }
}

const formatContextItems = items =>
  (Array.isArray(items) ? items : [])
    .slice(0, 12)
    .map(i => `- ${String(i.title || '').slice(0, 200)}${i.detail ? `: ${String(i.detail).slice(0, 400)}` : ''}`)
    .join('\n');

/**
 * Generates (or revises) a workspace artifact grounded in live Box documents.
 * `input`: { type: 'rfp_response' | 'presentation', prompt, documents: [{ id, name, folderPath, fullContent }],
 *            context?: { customerName, companyBackground, requirements, openQuestions },
 *            previous?: { content, version } }
 * Returns { summary, content, slides? } (slides only for presentations).
 */
// Matches IBM_Response_Acme_Bank_RFP-2026-DOCAI-04.pdf and re-uploads such as "... (1).pdf"; the highest copy number wins.
const REFERENCE_RESPONSE_PATTERN = /^IBM_Response_Acme_Bank_RFP-2026-DOCAI-04(?: \((\d+)\))?\.pdf$/i;
const REFERENCE_RESPONSE_CHARS = 16000;
// The deck quotes the case study and pricing figures, which sit at the end of the reference, so it gets the same budget.
const REFERENCE_DECK_CHARS = REFERENCE_RESPONSE_CHARS;
const copyNumber = d => Number((REFERENCE_RESPONSE_PATTERN.exec(d.name || '') || [])[1] || 0);

export async function generateWorkspaceArtifactWithBob(input) {
  const { type, prompt: userPrompt, documents = input.boxDocs || [], context, previous } = input;

  // The RFP response prompt pulls out the reference response in Box so it is always included in full
  // (up to REFERENCE_RESPONSE_CHARS) instead of competing for the general document budget.
  const isResponse = type === 'response' || type === 'studio_response';
  const isDeck = type === 'presentation' || type === 'deck';
  // Revisions skip it: the previous version already carries the format, and the request body has a size limit.
  const referenceDoc = (isResponse || isDeck) && !previous
    ? documents.filter(d => REFERENCE_RESPONSE_PATTERN.test(d.name || '')).sort((a, b) => copyNumber(b) - copyNumber(a))[0]
    : undefined;
  const sourceDocs = documents.filter(d => !REFERENCE_RESPONSE_PATTERN.test(d.name || ''));
  const referenceBlock = referenceDoc
    ? `REFERENCE RESPONSE (${referenceDoc.name}, from Box):
${String(referenceDoc.fullContent || referenceDoc.contentPreview || '').slice(0, isDeck ? REFERENCE_DECK_CHARS : REFERENCE_RESPONSE_CHARS)}
--- END REFERENCE RESPONSE ---`
    : '';

  // Revisions need more room for the previous doc; reduce doc budget accordingly.
  // First-draft gets the full 26k; revisions get 8k for docs so the 32k previous content fits.
  const selection = selectDocumentsForPrompt(sourceDocs, userPrompt, { budgetChars: previous ? 8000 : 26000 });
  const docs = selection.included.map(({ id, name, folder, content }) => ({ id, name, folder, content }));

  const contextBlock = context
    ? `EXTRACTED CONTEXT (customer: ${String(context.customerName || 'unknown').slice(0, 120)}):
Company background:
${formatContextItems(context.companyBackground)}
RFP requirements:
${formatContextItems(context.requirements)}
Gaps / unclear items:
${formatContextItems(context.openQuestions)}`
    : '';

  const revisionBlock = previous
    ? `This is a REVISION. Apply the user's instruction to the previous version below and return the complete updated artifact (not a diff). Keep everything the instruction does not touch, including the figures, section order, tables and exhibits.
- The user's instruction overrides the DOCUMENT FORMAT and WRITING RULES where they conflict (for example, an added paragraph is allowed even if the format lists a fixed paragraph count).
- If the user pastes proposed wording, insert it into the section they name rather than replying with it. Rewrite it to fit the document: plain prose, no markdown, no file names in brackets (use lettered exhibits), no real company names, figures matching the rest of the document.
- Text fields hold plain paragraphs separated by blank lines (executiveSummary, section body). To add a paragraph, append it to that field.
- "summary" is one or two sentences saying what you changed and where.
PREVIOUS VERSION (v${Number(previous.version) || 1}):
${String(previous.content || '').slice(0, 32000)}`
    : 'This is the first version of this artifact.';

  // Mock-mode rules for the demo RFP response: no citations or OPEN ITEMs (replaces groundingRules there).
  const mockRules = `RULES:
- Treat the DOCUMENTS and the REFERENCE RESPONSE as the source of truth for Acme Bank's requirements, IBM's capabilities and the figures already stated. Invent only what they leave out, and keep it realistic and consistent.
- Do not cite file names in brackets. Reference evidence only as lettered exhibits.
- Never write "OPEN ITEM". Resolve every gap with a confident, plausible answer.
- Address every mandatory RFP section and the late addendum requirements.`;

  const groundingRules = `RULES:
- Ground every claim strictly in the DOCUMENTS above (incoming RFP, past RFP responses, product, security, pricing, legal, case studies). Never invent certifications, prices, metrics or commitments.
- Cite the source file name in brackets after claims, e.g. [Security Whitepaper.pdf].
- Where the documents do not give a confirmed answer (or the RFP and addenda conflict), write "OPEN ITEM:" with what must be confirmed rather than guessing.
- Address the mandatory RFP sections and the late addendum requirements.`;

  let prompt;
  if (type === 'presentation' || type === 'deck') {
    prompt = `You are IBM Bob, helping a solutions team respond to an incoming RFP.

USER REQUEST:
"${userPrompt}"

${contextBlock}

${referenceBlock}

DOCUMENTS (${docs.length} of ${selection.total} files retrieved live from Box, most relevant first):
${JSON.stringify(docs, null, 2)}${omittedNote(selection)}

${revisionBlock}

Create the finalist presentation Acme Bank's committee will watch live. It is a talk track, NOT a copy of the written response: do not walk through its sections, restate its paragraphs or reuse its table rows. Pick the few facts that make the case and say them briefly.

SLIDES (exactly 7, in this order; if the user asks for a different number, keep this order and drop the least essential slides):
1. Title (the cover, see below).
2. What We Heard: Acme Bank's problems in their own terms, with their numbers.
3. How Bob Works: the architecture in plain terms (Box connection, models, permissions inherited, every answer traced to its source).
4. A Loan Package Start to Finish: the path of one commercial loan package through Bob, step by step (arrives in Box, classified, key terms extracted, checked against policy, synced to Salesforce, reviewed by a person). The last bullet hands over to the live demo.
5. Security at a Glance: the controls an InfoSec reviewer cares about most (certifications, encryption, no training on customer data, access inherited from Box).
6. Proven at a Top-10 Bank: the unnamed top-10 U.S. commercial bank's before and after results.
7. Plan and Investment: the 8-week plan, the Year 1 cost and the savings it unlocks.

SLIDE RULES
- "title" is a one-line takeaway a listener could repeat (a claim or result, under 70 characters), never a label like "Security" or "Architecture". The one exception is the cover.
- "subtitle" is empty or one short line. Leave it out on every slide except the cover.
- 3 to 4 bullets per slide, each under 12 words, no full sentences with two clauses. Lead with the number or the noun.
- Never show file names, exhibit letters, section numbers or bracketed citations on slides or in speaker notes. Never name a real company.
- Take every figure from the REFERENCE RESPONSE and copy it exactly (for example the intake time reduction, the before and after turnaround days, the annual savings and the Year 1 cost). Do not round, recompute or invent figures. If the reference does not state a figure, leave it out.
- "speakerNotes": 3 to 5 sentences, written as what the presenter says aloud, in first person plural ("we"). Add the reasoning, an example or a transition to the next slide. Do not repeat the bullets.

COVER (slide 1, counts toward the 7). It must read as the cover of a vendor's RFP response presentation, not a product pitch:
- "title": "RFP Response to Acme Bank" (exactly this wording, as on the reference cover). Do not put the solicitation number (RFP-2026-DOCAI-04) anywhere on this slide.
- "subtitle": the solicitation title, e.g. "AI-Powered Document Intelligence and Automated Proposal Platform".
- "bullets": exactly 4 short lines, each "Label: value": "Prepared for: <client, division>", "Submitted by: IBM Corporation", "Proposal: <IBM proposal number>, <date>", "Presenter: <name, title>".
- Take the proposal number, date, presenter and client division from the REFERENCE RESPONSE cover page so the deck matches the written response. No tagline, no benefit claims, no metrics.
- "speakerNotes": three sentences: thank the evaluation committee, say what the next 20 minutes cover, and say that the session ends with a live demo.
- Do not repeat these cover details on the other slides.

SOURCES
- The REFERENCE RESPONSE is the source of truth for every figure, name and date. Use the DOCUMENTS only for Acme Bank's requirements and IBM's capabilities it does not cover.
- Never write "OPEN ITEM". Never cite a source on a slide.

Output a single valid JSON object (no markdown fences) with EXACTLY this structure:
{
  "summary": "2-3 sentence chat reply describing what you created or changed",
  "slides": [
    { "title": "One-line takeaway", "subtitle": "", "bullets": ["3 to 4 short bullets"], "speakerNotes": "3 to 5 sentences the presenter says aloud" }
  ]
}
Output ONLY valid JSON.`;
  } else if (type === 'email') {
    prompt = `You are IBM Bob, drafting an executive cover email to accompany an RFP proposal submission.

USER REQUEST:
"${userPrompt}"

${contextBlock}

DOCUMENTS (${docs.length} of ${selection.total} files retrieved live from Box, most relevant first):
${JSON.stringify(docs, null, 2)}${omittedNote(selection)}

${revisionBlock}

Draft a polished, professional cover email addressed to the customer evaluation team.
Output a single valid JSON object with EXACTLY this structure:
{
  "summary": "1-2 sentence summary of the email draft",
  "email": "Subject: ...\\n\\nDear ...\\n\\n..."
}
Output ONLY valid JSON.`;
  } else if (type === 'response' || type === 'studio_response') {
    prompt = `You are a senior IBM proposal writer. Draft IBM's response to Acme Bank RFP-2026-DOCAI-04. This is a mock response for a demo: all source files are fictional, so the goal is a response that reads like a real, polished enterprise RFP submission. The reader is Acme Bank's evaluation committee, who will score it against Section 7.0.

USER REQUEST:
"${userPrompt}"

${contextBlock}

${referenceBlock}

DOCUMENTS (${docs.length} of ${selection.total} files retrieved live from Box, most relevant first):
${JSON.stringify(docs, null, 2)}${omittedNote(selection)}

${revisionBlock}

SOURCES
${referenceDoc ? `- The REFERENCE RESPONSE above (${referenceDoc.name}) is the model answer. Copy its document format one to one: the same pages, the same section order, the same headings, the same subsection pattern, the same table columns, the same level of detail. Reuse its figures (latency, timeline, pricing, case study metrics, compliance statuses, contact, proposal number, dates) so the numbers stay identical. Fix wording where it is weak; do not change its structure.\n` : ''}- Use the other files for Acme's requirements and IBM's capabilities. Where they are missing a detail, invent a plausible, realistic value and keep it consistent everywhere it appears.
- If files conflict or reference a different company or RFP number, go with what fits Acme Bank and RFP-2026-DOCAI-04 and ignore the rest.

DOCUMENT FORMAT (this is the layout of the reference; reproduce it)
1. Cover page: vendor, "RFP Response to Acme Bank", the title, Prepared for, In response to, IBM proposal number, Date, IBM contact (name, title, email, phone), confidentiality notice. The document "title" is exactly "RFP Response to Acme Bank: AI Powered Content Intelligence with IBM Bob and Box" (do not reword or shorten it).
2. Cover letter (one page): date, addressee block, "Re:" line, salutation, 3 short paragraphs, signature.
3. "1. Executive Summary": 4 paragraphs. (a) Acme's problems with their numbers. (b) How Bob solves each one. (c) Data handling and hosting. (d) A short pointer to the case study.
4. "2. Technical Approach and Box Integration": one intro paragraph, then one subsection per RFP requirement in Sections 3.0 and 4.0, in RFP order, numbered with the RFP's own numbers (e.g. 3.1, 3.2, 4.2). Each subsection has a one-line "requirement" (Acme's ask) and one short paragraph of answer. Cover Box integration, document classification, search (with median and 95th-percentile latency), RFP drafting, Salesforce, identity and access, API, and model governance (model name, hosting, change notice, accuracy measurement).
5. "3. Security and Compliance": one short intro paragraph, then ONE table with columns Requirement | IBM response | Status | Evidence. One row per Section 5.0 requirement. Status is "Compliant" or "Partial". Evidence is "Exhibit B" etc., never a file name.
6. "4. Financial Services Case Study": two or three short paragraphs about an unnamed top-10 U.S. commercial bank with its OWN baselines (different from Acme's), then a table Measure | Before | After, then one paragraph with a second, shorter reference.
7. "5. Implementation Plan and Pricing": one intro paragraph, then three tables: a schedule (Weeks | Activities | Sign-off criteria, 4 rows covering weeks 1-8), a RACI (Activity | IBM | Bank sponsor | Bank InfoSec | Lending Ops | Procurement, with R/A/C/I letters, plus a caption explaining the letters), and Pricing (RFP 6.0 Item | Price (USD), one row per item (a)-(d)). End with "notes": a first line stating the Year 1 cost, then one line per pricing assumption.
8. "6. Exceptions": one paragraph. One narrow exception only (audit-log retention three to seven years, no charge).
9. Exhibits list, A through I.

WRITING RULES
- Confident, plain language, the way a real vendor writes. No hedging, no placeholders, no notes about what was or was not reviewed.
- Each point once. No bullets, no key metric callouts: leave "bullets" as [] and "keyMetric" as null.
- Reference evidence only as lettered exhibits. Never name a file.
- Do not name real companies as clients. Describe case studies generically.
- Exactly one Security table row is "Partial" (audit logs retained seven years), resolved in Section 6. Every other row is "Compliant".
- Numbers must be identical wherever they appear: latency, timeline, user counts, pricing, Year 1 total, case study metrics. Check that the pricing rows add up to the Year 1 total.
- Table cells are short phrases or one sentence. Every row has exactly one string per column.

${mockRules}

Output a single valid JSON object with EXACTLY this structure. Values below are descriptions, not content: write your own. "complianceMatrix" and "slides" are always [].
{
  "summary": "1-2 sentences describing what you created. No OPEN ITEMs.",
  "doc": {
    "title": "RFP Response to Acme Bank: AI Powered Content Intelligence with IBM Bob and Box",
    "rfpReference": "RFP-2026-DOCAI-04",
    "clientName": "${String(context?.customerName || 'Acme Bank, N.A.')}",
    "submittedBy": "IBM Corporation",
    "submittedTo": "Division name at Acme Bank, N.A.",
    "proposalNumber": "IBM proposal number",
    "date": "Proposal date, e.g. December 4, 2026",
    "contact": { "name": "IBM contact name", "title": "IBM contact title", "email": "email", "phone": "phone" },
    "confidentialityNotice": "Two or three sentences: confidential and proprietary to IBM, provided solely to evaluate this response, sample prepared for demonstration purposes.",
    "coverLetter": {
      "addressee": ["Ms. Eleanor Vance", "Vice President, Strategic Sourcing & Technology Procurement", "Acme Bank, N.A.", "New York, NY"],
      "subject": "RFP-2026-DOCAI-04, AI-Powered Document Intelligence and Automated Proposal Platform",
      "salutation": "Dear Ms. Vance,",
      "paragraphs": ["What IBM proposes, for how many users, how fast.", "How Bob works with Box, in one short paragraph.", "How the response is organized, that all mandatory requirements are met, the one contract change, and how long pricing is valid."]
    },
    "executiveSummary": "Four paragraphs separated by blank lines, as described in DOCUMENT FORMAT item 3.",
    "sections": [
      {
        "heading": "Technical Approach and Box Integration",
        "body": "One intro paragraph: hosting, regions, connectors, and a pointer to Exhibit A.",
        "subsections": [
          { "number": "RFP section number, e.g. 3.1", "title": "Short topic, e.g. Box integration", "requirement": "Acme's ask in one line.", "body": "One short paragraph answering it." }
        ],
        "tables": [], "notes": [], "bullets": [], "keyMetric": null
      },
      {
        "heading": "Security and Compliance",
        "body": "One short intro paragraph that points to Section 6 for the one partial item.",
        "subsections": [],
        "tables": [ { "columns": ["Requirement", "IBM response", "Status", "Evidence"], "rows": [["Requirement text", "One sentence answer.", "Compliant | Partial", "Exhibit letter or Section 6"]] } ],
        "notes": [], "bullets": [], "keyMetric": null
      },
      {
        "heading": "Financial Services Case Study",
        "body": "Paragraphs separated by blank lines: the client and its starting point, what IBM deployed, then the second reference.",
        "subsections": [],
        "tables": [ { "columns": ["Measure", "Before", "After"], "rows": [["Metric name", "Baseline", "Result"]] } ],
        "notes": [], "bullets": [], "keyMetric": null
      },
      {
        "heading": "Implementation Plan and Pricing",
        "body": "One intro paragraph: deployment window and sign-off per phase.",
        "subsections": [],
        "tables": [
          { "columns": ["Weeks", "Activities", "Sign-off criteria"], "rows": [["1-2", "Activities", "Criteria"]] },
          { "caption": "Roles (R = responsible, A = accountable, C = consulted, I = informed)", "columns": ["Activity", "IBM", "Bank sponsor", "Bank InfoSec", "Lending Ops", "Procurement"], "rows": [["Activity", "R", "A", "C", "I", "I"]] },
          { "caption": "Pricing", "columns": ["RFP 6.0 Item", "Price (USD)"], "rows": [["(a) Implementation services, fixed fee", "Amount"]] }
        ],
        "notes": ["Year 1 cost on a one-year term is $X. Pricing assumptions:", "One line per assumption."],
        "bullets": [], "keyMetric": null
      },
      {
        "heading": "Exceptions",
        "body": "IBM takes no exception to the RFP requirements. One paragraph describing the single contract change.",
        "subsections": [], "tables": [], "notes": [], "bullets": [], "keyMetric": null
      }
    ],
    "exhibits": ["A. Architecture and authentication sequence", "B. Security whitepaper", "C. SOC 2 Type II report (under NDA)", "D. ISO/IEC 27001:2022 certificate", "E. Sub-processor list", "F. SIG Core questionnaire", "G. Service level agreement", "H. Model risk documentation", "I. Client references"],
    "complianceMatrix": [],
    "slides": []
  }
}
Include a Security table row for every requirement in RFP Section 5.0, and a Technical Approach subsection for every requirement in RFP Sections 3.0 and 4.0. Output ONLY valid JSON.`;
  } else {
    const shape = readRfpShapeReference();
    prompt = `You are IBM Bob, helping a solutions team draft a formal response to an incoming RFP.

USER REQUEST:
"${userPrompt}"

${contextBlock}

DOCUMENTS (${docs.length} of ${selection.total} files retrieved live from Box, most relevant first):
${JSON.stringify(docs, null, 2)}${omittedNote(selection)}

${revisionBlock}

Write the RFP response as markdown. Follow the SHAPE of this earlier first-draft (title block, then numbered sections such as Executive Summary, Technical Architecture, Security/Privacy/Compliance answers as a table, Relevant Case Study, Implementation Plan & Pricing). Use it for structure only, not as a source of facts:
--- SHAPE REFERENCE ---
${shape || 'SECTION 1: EXECUTIVE SUMMARY; SECTION 2: TECHNICAL ARCHITECTURE; SECTION 3: SECURITY, PRIVACY & COMPLIANCE; SECTION 4: CASE STUDY; SECTION 5: IMPLEMENTATION PLAN & PRICING'}
--- END SHAPE REFERENCE ---

${groundingRules}

Output a single valid JSON object (no markdown fences) with EXACTLY this structure:
{
  "summary": "2-3 sentence chat reply describing what you created or changed, referencing the key source documents and any OPEN ITEMs",
  "content": "The complete RFP response in markdown (use \\n for newlines)"
}
Output ONLY valid JSON.`;
  }

  const raw = await callHeadlessBobRun(prompt);
  const parsed = extractJsonFromResponse(raw);

  if (type === 'presentation' || type === 'deck') {
    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error('Could not parse presentation from Headless Bob output');
    }
    const normalizedSlides = parsed.slides.map(s => ({
      title: s.title || 'Slide',
      subtitle: s.subtitle,
      bullets: Array.isArray(s.bullets) ? s.bullets : [],
      speakerNotes: s.speakerNotes || s.notes || ''
    }));
    return { summary: String(parsed.summary || ''), slides: normalizedSlides };
  }

  if (type === 'email') {
    if (parsed && typeof parsed.email === 'string') {
      return { summary: String(parsed.summary || ''), email: parsed.email };
    }
  }

  if (type === 'response' || type === 'studio_response') {
    if (parsed && parsed.doc && typeof parsed.doc === 'object') {
      parsed.doc.title = 'RFP Response to Acme Bank: AI Powered Content Intelligence with IBM Bob and Box';
      return { summary: String(parsed.summary || ''), doc: parsed.doc };
    }
  }

  if (parsed && typeof parsed.content === 'string' && parsed.content.trim()) {
    return { summary: String(parsed.summary || ''), content: parsed.content };
  }
  if (typeof raw === 'string' && raw.trim().length > 200 && !raw.trim().startsWith('{')) {
    // Bob answered with the markdown directly
    return { summary: '', content: raw.trim() };
  }
  throw new Error('Could not parse RFP response from Headless Bob output');
}
