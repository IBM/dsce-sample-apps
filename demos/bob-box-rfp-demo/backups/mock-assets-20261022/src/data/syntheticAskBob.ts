import { AskBobQA, DocumentExcerpt } from '../types';
import { SYNTHETIC_FINDINGS } from './syntheticFindings';
import { SYNTHETIC_BOX_DOCUMENTS } from './syntheticDocuments';

export const SYNTHETIC_ASK_BOB_DATABASE: AskBobQA[] = [
  {
    id: 'qa-pain-points',
    questionPatterns: [
      'pain points',
      'what are the pain points',
      'what is the real problem',
      'whats the real problem',
      'what problems',
      'challenges',
      'bottlenecks',
      'issues',
      'friction',
      'current challenges'
    ],
    suggestedQuestion: 'What are Acme’s documented pain points & bottlenecks?',
    answer: 'Based on Acme’s Discovery Notes, Current Architecture analysis, and Workflow Notes, the documented pain points are:\n\n1. 48-Hour Manual Classification Backlog: Operations staff manually inspect uploaded PDF/DOCX tax records and contracts, creating human error and backlog.\n2. Disconnected Repositories: Onboarding specialists search across three legacy file shares, taking 15+ minutes per case.\n3. Manual Salesforce Re-entry: Ops reps spend 2–3 hours daily re-typing document metadata and timestamps into Salesforce.\n4. Slow Email Approvals: Approvals circulate via untracked Outlook email chains with zero automated escalation when reviewers are away.\n5. Lack of Workflow Visibility: Business users have no centralized dashboard to monitor onboarding approval status.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-001', 'box-doc-007', 'box-doc-008'],
    category: 'requirements'
  },
  {
    id: 'qa-what-to-see',
    questionPatterns: [
      'what does acme want to see',
      'what did acme ask for',
      'what should we show',
      'demo requirements',
      'what to demonstrate',
      'demo scope'
    ],
    suggestedQuestion: 'What does Acme explicitly want to see in the demo?',
    answer: 'Based on Acme’s RFP, discovery notes, and demo request, Acme has explicitly asked to see:\n\n1. Automated Document Classification upon intake to eliminate manual sorting.\n2. Salesforce Sales Cloud Integration for embedded preview and metadata sync.\n3. Role-Based Access Controls (RBAC) demonstrating distinct Intake, Approver, and Auditor tiers.\n4. Streamlined Document Approval Workflow with automated status updates.\n5. Unified Search across customer onboarding documentation.\n6. Real-time Workflow Status Visibility.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-006', 'box-doc-008'],
    category: 'requirements'
  },
  {
    id: 'qa-salesforce-why',
    questionPatterns: [
      'why is salesforce integration included',
      'why salesforce',
      'why show salesforce',
      'salesforce importance',
      'crm integration',
      'salesforce handoff',
      'salesforce'
    ],
    suggestedQuestion: 'Why is Salesforce integration so central to this demo?',
    answer: 'Salesforce integration is strongly supported across 4 independent Box documents (Discovery Notes, Architecture Workshop, RFP, and Integration Matrix).\n\nKey reasons documented by Acme:\n• Operations reps currently spend 2–3 hours daily manually locating files and retyping metadata into Salesforce.\n• Acme requested a live demonstration showing how an uploaded onboarding document automatically links into the Salesforce Account record via Box Canvas.\n• Eliminates duplicate data entry between content repositories and CRM records.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-001', 'box-doc-004', 'box-doc-005', 'box-doc-009'],
    category: 'strategy'
  },
  {
    id: 'qa-security-reqs',
    questionPatterns: [
      'what security requirements has acme documented',
      'security requirements',
      'ciso requirements',
      'compliance requirements',
      'security specs',
      'encryption',
      'data residency',
      'audit logs'
    ],
    suggestedQuestion: 'What security & compliance requirements has Acme documented?',
    answer: 'According to CISO Marcus Vance’s Security Requirements policy (SEC-POL-2024-89) and technical specs, Acme has mandated:\n\n1. Encryption: AES-256 for data at rest and TLS 1.2+ for all data in transit.\n2. Audit Logging: Tamper-evident logging of all creation, view, edit, and access events with a minimum 365-day retention.\n3. US Data Residency: Strict requirement that all tenant storage and processing remains within US boundaries.\n4. Role-Based Access Controls (RBAC): Tiered permission isolation for Intake Staff, Approvers, and Auditors.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-011'],
    category: 'security'
  },
  {
    id: 'qa-unanswered-questions',
    questionPatterns: [
      'what questions remain unanswered',
      'unresolved questions',
      'open questions',
      'what is missing',
      'what do we need to confirm',
      'q&a topics'
    ],
    suggestedQuestion: 'What questions remain unanswered in Acme\'s documentation?',
    answer: 'The available Box documents identify 5 specific unresolved questions:\n\n1. Expected Monthly Document Volume: Ingestion volume across branches is currently unmetered and pending operational audit.\n2. Records Retention Schedule: Legal is evaluating 3 years vs. 7 years retention post-account closure.\n3. External Collaborators: The count of external legal counsel / partner reviewers is unconfirmed.\n4. Identity Provider Standard: Evaluating Okta vs. Microsoft Azure AD for SAML SSO.\n5. System of Record for Metadata: Architecture team is debating whether Salesforce or Box serves as the master record.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-002', 'box-doc-004', 'box-doc-010', 'box-doc-011'],
    category: 'open_questions'
  },
  {
    id: 'qa-auto-class-sources',
    questionPatterns: [
      'which files mention automated classification',
      'who mentioned classification',
      'automated classification sources',
      'classification evidence',
      'classification'
    ],
    suggestedQuestion: 'Which files mention automated document classification?',
    answer: 'Automated document classification is explicitly mentioned in 3 Box documents:\n\n1. Acme_Discovery_Notes.docx (Section: Stated Goals for New Solution)\n2. Acme_RFP.pdf (Section 3.1: Mandatory Functional Requirements)\n3. September_Follow_Up_Notes.docx (Discussion Highlights with IT Director Rachel Green)\n\nAll three documents emphasize automated classification to eliminate the 48-hour onboarding backlog.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-010'],
    category: 'requirements'
  },
  {
    id: 'qa-what-to-avoid',
    questionPatterns: [
      'what should i avoid spending too much time on',
      'what to deprioritize',
      'what not to show',
      'what to avoid',
      'deprioritized features'
    ],
    suggestedQuestion: 'What capabilities should I deprioritize during the demo?',
    answer: 'You should avoid spending time on capabilities not supported by Acme’s documentation, specifically:\n\n• Real-Time Collaborative Whiteboard Canvas (no evidence in any document)\n• Video & Audio Transcoding Pipelines (Acme is focused on commercial PDF/DOCX onboarding)\n• Custom E-Signature Graphic Templates (focus on automated classification and Salesforce sync instead)\n\nNote: These are deprioritized solely because supporting customer evidence was not found in the available Box files.',
    grounded: true,
    insufficientEvidence: false,
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-007'],
    category: 'strategy'
  },
  {
    id: 'qa-doc-volume-missing',
    questionPatterns: [
      'what is acme’s expected monthly document volume',
      'what is acmes expected monthly document volume',
      'expected monthly document volume',
      'monthly document volume',
      'document volume',
      'volume'
    ],
    suggestedQuestion: 'What is Acme’s expected monthly document volume?',
    answer: 'I could not find Acme’s expected monthly document volume in the available Box content. Data_Governance_Requirements.pdf notes that monthly ingestion volume is currently unmetered across branches and pending an operational audit. This remains an open question to confirm with Rachel Green tomorrow.',
    grounded: true,
    insufficientEvidence: true,
    supportingDocumentIds: ['box-doc-011'],
    category: 'open_questions'
  },
  {
    id: 'qa-purchase-probability-missing',
    questionPatterns: [
      'what is acme’s probability of purchasing',
      'what is acmes probability of purchasing',
      'probability of purchasing',
      'purchase intent',
      'win probability',
      'sentiment score',
      'deal score',
      'risk score',
      'purchase'
    ],
    suggestedQuestion: 'What is Acme’s probability of purchasing?',
    answer: 'The available Box content does not provide enough evidence to estimate a purchase probability or deal score. IBM Bob adheres strictly to evidence-based analysis and does not fabricate predictive sentiment or purchase likelihood. I can summarize Acme\'s documented requirements, pain points, and specific demo requests instead.',
    grounded: true,
    insufficientEvidence: true,
    supportingDocumentIds: [],
    category: 'scope'
  }
];

export function findAskBobAnswer(query: string): {
  answer: string;
  grounded: boolean;
  insufficientEvidence: boolean;
  supportingDocumentIds: string[];
  matchedQA?: AskBobQA;
  excerpts?: DocumentExcerpt[];
} {
  const normalized = query.toLowerCase().trim();
  
  if (!normalized) {
    return {
      answer: 'Please enter a question regarding Acme Corp’s customer context or demo preparation.',
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds: []
    };
  }

  // 1. Check curated Q&A database first
  for (const qa of SYNTHETIC_ASK_BOB_DATABASE) {
    for (const pattern of qa.questionPatterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        return {
          answer: qa.answer,
          grounded: qa.grounded,
          insufficientEvidence: qa.insufficientEvidence,
          supportingDocumentIds: qa.supportingDocumentIds,
          matchedQA: qa
        };
      }
    }
  }

  // 2. Dynamic Search across Structured Findings (e.g. pain points, sso, rbac, approval, search, etc.)
  const matchedFinding = SYNTHETIC_FINDINGS.find(f => {
    const titleMatch = f.title.toLowerCase().includes(normalized) || normalized.includes(f.title.toLowerCase());
    const stmtMatch = f.statement.toLowerCase().includes(normalized);
    const keywords = normalized.split(/\s+/).filter(w => w.length > 3);
    const keywordMatch = keywords.length > 0 && keywords.some(k => f.title.toLowerCase().includes(k) || f.statement.toLowerCase().includes(k));
    return titleMatch || stmtMatch || keywordMatch;
  });

  if (matchedFinding && !matchedFinding.insufficientEvidence) {
    return {
      answer: `Based on ${matchedFinding.supportingSourceCount} Box document(s), here is the grounded finding for "${matchedFinding.title}":\n\n${matchedFinding.statement}\n\nEvidence Summary: ${matchedFinding.groundedSummary}`,
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds: matchedFinding.supportingDocumentIds,
      excerpts: matchedFinding.excerpts
    };
  }

  // 3. Dynamic Search across 12 Box Documents content
  const matchedDocs = SYNTHETIC_BOX_DOCUMENTS.filter(d => {
    const nameMatch = d.name.toLowerCase().includes(normalized);
    const summaryMatch = d.summary.toLowerCase().includes(normalized);
    const keywords = normalized.split(/\s+/).filter(w => w.length > 3);
    const kwMatch = keywords.length > 0 && keywords.some(k => d.summary.toLowerCase().includes(k) || d.name.toLowerCase().includes(k));
    return nameMatch || summaryMatch || kwMatch;
  });

  if (matchedDocs.length > 0) {
    const docNames = matchedDocs.map(d => d.name).join(', ');
    const summaries = matchedDocs.slice(0, 2).map(d => `• ${d.name}: ${d.summary}`).join('\n');
    return {
      answer: `I found ${matchedDocs.length} relevant Box document(s) matching your inquiry (${docNames}):\n\n${summaries}`,
      grounded: true,
      insufficientEvidence: false,
      supportingDocumentIds: matchedDocs.map(d => d.id)
    };
  }

  // 4. Strict Guardrail Fallback for unsupported questions
  return {
    answer: 'I could not find sufficient evidence in the available Box content to answer that question. 12 files were reviewed across Acme\'s Discovery Notes, Technical Specs, Security Mandates, and RFP repositories, but this specific detail was not documented.',
    grounded: true,
    insufficientEvidence: true,
    supportingDocumentIds: []
  };
}
