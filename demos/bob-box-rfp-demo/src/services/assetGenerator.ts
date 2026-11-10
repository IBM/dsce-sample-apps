/**
 * Asset Generator — derives all demo deliverables from live Box documents + findings.
 *
 * Instead of serving static synthetic content, every screen in the demo flow
 * (DemoPlanScreen, DemoAssetsScreen, DemoReadyScreen) calls into these generators
 * so the output is grounded in whatever files Bob actually read from Box.
 */

import { BoxDocument, Finding, DocumentExcerpt, DemoPlanStep, TechnicalValidationItem, FollowUpQuestionItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedDemoPlan {
  steps: DemoPlanStep[];
  confirmationQuestions: Array<{
    topic: string;
    question: string;
    whyToAsk: string;
    relatedDoc: string;
  }>;
  totalDurationMinutes: number;
  customerName: string;
  stakeholders: string[];
}

export interface GeneratedDemoAssets {
  scriptContent: string;
  talkingPoints: Array<{
    topic: string;
    talkingPoint: string;
    supportingSources: string[];
    category: string;
  }>;
  technicalValidationChecklist: TechnicalValidationItem[];
  followUpQuestions: FollowUpQuestionItem[];
  customerName: string;
}

export interface GeneratedExecBrief {
  customerName: string;
  stakeholders: string[];
  corePainPoints: string[];
  demoFocus: string;
  validatedMandates: string[];
  openQAItems: string[];
  sourceCount: number;
  copyText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function detectCustomerName(documents: BoxDocument[]): string {
  // Try to infer from folder paths (e.g. "All Files / Customers / Acme Corp / ...")
  for (const doc of documents) {
    const parts = doc.folderPath.split('/').map(s => s.trim());
    const idx = parts.findIndex(p => p.toLowerCase() === 'customers');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  }
  // Fallback: try from file names
  for (const doc of documents) {
    const m = doc.name.match(/^([A-Za-z]+)_/);
    if (m) return m[1];
  }
  return 'the Customer';
}

/**
 * Score a document's relevance to the user's prompt (0–1).
 * Splits the prompt into keywords and counts how many appear in the document's
 * name, summary, and fullContent. Returns a normalised score.
 */
export function scoreDocumentRelevance(doc: BoxDocument, prompt: string): number {
  if (!prompt.trim()) return 1; // no prompt → treat all docs as equally relevant
  const stopWords = new Set(['the','a','an','is','are','was','were','to','for','of','in','on','and','or','with','that','this','what','how','can','do','does','will','be','at','by','from','we','i','it','its']);
  const keywords = prompt
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  if (keywords.length === 0) return 1;
  const haystack = `${doc.name} ${doc.summary ?? ''} ${(doc.fullContent ?? '').slice(0, 2000)}`.toLowerCase();
  const hits = keywords.filter(k => haystack.includes(k)).length;
  return hits / keywords.length;
}

/**
 * Filter + rank documents by relevance to the prompt.
 * Returns all docs but sorted so the most relevant come first; docs with zero
 * relevance score are kept so the caller always has something to work with.
 */
export function rankDocumentsByPrompt(documents: BoxDocument[], prompt: string): BoxDocument[] {
  if (!prompt.trim()) return documents;
  return [...documents].sort(
    (a, b) => scoreDocumentRelevance(b, prompt) - scoreDocumentRelevance(a, prompt)
  );
}

/**
 * Extract a one-sentence summary of the user's intent from the prompt
 * (used as the demo focus line when no findings supply a better one).
 */
function promptIntent(prompt: string): string {
  if (!prompt.trim()) return '';
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  return cleaned.length > 150 ? cleaned.slice(0, 147) + '…' : cleaned;
}

function findDocsForFinding(finding: Finding, documents: BoxDocument[]): string[] {
  return finding.supportingDocumentIds
    .map(id => documents.find(d => d.id === id)?.name)
    .filter((n): n is string => Boolean(n));
}

function findDocsByIds(ids: string[], documents: BoxDocument[]): BoxDocument[] {
  return ids.map(id => documents.find(d => d.id === id)).filter((d): d is BoxDocument => Boolean(d));
}

function excerpt(text: string, maxLen = 120): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s\S*$/, '') + '…';
}

function extractStakeholders(documents: BoxDocument[], findings: Finding[]): string[] {
  const names = new Set<string>();
  for (const doc of documents) {
    const m = doc.fullContent.match(/Participants?:[^\n]+/i);
    if (m) {
      m[0].replace(/Participants?:\s*/i, '').split(/[,;]/).forEach(p => {
        const name = p.trim().replace(/\(.*?\)/, '').trim();
        if (name && !name.toLowerCase().includes('acme')) names.add(name);
      });
    }
  }
  // Pull stakeholder names from finding excerpts if we found none
  if (names.size === 0) {
    for (const f of findings) {
      for (const ex of f.excerpts) {
        const m = ex.text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g);
        if (m) m.forEach(n => names.add(n));
      }
    }
  }
  return [...names].slice(0, 4);
}

// ─── Finding Derivation from Live Document Content ───────────────────────────

/**
 * Derives structured Finding objects directly from the fullContent of live Box documents.
 * This replaces the static SYNTHETIC_FINDINGS when running in live_mcp mode so that
 * every downstream screen (DemoBriefScreen, DemoPlanScreen, DemoAssetsScreen, etc.)
 * is grounded in real document text rather than pre-written mock data.
 */
export function deriveFindings(documents: BoxDocument[], prompt = ''): Finding[] {
  if (documents.length === 0) return [];

  // Rank documents by relevance to the prompt so signal extraction prioritises
  // the most relevant docs first.
  const rankedDocs = rankDocumentsByPrompt(documents, prompt);
  console.group(`[Bob] deriveFindings — prompt: "${prompt || '(none)'}"`);
  console.log('[Bob] ranked doc order (top 5):');
  rankedDocs.slice(0, 5).forEach((d, i) => {
    const score = scoreDocumentRelevance(d, prompt);
    console.log(`  ${i + 1}. [score=${score.toFixed(2)}] ${d.name}`);
  });

  const findings: Finding[] = [];
  let findingIdx = 0;

  // ── Signal patterns: key phrases that reveal what the customer wants, their pain, tech needs, etc.
  const SIGNAL_GROUPS: Array<{
    category: Finding['category'];
    patterns: RegExp[];
    titleHint: string;
  }> = [
    {
      category: 'what_acme_wants_to_see',
      patterns: [
        /wants?\s+to\s+see|would\s+like\s+to\s+see|asked\s+(us\s+)?to\s+show|requested?\s+(a\s+)?demo|demo\s+request|show\s+us|demonstrate/i,
        /must\s+(be\s+able\s+to|support|provide|include)|require[sd]?\s+(?:the\s+ability|a)/i,
        /section\s+3\.\d|mandatory\s+functional|core\s+requirement/i,
      ],
      titleHint: 'Customer Capability Request',
    },
    {
      category: 'pain_points',
      patterns: [
        /pain\s+point|bottleneck|friction|manual|backlog|hours?\s+(per\s+day|daily|spent)|re-?entry|re-?type|redundant/i,
        /currently|legacy|today\s+we|right\s+now\s+we|problem\s+(is|with)|challenge\s+(is|with)|issue\s+(is|with)/i,
        /takes?\s+\d+\s+(hours?|minutes?|days?)|spend[s]?\s+\d+\s+(hours?|minutes?)|wast(e|ing)\s+time/i,
      ],
      titleHint: 'Documented Pain Point',
    },
    {
      category: 'technical_requirements',
      patterns: [
        /sso|saml|openid|oauth|single\s+sign[\s-]on|identity\s+provider|idp/i,
        /aes[\s-]?256|tls\s+1\.[23]|encrypt(ion|ed)|at[\s-]rest|in[\s-]transit/i,
        /rbac|role[\s-]based|access\s+control|permissions?|least[\s-]privilege/i,
        /audit\s+(log|trail)|compliance|tamper[\s-]evident|immutable/i,
        /rest\s+api|webhook|api\s+rate|integration\s+(with|to)|salesforce|crm\s+sync/i,
        /data\s+residen|us[\s-]only|geographic|data\s+center/i,
        /req[\s-]?\d+|technical\s+requirement|must\s+(support|provide|include|have)/i,
      ],
      titleHint: 'Technical Requirement',
    },
    {
      category: 'open_questions',
      patterns: [
        /unresolved|tbd|to\s+be\s+(determined|confirmed|discussed)|pending\s+(decision|confirmation)|open\s+(question|item)/i,
        /need[s]?\s+(to\s+)?(confirm|clarify|verify|decide)|awaiting|not\s+yet\s+decided/i,
        /3[\s-]year|7[\s-]year|retention\s+(period|schedule)|how\s+many|volume\s+(not|unknown)/i,
        /okta\s+(vs|or)\s+(azure|microsoft)|azure\s+(vs|or)\s+okta|which\s+(idp|provider)/i,
      ],
      titleHint: 'Open Question',
    },
    {
      category: 'recent_requests',
      patterns: [
        /follow[\s-]up|action\s+item|next\s+step|please\s+(send|share|prepare|show)|can\s+you\s+(show|provide|confirm)/i,
        /meeting\s+(notes?|summary)|call\s+(notes?|summary)|email\s+(thread|summary)/i,
      ],
      titleHint: 'Recent Request',
    },
  ];

  for (const doc of rankedDocs) {
    if (!doc.fullContent) continue;

    // Split content into sentences / short paragraphs for granular matching
    const sentences = doc.fullContent
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 600);

    for (const group of SIGNAL_GROUPS) {
      const matched: string[] = [];

      for (const sentence of sentences) {
        if (group.patterns.some(p => p.test(sentence))) {
          matched.push(sentence);
          if (matched.length >= 3) break; // cap at 3 excerpts per doc per category
        }
      }

      if (matched.length === 0) continue;

      const excerpts: DocumentExcerpt[] = matched.map(text => ({
        documentId: doc.id,
        documentName: doc.name,
        folderPath: doc.folderPath,
        section: deriveSection(text, doc.fullContent),
        text,
        relevanceNote: `Extracted from ${doc.name} via live Box MCP`,
      }));

      // Try to create a meaningful title from the first matched sentence
      const titleText = matched[0].replace(/^[^a-zA-Z]+/, '').split(/[.!?]/)[0].trim();
      const title = titleText.length > 80 ? titleText.slice(0, 77) + '…' : titleText;

      const existingForCategory = findings.filter(
        f => f.category === group.category && f.supportingDocumentIds.includes(doc.id)
      );

      if (existingForCategory.length > 0) {
        // Merge excerpts into existing finding for this doc+category to avoid duplication
        existingForCategory[0].excerpts.push(...excerpts);
        existingForCategory[0].supportingSourceCount = existingForCategory[0].excerpts.length;
        continue;
      }

      findings.push({
        id: `live-finding-${++findingIdx}`,
        category: group.category,
        title: title || group.titleHint,
        statement: matched[0],
        groundedSummary: `Found in ${doc.name}: ${excerpt(matched[0], 140)}`,
        strength: matched.length >= 2 ? 'strongly_supported' : 'supported',
        strengthLabel: matched.length >= 2
          ? `Strongly Supported (${matched.length} excerpts)`
          : 'Supported (1 excerpt)',
        supportingSourceCount: matched.length,
        supportingDocumentIds: [doc.id],
        excerpts,
        insufficientEvidence: false,
      });
    }
  }

  const merged = mergeFindingsByCategory(findings);
  console.log(`[Bob] findings before merge: ${findings.length}, after: ${merged.length}`);
  console.groupEnd();
  return merged;
}

function deriveSection(sentence: string, fullContent: string): string {
  // Find the heading that precedes this sentence in the document
  const idx = fullContent.indexOf(sentence);
  if (idx === -1) return 'Document Content';
  const before = fullContent.slice(Math.max(0, idx - 400), idx);
  const headings = before.match(/\n([A-Z][A-Z\s&:]{4,60})\n/g);
  if (headings && headings.length > 0) {
    return headings[headings.length - 1].trim();
  }
  return 'Document Content';
}

function mergeFindingsByCategory(findings: Finding[]): Finding[] {
  const categoryOrder: Finding['category'][] = [
    'what_acme_wants_to_see',
    'pain_points',
    'technical_requirements',
    'open_questions',
    'recent_requests',
  ];

  const merged: Finding[] = [];

  for (const cat of categoryOrder) {
    const group = findings.filter(f => f.category === cat);
    if (group.length === 0) continue;

    // Keep individual findings (one per distinct topic/document) but cap total per category
    merged.push(...group.slice(0, 8));
  }

  return merged;
}

// ─── Demo Plan Generator ──────────────────────────────────────────────────────

export function generateDemoPlan(documents: BoxDocument[], findings: Finding[], prompt = ''): GeneratedDemoPlan {
  console.group(`[Bob] generateDemoPlan — prompt: "${prompt || '(none)'}"`);
  console.log(`[Bob] input: ${documents.length} docs, ${findings.length} findings`);
  const customer = detectCustomerName(documents);
  const stakeholders = extractStakeholders(documents, findings);
  const rankedDocs = rankDocumentsByPrompt(documents, prompt);
  const docCount = documents.length;
  const intent = promptIntent(prompt);

  // Derive plan steps from whatever findings + documents are present
  const steps: DemoPlanStep[] = [];

  // Step 1 — Context & framing (always present)
  // Pick context docs from the highest-ranked documents by prompt relevance
  const contextDocs = rankedDocs
    .slice(0, 2)
    .map(d => d.id);

  const contextFrame = intent
    ? `Frame the session around ${customer}'s context as it relates to "${intent}", drawing from the ${docCount} documents Bob read from their Box workspace.`
    : `Frame the session around ${customer}'s operational challenges and what they specifically asked to see, drawing from the ${docCount} documents Bob read from their Box workspace.`;

  const contextTalkingPoint = intent
    ? `"We reviewed everything in your Box workspace — ${docCount} files — specifically looking at what relates to: ${intent}. This entire demonstration is built around that focus."`
    : `"We reviewed everything in your Box workspace — ${docCount} files across discovery notes, technical requirements, and architecture docs — and built this demonstration specifically around what your team told us matters most."`;

  steps.push({
    stepNumber: 1,
    title: `Introduce ${customer}'s Business Context`,
    actionToDemonstrate: contextFrame,
    presenterTalkingPoint: contextTalkingPoint,
    whyItMattersToAcme: `Signals that the demo is grounded in their real situation, not a generic product tour.`,
    supportingDocumentIds: contextDocs,
    suggestedTransition: `"Let's start with the capability your team ranked as highest priority."`,
    durationMinutes: 2,
    category: 'Context & Framing',
  });

  // Step 2 — What they want to see (from want_* findings)
  const wantFindings = findings.filter(f => f.category === 'what_acme_wants_to_see');
  if (wantFindings.length > 0) {
    const topWant = wantFindings.sort((a, b) => b.supportingSourceCount - a.supportingSourceCount)[0];
    steps.push({
      stepNumber: 2,
      title: `Demonstrate: ${topWant.title}`,
      actionToDemonstrate: topWant.statement,
      presenterTalkingPoint: `"${topWant.excerpts[0]?.text ? excerpt(topWant.excerpts[0].text) : topWant.groundedSummary}"`,
      whyItMattersToAcme: topWant.groundedSummary,
      supportingDocumentIds: topWant.supportingDocumentIds.slice(0, 3),
      suggestedTransition: `"This directly addresses what ${topWant.excerpts[0]?.documentName ?? 'your team'} identified. Let's show the full workflow."`,
      durationMinutes: 3,
      category: 'Core Capability Demo',
    });
  }

  // Steps 3+ — Pain points → Solution proof
  const painFindings = findings.filter(f => f.category === 'pain_points').slice(0, 2);
  painFindings.forEach((pain, i) => {
    steps.push({
      stepNumber: 3 + i,
      title: `Address Pain Point: ${pain.title}`,
      actionToDemonstrate: `Show how Box + IBM Bob directly resolves: "${excerpt(pain.statement, 100)}"`,
      presenterTalkingPoint: `"${pain.excerpts[0]?.text ? excerpt(pain.excerpts[0].text, 140) : pain.groundedSummary}"`,
      whyItMattersToAcme: `Source: ${pain.excerpts[0]?.documentName ?? 'Customer documents'}. ${pain.groundedSummary}`,
      supportingDocumentIds: pain.supportingDocumentIds.slice(0, 3),
      suggestedTransition: `"And that's how we eliminate that bottleneck entirely. Let's look at the next critical area."`,
      durationMinutes: 2,
      category: 'Pain Point Resolution',
    });
  });

  // Technical requirements step
  const techFindings = findings.filter(f => f.category === 'technical_requirements');
  if (techFindings.length > 0) {
    const techIds = [...new Set(techFindings.flatMap(f => f.supportingDocumentIds))].slice(0, 3);
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Walk Through Technical Requirements & Validation',
      actionToDemonstrate: `Confirm ${techFindings.length} documented technical requirements: ${techFindings.slice(0, 3).map(f => f.title).join(', ')}.`,
      presenterTalkingPoint: `"We've pre-validated every requirement your team documented. Here's the checklist mapped directly to your source specifications."`,
      whyItMattersToAcme: `Demonstrates IBM Box has done the technical homework before the meeting, reducing objections.`,
      supportingDocumentIds: techIds,
      suggestedTransition: `"We have documented confirmation for each of those. Let's move to open questions."`,
      durationMinutes: 2,
      category: 'Technical Validation',
    });
  }

  // Open Q&A step
  const openFindings = findings.filter(f => f.category === 'open_questions');
  if (openFindings.length > 0) {
    const openIds = [...new Set(openFindings.flatMap(f => f.supportingDocumentIds))].slice(0, 3);
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Close with Open Architecture & Confirmation Questions',
      actionToDemonstrate: `Address ${openFindings.length} open items that need confirmation: ${openFindings.slice(0, 3).map(f => f.title).join(', ')}.`,
      presenterTalkingPoint: `"We found ${openFindings.length} items in your documents that need your team's final confirmation. Let's use our remaining time to resolve them."`,
      whyItMattersToAcme: `Shows thoroughness and keeps the conversation moving toward next steps.`,
      supportingDocumentIds: openIds,
      suggestedTransition: `"Open the floor to your team's questions."`,
      durationMinutes: 3,
      category: 'Architecture & Q&A',
    });
  }

  // Confirmation questions — driven by open_questions findings
  const confirmationQuestions = openFindings.slice(0, 5).map(f => ({
    topic: f.title,
    question: `"${f.excerpts[0]?.text ? excerpt(f.excerpts[0].text, 140) : f.statement}"`,
    whyToAsk: f.groundedSummary,
    relatedDoc: findDocsByIds(f.supportingDocumentIds, documents)[0]?.name ?? 'Customer document',
  }));

  const plan = {
    steps,
    confirmationQuestions,
    totalDurationMinutes: steps.reduce((s, st) => s + st.durationMinutes, 0),
    customerName: customer,
    stakeholders,
  };
  console.log(`[Bob] plan: ${plan.steps.length} steps, ${plan.totalDurationMinutes} min, customer="${plan.customerName}"`);
  plan.steps.forEach(s => console.log(`  Step ${s.stepNumber}: ${s.title}`));
  console.groupEnd();
  return plan;
}

// ─── Demo Assets Generator ────────────────────────────────────────────────────

export function generateDemoAssets(documents: BoxDocument[], findings: Finding[], prompt = ''): GeneratedDemoAssets {
  console.group(`[Bob] generateDemoAssets — prompt: "${prompt || '(none)'}"`);
  const customer = detectCustomerName(documents);
  const stakeholders = extractStakeholders(documents, findings);
  const stakeholderLine = stakeholders.length > 0
    ? stakeholders.join(', ')
    : 'Customer stakeholders';
  const intent = promptIntent(prompt);

  // ── Script ──
  const wantFindings = findings.filter(f => f.category === 'what_acme_wants_to_see');
  const painFindings = findings.filter(f => f.category === 'pain_points');
  const techFindings = findings.filter(f => f.category === 'technical_requirements');

  const topPain = painFindings[0];
  const topWant = wantFindings.sort((a, b) => b.supportingSourceCount - a.supportingSourceCount)[0];

  const firstStakeholder = stakeholders.length > 0 ? `, ${stakeholders[0].split(' ')[0]}` : '';
  const openCount = findings.filter(f => f.category === 'open_questions').length;

  // Opening line driven by the prompt intent when available, otherwise by the top pain point
  const openingTheme = intent
    ? `When we prepared for today using your Box workspace, we focused on: ${intent}.`
    : `When we reviewed your onboarding operations, one clear theme kept coming up: ${topPain ? topPain.title : 'manual, disconnected processes that slow your team down'}.`;

  const scriptContent = `${customer.toUpperCase()} — TAILORED DEMO PRESENTATION SCRIPT
Presenter: Solutions Engineer  |  Account: ${customer}
Audience: ${stakeholderLine}
${intent ? `Prompt: "${intent}"` : ''}
Estimated Duration: 18 Minutes (Demo: 12 min | Q&A: 6+ min)
================================================================================

PART 1: WELCOME & SETTING THE STAGE (2 MIN)
================================================================================
[Visual: Slide 01 — IBM Bob + Box Executive Overview]
PRESENTER:
"Good morning${firstStakeholder} and team. Thank you for making time today.

We've been looking forward to this. ${openingTheme}

Today we're going to show you end-to-end how Box eliminates that friction — from document intake, to automated classification, to workflow routing, to your CRM — without any custom code."

================================================================================
PART 2: DOCUMENT INTAKE & AUTOMATED CLASSIFICATION (3 MIN)
================================================================================
[Visual: Slide 03 — AI Document Extraction]
[Action: Drop a customer onboarding package into the Box intake folder]
PRESENTER:
"Let's start where your intake team works. When a new customer package arrives, the specialist simply drops the files into Box.

Notice what happens immediately: Box doesn't just store the file. It analyzes the document structure, identifies the document type, and extracts the key metadata fields — entity name, identifiers, governance tags — with zero manual labeling.

${topWant ? `This is exactly what your team asked for: ${topWant.title}.` : 'This eliminates the manual classification step entirely.'}

${topPain ? `"${excerpt(topPain.statement, 180)}"` : ''}

That backlog disappears the moment a file lands in Box."

================================================================================
PART 3: APPROVAL ROUTING & AUDIT TRAIL (2.5 MIN)
================================================================================
[Visual: Slide 04 — Workflow & Compliance]
[Action: Show the automated approval task with escalation rules]
PRESENTER:
"Because this document is now classified, Box automatically triggers your standardized approval workflow.

Instead of untracked email threads — where cases get lost when reviewers are out of office — the approver receives an actionable task with clear deadlines. Every view, edit, and approval decision is logged into Box's tamper-evident audit trail.

${techFindings.find(f => /audit|complian/i.test(f.title)) ? `Your documentation explicitly requires this: ${excerpt(techFindings.find(f => /audit|complian/i.test(f.title))!.statement, 140)}` : 'This meets your compliance and audit retention mandates.'}"

================================================================================
PART 4: LIVE CRM HANDOFF (3 MIN)
================================================================================
[Visual: Slide 05 — Enterprise Integration]
[Action: Switch to CRM Account view — Box Embedded Canvas]
PRESENTER:
"Now let's switch over to your CRM, where your account executives live.

Without anyone typing a single line of metadata or uploading duplicate files, the account record is instantly synchronized. The account manager sees the verified document preview right inside their CRM screen — complete with extracted metadata and real-time approval status.

${wantFindings.find(f => /salesforce|crm|integrat/i.test(f.title)) ? `This directly addresses what your team documented: ${excerpt(wantFindings.find(f => /salesforce|crm|integrat/i.test(f.title))!.statement, 160)}` : 'This eliminates hours of daily manual re-entry for your operations team.'}"

================================================================================
PART 5: SECURITY & ACCESS CONTROLS (2 MIN)
================================================================================
[Visual: Slide 06 — Security & Governance]
PRESENTER:
"Let's touch on security.${techFindings.find(f => /rbac|role|access/i.test(f.title)) ? ` Your team documented a clear requirement: ${excerpt(techFindings.find(f => /rbac|role|access/i.test(f.title))!.statement, 120)}` : ''}

Watch what happens when I switch roles:
- An Intake Clerk can upload files but cannot approve or modify governance policies.
- An Approver has review and sign-off authority.
- An external auditor receives a view-only watermarked preview with downloading restricted.

All content is${techFindings.find(f => /encrypt|aes/i.test(f.title)) ? ` protected with AES-256 encryption and TLS 1.2+ in transit` : ' encrypted at rest and in transit'} — stored in US data centers."

================================================================================
PART 6: TECHNICAL VALIDATION & Q&A (5+ MIN)
================================================================================
[Visual: Technical Validation Matrix]
PRESENTER:
"To wrap up and respect the time we reserved for your team: we've pre-validated your requirements for ${techFindings.slice(0, 3).map(f => f.title).join(', ')}.

${openCount > 0 ? `We also identified ${openCount} open item${openCount > 1 ? 's' : ''} that need your team's confirmation — let's use our Q&A time to resolve those.` : "Let's open the floor for your questions."}"

================================================================================
[Demo Presenter Notes — Grounded in ${documents.length} live Box files | IBM Bob]
================================================================================
`;

  // ── Talking Points ──
  const talkingPoints = [
    ...wantFindings.slice(0, 3).map(f => ({
      topic: f.title,
      talkingPoint: `"${f.excerpts[0]?.text ? excerpt(f.excerpts[0].text, 160) : f.groundedSummary}"`,
      supportingSources: findDocsForFinding(f, documents),
      category: 'Demo Priority',
    })),
    ...painFindings.slice(0, 2).map(f => ({
      topic: f.title,
      talkingPoint: `"${excerpt(f.statement, 160)}"`,
      supportingSources: findDocsForFinding(f, documents),
      category: 'Pain Point',
    })),
  ];

  // ── Technical Validation Checklist ──
  const technicalValidationChecklist: TechnicalValidationItem[] = techFindings.slice(0, 10).map((f, i) => ({
    id: `val-live-${i + 1}`,
    requirement: f.title,
    status: f.strength === 'strongly_supported' ? 'documented' : (f.insufficientEvidence ? 'needs_confirmation' : 'documented'),
    sourceDocumentIds: f.supportingDocumentIds,
    notes: excerpt(f.groundedSummary, 200),
    category: detectTechCategory(f.title),
  }));

  // ── Follow-up Questions ──
  const openQFindings = findings.filter(f => f.category === 'open_questions');
  const followUpQuestions: FollowUpQuestionItem[] = openQFindings.slice(0, 5).map(f => ({
    category: detectFollowUpCategory(f.title),
    question: f.excerpts[0]?.text ? excerpt(f.excerpts[0].text, 200) : f.statement,
    context: f.groundedSummary,
    relevantStakeholder: stakeholders[0] ?? 'Customer stakeholders',
  }));

  const assets = {
    scriptContent,
    talkingPoints,
    technicalValidationChecklist,
    followUpQuestions,
    customerName: customer,
  };
  console.log(`[Bob] assets: ${assets.talkingPoints.length} talking points, ${assets.technicalValidationChecklist.length} checklist items, ${assets.followUpQuestions.length} follow-ups`);
  console.log(`[Bob] script first line: "${assets.scriptContent.split('\n')[0]}"`);
  console.groupEnd();
  return assets;
}

// ─── Executive Brief Generator ────────────────────────────────────────────────

export function generateExecBrief(documents: BoxDocument[], findings: Finding[], prompt = ''): GeneratedExecBrief {
  console.group(`[Bob] generateExecBrief — prompt: "${prompt || '(none)'}"`);
  const customer = detectCustomerName(documents);
  const stakeholders = extractStakeholders(documents, findings);
  const intent = promptIntent(prompt);

  const painFindings = findings.filter(f => f.category === 'pain_points');
  const wantFindings = findings.filter(f => f.category === 'what_acme_wants_to_see');
  const techFindings = findings.filter(f => f.category === 'technical_requirements');
  const openFindings = findings.filter(f => f.category === 'open_questions');

  const corePainPoints = painFindings.slice(0, 3).map(f => excerpt(f.statement, 100));

  // Prefer prompt intent as the primary demo focus line; fall back to top findings
  const demoFocus = intent ||
    (wantFindings.length > 0
      ? wantFindings
          .sort((a, b) => b.supportingSourceCount - a.supportingSourceCount)
          .slice(0, 3)
          .map(f => f.title)
          .join(', ')
      : 'Box AI automation and workflow modernization');

  const validatedMandates = techFindings.slice(0, 5).map(f => f.title);
  const openQAItems = openFindings.slice(0, 3).map(f => f.title);

  const copyText = `${customer.toUpperCase()} — DEMO READINESS EXECUTIVE BRIEF
Account: ${customer}
Audience: ${stakeholders.join(', ') || 'Customer stakeholders'}
${intent ? `Prepared For: "${intent}"` : ''}
Grounded in ${documents.length} Box workspace files

CORE CONTEXT:
${corePainPoints.map(p => `• ${p}`).join('\n')}

DEMONSTRATION FOCUS:
${demoFocus}

VALIDATED TECHNICAL MANDATES:
${validatedMandates.map(m => `• ${m}`).join('\n')}

OPEN Q&A ITEMS:
${openQAItems.map(q => `• ${q}`).join('\n')}

Prepared with IBM Bob • 100% Grounded in Customer Box Records`;

  const brief = {
    customerName: customer,
    stakeholders,
    corePainPoints,
    demoFocus,
    validatedMandates,
    openQAItems,
    sourceCount: documents.length,
    copyText,
  };
  console.log(`[Bob] brief: customer="${brief.customerName}", focus="${brief.demoFocus.slice(0, 80)}"`);
  console.log(`[Bob] pain points:`, brief.corePainPoints);
  console.log(`[Bob] mandates:`, brief.validatedMandates);
  console.groupEnd();
  return brief;
}

// ─── Category classifiers ─────────────────────────────────────────────────────

function detectTechCategory(title: string): TechnicalValidationItem['category'] {
  const t = title.toLowerCase();
  if (/sso|saml|auth|identity|login|okta|azure/.test(t)) return 'Security';
  if (/salesforce|crm|integration|api|webhook|sync/.test(t)) return 'Integration';
  if (/encrypt|aes|tls|data residency|residency/.test(t)) return 'Security';
  if (/audit|compliance|retain|retention|log/.test(t)) return 'Compliance';
  if (/volume|capacity|throughput|ingestion/.test(t)) return 'Operations';
  return 'Architecture';
}

function detectFollowUpCategory(title: string): FollowUpQuestionItem['category'] {
  const t = title.toLowerCase();
  if (/security|sso|auth|identity|encrypt/.test(t)) return 'Security';
  if (/salesforce|integration|api|webhook/.test(t)) return 'Integration';
  if (/volume|capacity|ingestion|throughput/.test(t)) return 'Operations';
  if (/architecture|metadata|system of record|master/.test(t)) return 'Architecture';
  return 'Business Process';
}
