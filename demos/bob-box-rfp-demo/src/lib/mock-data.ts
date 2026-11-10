import type { RfpOutput } from '@/lib/rfp-schema'

export const VENDOR_NAME = 'IBM'

export type BoxFile = {
  name: string
  folder: string
  kind: 'pdf' | 'docx' | 'xlsx' | 'pptx'
  modified: string
  boxFileId?: string
  liveContent?: string
}

export type ContextGroup = {
  id: string
  title: string
  summary: string
  items: string[]
  sources: BoxFile[]
}

export const SYNC_STEPS = [
  {
    label: 'Connecting to Box',
    detail: 'acme-bank.app.box.com (IBM Enterprise Content)',
    files: ['Authorizing IBM Bob MCP…', 'Loading folder taxonomy…'],
  },
  {
    label: 'Searching for the RFP',
    detail: 'Found "Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf"',
    files: ['/Incoming RFPs', 'Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf', 'Acme Bank - Late Addendum BAA Compliance.pdf'],
  },
  {
    label: 'Extracting requirements',
    detail: '18 requirements across 5 sections + late BAA addendum',
    files: ['Section 3 – Scope of Work', 'Section 4 – Technical & Integration Specs', 'Acme Bank - Late Addendum BAA Compliance.pdf'],
  },
  {
    label: 'Reading product documentation',
    detail: '4 files in /Product Documentation',
    files: ['IBM Bob Product Guide.pdf', 'Architecture Overview.pdf', 'Security Whitepaper.pdf', 'SOC 2 Report.pdf'],
  },
  {
    label: 'Matching past RFP responses',
    detail: '3 banking and enterprise bids in /Past RFP Responses',
    files: ['Banking RFP Response - Chase.pdf', 'Healthcare RFP Response - Kaiser.docx', 'Government Procurement Response.docx'],
  },
  {
    label: 'Researching the client context',
    detail: '3 customer files in /Customers/Acme Bank',
    files: ['Acme Bank Discovery Notes.docx', 'Technical Requirements.xlsx', 'September Follow-Up Notes.docx'],
  },
]

export type SourceExcerpt = {
  location: string
  before: string[]
  highlight: string
  after: string[]
}

export const SOURCE_EXCERPTS: Record<string, SourceExcerpt> = {
  'Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf': {
    location: 'Page 4 · Section 3.2',
    before: [
      '3.2 Technical Architecture & Integration. The selected vendor shall provide an AI-powered document intelligence and content reasoning engine that connects directly to Acme Bank’s Box Content Cloud.',
    ],
    highlight:
      'The platform must connect via Model Context Protocol (MCP), support SAML 2.0 Single Sign-On, maintain strict zero data retention for AI model training, and provide deterministic citation provenance.',
    after: [
      'Vendors shall detail their SOC 2 Type II audit status and support for automated classification across commercial loan onboarding workflows.',
    ],
  },
  'Acme Bank Discovery Notes.docx': {
    location: 'Discovery Session · Sept 18',
    before: ['Call with David Chen (VP Operations) and Rachel Green (IT Director) on commercial loan processing.'],
    highlight:
      'David stated manual intake classification and Salesforce re-entry create a 48-hour backlog. Centralized search and automated classification are the top operational priorities.',
    after: ['Next step: demonstrate real-time Box MCP grounding and automated document classification on sample financial statements.'],
  },
  'Technical Requirements.xlsx': {
    location: 'Sheet "Architecture" · Row 4',
    before: ['[REQ-01] Identity & Authentication: SAML 2.0 / OpenID Connect SSO required.'],
    highlight:
      'Protocol: SAML 2.0 / OpenID Connect. Note: Evaluating Okta vs. Azure AD (Pending final CISO review). Granular RBAC required for front-office vs underwriting teams.',
    after: ['[REQ-02] REST API & Webhooks: Programmatic file uploads and asynchronous document event notifications.'],
  },
  'Acme Bank - Late Addendum BAA Compliance.pdf': {
    location: 'Addendum A · Compliance Scope',
    before: ['Addendum to RFP-2026-DOCAI-04: Mandatory Compliance Requirements for AI Ingestion Pipelines.'],
    highlight:
      'All candidate platforms must execute a formal HIPAA Business Associate Agreement (BAA) and provide an independent SOC 2 Type II audit report covering all AI processing workflows.',
    after: ['Failure to satisfy BAA and SOC 2 criteria will result in immediate disqualification prior to commercial evaluation.'],
  },
  'IBM Bob Product Guide.pdf': {
    location: 'Page 2 · MCP Architecture',
    before: ['IBM Bob Enterprise Edition transforms static enterprise content into an autonomous reasoning engine.'],
    highlight:
      'Direct integration with Box Content Cloud via Model Context Protocol (MCP) enables real-time document search, synthesis, and artifact generation without persistent local caching or model training retention.',
    after: ['Every output includes deterministic citation hashes linking assertions directly to source document coordinates.'],
  },
  'Security Whitepaper.pdf': {
    location: 'Page 3 · Cryptography & Auditing',
    before: ['IBM Bob operates under enterprise-grade cryptographic standards.'],
    highlight:
      'AES-256 encryption at rest with customer-managed keys (CMEK), strict TLS 1.3 in transit, and continuous SOC 2 Type II and ISO 27001:2022 certifications.',
    after: ['Role-based access controls automatically inherit existing Box folder permissions and classification labels.'],
  },
  'Financial Services Case Study.pdf': {
    location: 'Executive Summary · Tier-1 Commercial Bank',
    before: ['Tier-1 Commercial Banking deployment across 250 underwriting specialists.'],
    highlight:
      'Commercial onboarding package turnaround reduced by 85% (from 48 hours to 15 minutes). RFP response drafting accelerated by 86% with $4.2M annual operational savings.',
    after: ['99.4% extraction accuracy achieved with zero hallucinations across loan covenant reviews.'],
  },
  'Banking RFP Response - Chase.pdf': {
    location: 'Section 5 · Commercial Agreement',
    before: ['Commercial Banking Proposal: Enterprise Content Intelligence Platform.'],
    highlight:
      'Fixed-fee 8-week launch package with milestone-based delivery and no change orders for in-scope integrations.',
    after: ['Multi-year commitment discount applied to annual platform subscription tiers.'],
  },
}

export const CONTEXT_GROUPS: ContextGroup[] = [
  {
    id: 'client',
    title: 'Client & RFP Scope',
    summary: 'Acme Bank, N.A. is issuing RFP-2026-DOCAI-04 for an AI-Powered Commercial Content Intelligence Platform connecting to Box.',
    items: [
      'Issuer: Acme Bank, N.A., Commercial Procurement',
      'Scope: AI-powered document intelligence & proposal response platform',
      'Core Goal: Automate commercial loan document intake & RFP drafting',
      'Key System: Native integration with Acme Bank’s Box Content Cloud',
      'Target Launch: 8-week fast-track enterprise deployment',
    ],
    sources: [
      { name: 'Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf', folder: '/Incoming RFPs', kind: 'pdf', modified: 'Oct 24' },
      { name: 'Acme Bank Discovery Notes.docx', folder: '/Customers/Acme Bank/Discovery Notes', kind: 'docx', modified: 'Sept 18' },
    ],
  },
  {
    id: 'requirements',
    title: 'Key requirements',
    summary: '18 requirements identified across 5 RFP sections and the late compliance addendum.',
    items: [
      'Box Content Cloud integration via Model Context Protocol (MCP)',
      'Automated classification for loan packages, tax records, and COIs',
      'Bi-directional sync with Salesforce Sales Cloud',
      'SAML 2.0 / OpenID Connect SSO (Okta or Azure AD)',
      'SOC 2 Type II & ISO 27001 certifications',
      'Signed HIPAA Business Associate Agreement (BAA)',
      'Zero customer data retention for AI model training',
      '99.95% monthly uptime SLA with financial credits',
    ],
    sources: [
      { name: 'Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf', folder: '/Incoming RFPs', kind: 'pdf', modified: 'Oct 24' },
      { name: 'Acme Bank - Late Addendum BAA Compliance.pdf', folder: '/Incoming RFPs', kind: 'pdf', modified: 'Oct 28' },
      { name: 'Technical Requirements.xlsx', folder: '/Customers/Acme Bank/Technical Specs', kind: 'xlsx', modified: 'Sept 22' },
    ],
  },
  {
    id: 'product',
    title: 'IBM Bob product capabilities',
    summary: 'IBM Bob Enterprise transforms Box repositories into an active agentic reasoning engine with zero data retention.',
    items: [
      'Autonomous document reasoning built on watsonx Granite foundation models',
      'Model Context Protocol (MCP) real-time in-memory Box connector',
      'Deterministic citation provenance with exact document and page anchors',
      'AES-256 encryption (CMEK supported) and TLS 1.3 data in transit',
      'SOC 2 Type II, ISO 27001:2022, and HIPAA BAA ready',
      'Pre-built bi-directional connectors for Salesforce and Box Shield',
    ],
    sources: [
      { name: 'IBM Bob Product Guide.pdf', folder: '/Product Documentation', kind: 'pdf', modified: 'Oct 15' },
      { name: 'Architecture Overview.pdf', folder: '/Product Documentation', kind: 'pdf', modified: 'Oct 10' },
      { name: 'Security Whitepaper.pdf', folder: '/Security & Compliance Documents', kind: 'pdf', modified: 'Oct 12' },
    ],
  },
  {
    id: 'past',
    title: 'Past RFP responses & benchmarks',
    summary: 'Three enterprise reference bids and banking case studies validating rapid ROI and fixed-price delivery.',
    items: [
      'JPMorgan Chase: Tier-1 banking deployment, 85% intake acceleration, $4.2M annual savings',
      'Banking RFP Response - Chase: Reusable proposal structure, SOC 2 answers, and pricing model',
      'Healthcare RFP Response - Kaiser: Validated BAA and compliance framework',
      'Project Delivery Framework: Proven 8-week enterprise onboarding playbook',
    ],
    sources: [
      { name: 'Financial Services Case Study.pdf', folder: '/Case Studies & Customer Success Stories', kind: 'pdf', modified: 'Aug 20' },
      { name: 'Banking RFP Response - Chase.pdf', folder: '/Past RFP Responses', kind: 'pdf', modified: 'Jun 15' },
      { name: 'Project Delivery Framework.pdf', folder: '/Implementation Methodology', kind: 'pdf', modified: 'Sep 05' },
    ],
  },
]

export const OPEN_QUESTIONS = [
  'Identity Provider Alignment: Discovery notes cite Okta, but RFP Section 4.1 specifies Azure AD SAML 2.0.',
  'Data Retention Policy: Standard customer policy specifies 3 years; RFP Section 5 mandates 7-year audit retention.',
  'Late Addendum: Acme Bank - Late Addendum BAA Compliance.pdf adds HIPAA BAA and SOC 2 Type II requirements for AI pipelines.',
]

export const INITIAL_RFP_TITLE =
  'RFP Response to Acme Bank: AI Powered Content Intelligence with IBM Bob and Box Content Cloud MCP'

export const MOCK_RESPONSE: RfpOutput = {
  title: INITIAL_RFP_TITLE,
  rfpReference: 'RFP-2026-DOCAI-04',
  clientName: 'Acme Bank, N.A.',
  submittedBy: 'IBM Corporation',
  submittedTo: 'Eleanor Vance, VP Strategic Sourcing & Technology Procurement',
  executiveSummary:
    'IBM is pleased to submit this formal proposal in response to RFP-2026-DOCAI-04. We propose IBM Bob Enterprise as the AI-powered document intelligence platform for Acme Bank\'s Commercial Lending Division — connecting directly to Acme Bank\'s existing Box Content Cloud via the open Model Context Protocol (MCP) to transform static repository folders into an active, autonomous reasoning engine.\n\nUnlike traditional keyword-search approaches, IBM Bob reads, synthesizes, and cross-references the full corpus of Box content — historical RFP responses, security whitepapers, product guides, past proposals, and customer discovery notes — to deliver comprehensive first-draft proposal responses and underwriting analyses with deterministic citation provenance and a guaranteed zero data-retention policy for AI model training.\n\nIBM Bob directly addresses every mandatory requirement in RFP-2026-DOCAI-04, including the late HIPAA BAA addendum. Our reference deployment at a Tier-1 commercial bank delivered an 85% reduction in intake turnaround (from 48 hours to under 15 minutes) and $4.2M in verified annual cost savings [Financial Services Case Study.pdf]. We are confident the same results are achievable at Acme Bank within the 8-week fast-track timeline.',
  sections: [
    {
      heading: 'Understanding of Need & Scope',
      body: 'Acme Bank\'s Commercial Lending Division processes hundreds of loan packages and RFP responses every month. Based on discovery sessions with VP Operations David Chen and IT Director Rachel Green, commercial operations staff currently manually inspect PDF and DOCX tax records, certificates of insurance, and contracts to tag them by account — creating a 48-hour intake backlog and requiring duplicate data re-entry into Salesforce Sales Cloud [Acme Bank Discovery Notes.docx].\n\nRFP-2026-DOCAI-04 identifies five core capability requirements: (1) native Box Content Cloud integration via MCP, (2) automated classification of commercial loan packages, (3) bi-directional Salesforce sync, (4) SAML 2.0 / OpenID Connect SSO, and (5) full SOC 2 Type II / HIPAA BAA compliance. IBM Bob is purpose-built to address all five [Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf].',
      bullets: [
        '48-hour manual intake backlog identified in September discovery sessions',
        'Three legacy file shares with no unified search or classification layer',
        'Manual Salesforce data re-entry consuming 30% of operations team capacity',
        'Late addendum (Oct 28) adds mandatory HIPAA BAA and SOC 2 AI pipeline audit',
        'Target: 8-week fast-track enterprise deployment for 250 specialists',
      ],
    },
    {
      heading: 'Technical Architecture & Box MCP Integration',
      body: 'IBM Bob\'s enterprise agentic architecture is built natively around Box Content Cloud. The Model Context Protocol (MCP) connector establishes a secure, real-time in-memory bridge to Box repositories — reading files on demand without persistent local caching. This means Acme Bank\'s documents never leave the Box environment [IBM Bob Product Guide.pdf].\n\nEvery generated output is anchored to exact Box document IDs, page coordinates, and excerpt hashes, providing deterministic citation provenance that eliminates hallucinations. The platform automatically inherits existing Box user permissions, IAM roles, and Box Shield classification labels — so there is zero re-permissioning effort at rollout.',
      bullets: [
        'MCP connector: secure real-time in-memory bridge, zero persistent local caching',
        'watsonx Granite foundation layer: optimized for financial parsing and complex document reasoning',
        'Deterministic grounding: every claim anchored to Box document ID, page, and excerpt hash',
        'Automatic Box IAM and Box Shield permission inheritance — no re-permissioning required',
        'Bi-directional REST API and Webhook connector for Salesforce Sales Cloud',
        'Programmatic Box file uploads and asynchronous document event notifications',
      ],
      keyMetric: { value: '< 2 sec', label: 'Average query response time across Box corpus', source: 'IBM Bob Product Guide.pdf' },
    },
    {
      heading: 'Security, Privacy & Compliance',
      body: 'IBM Bob operates under enterprise-grade cryptographic and governance standards that directly satisfy every security requirement in RFP-2026-DOCAI-04 and the late BAA addendum. AES-256 encryption is enforced at rest with customer-managed key (CMEK) support; all data in transit is protected by strict TLS 1.3 [Security Whitepaper.pdf].\n\nZero customer data is ever retained, shared, or used to train or fine-tune any IBM or third-party AI model — enforced contractually in the standard Enterprise MSA and independently audited under SOC 2 Type II (all five Trust Services Criteria). IBM executes a formal HIPAA Business Associate Agreement satisfying Acme Bank - Late Addendum BAA Compliance.pdf, and maintains ISO/IEC 27001:2022 certification with annual third-party review cycles.',
      bullets: [
        'AES-256 at rest with CMEK support; TLS 1.3 enforced in transit',
        'Zero data retention for AI model training — contractually enforced, independently audited',
        'SOC 2 Type II (all 5 Trust Services Criteria) — clean PwC audit report available',
        'ISO/IEC 27001:2022 certified with annual third-party renewal',
        'HIPAA BAA executed for late addendum compliance (Acme Bank - Late Addendum BAA Compliance.pdf)',
        'RBAC inherits Box folder permissions and Box Shield classification labels automatically',
      ],
      keyMetric: { value: 'SOC 2 Type II', label: 'All 5 Trust Services Criteria — clean audit', source: 'SOC 2 Report.pdf' },
    },
    {
      heading: 'Relevant Case Study & Proven ROI',
      body: 'IBM Bob\'s most directly comparable deployment is at a Tier-1 global commercial bank — detailed in the enclosed Financial Services Case Study. The engagement involved 250 underwriting and commercial lending specialists across multiple geographies, with Box Content Cloud as the sole document repository [Financial Services Case Study.pdf].\n\nThe IBM team completed the full production rollout in 7.5 weeks. Within 90 days, the bank\'s operations leadership validated the following outcomes against pre-deployment baselines, independently reviewed by their internal audit team.',
      bullets: [
        '85% reduction in commercial onboarding intake: 48 hours → under 15 minutes',
        '86% faster RFP response drafting: 14 business days → 2 business days',
        '99.4% extraction accuracy across complex loan covenant packages',
        '$4.2M verified annual cost savings within 4.5 months of rollout',
        'Zero hallucinations across 12,000+ document reasoning queries in first quarter',
      ],
      keyMetric: { value: '$4.2M', label: 'Verified annual savings at Tier-1 bank', source: 'Financial Services Case Study.pdf' },
    },
    {
      heading: 'Implementation Plan & RACI',
      body: 'IBM proposes an 8-week enterprise fast-track delivery aligned to Acme Bank\'s target launch date. The engagement is structured as four two-week phases with milestone-based governance checkpoints and a fixed RACI framework [Project Delivery Framework.pdf]. No change orders apply to in-scope integrations.\n\nPhase 1 (Weeks 1–2): Dedicated VPC provisioning, SAML SSO configuration (Okta or Azure AD — to be confirmed pending CISO review), and Box MCP connector authorization. Phase 2 (Weeks 3–4): Box folder taxonomy mapping, document indexing across all specified folders, and Salesforce connector configuration. Phase 3 (Weeks 5–6): Agent tuning, 10 benchmark RFP UAT tests against historical responses, and security sign-off review. Phase 4 (Weeks 7–8): Production cutover, user training sessions for 250 commercial specialists, and hypercare support.',
      bullets: [
        'Phase 1 (Wks 1–2): VPC + SSO configuration + Box MCP authorization',
        'Phase 2 (Wks 3–4): Taxonomy mapping, document indexing, Salesforce connector',
        'Phase 3 (Wks 5–6): Agent tuning, UAT with 10 benchmark RFPs, security sign-off',
        'Phase 4 (Wks 7–8): Production cutover, training for 250 users, hypercare support',
        'Fixed-fee structure — no change orders for in-scope integrations',
        'OPEN ITEM: Identity provider confirmation (Okta vs. Azure AD) required before Phase 1',
      ],
    },
    {
      heading: 'Pricing & Commercial Proposal',
      body: 'IBM proposes a transparent, fixed-fee commercial structure with no hidden costs for in-scope Box MCP connectors or standard integrations. The recommended package for 250 enterprise users is outlined below. A three-year enterprise commitment qualifies for a 10% multi-year discount, reducing the total cost of ownership [Pricing Sheets.xlsx].\n\nAll pricing includes 24×7 Premier Support, a dedicated Customer Success Manager for the first 12 months, and full access to the IBM Bob Enterprise feature set including MCP connector, Salesforce integration, and Box Shield classification inheritance.',
      bullets: [
        '8-Week Professional Services Launch Package (PS-ENT-08): $85,000 fixed fee',
        'Annual Enterprise Subscription — 250 users (BOB-ENT-250): $145,000 / year',
        '3-Year Total (with 10% multi-year commitment discount): $475,500',
        '24×7 Premier Support and dedicated Customer Success Manager included',
        'No change orders for in-scope Box MCP, Salesforce, and SSO integrations',
      ],
      keyMetric: { value: '$145K/yr', label: '250-user enterprise subscription (BOB-ENT-250)', source: 'Pricing Sheets.xlsx' },
    },
  ],
  complianceMatrix: [
    { requirement: 'Box Content Cloud MCP Integration', rfpRef: 'Section 2', response: 'Native Model Context Protocol in-memory connector reads Box files on demand with zero persistent local caching.', status: 'meets', sourceRef: 'IBM Bob Product Guide.pdf' },
    { requirement: 'Automated Document Classification', rfpRef: 'Section 2', response: 'AI-powered classification for financial statements, tax forms, COIs, and commercial loan packages upon intake.', status: 'meets', sourceRef: 'IBM Bob Product Guide.pdf' },
    { requirement: 'Bi-directional Salesforce Sales Cloud Sync', rfpRef: 'Section 2', response: 'Pre-built REST API and Webhook connector for bi-directional metadata and document event synchronization.', status: 'meets', sourceRef: 'Architecture Overview.pdf' },
    { requirement: 'SAML 2.0 / OpenID Connect SSO', rfpRef: 'Section 4', response: 'Supports Okta, Azure AD, and PingFederate natively. OPEN ITEM: Okta vs. Azure AD selection pending CISO review.', status: 'partial', sourceRef: 'Technical Requirements.xlsx' },
    { requirement: 'SOC 2 Type II (all 5 TSCs)', rfpRef: 'Section 3', response: 'Clean PwC SOC 2 Type II audit report covering all five Trust Services Criteria. Report available on NDA request.', status: 'meets', sourceRef: 'SOC 2 Report.pdf' },
    { requirement: 'ISO/IEC 27001:2022 Certification', rfpRef: 'Section 3', response: 'Active ISO/IEC 27001:2022 certification with annual third-party renewal cycle.', status: 'meets', sourceRef: 'Security Whitepaper.pdf' },
    { requirement: 'HIPAA BAA (Late Addendum)', rfpRef: 'Addendum A', response: 'Standard HIPAA Business Associate Agreement executed for all AI ingestion pipeline workflows per the late addendum.', status: 'meets', sourceRef: 'Acme Bank - Late Addendum BAA Compliance.pdf' },
    { requirement: 'Zero AI Model Training Data Retention', rfpRef: 'Section 3', response: 'Guaranteed zero retention contractually enforced in standard Enterprise MSA and independently audited under SOC 2.', status: 'meets', sourceRef: 'Security Whitepaper.pdf' },
    { requirement: '99.95% Monthly Uptime SLA', rfpRef: 'Section 5', response: '99.95% monthly uptime commitment with tiered financial service credits for any breach.', status: 'meets', sourceRef: 'SLA Documents.pdf' },
    { requirement: '7-Year Audit Data Retention', rfpRef: 'Section 5', response: 'Supported via Box Governance policy retention binding; OPEN ITEM: confirm against customer 3-year standard policy.', status: 'clarify', sourceRef: 'Legal & Contract Language/SLA Documents.pdf' },
    { requirement: 'Deterministic Citation Provenance', rfpRef: 'Section 2', response: 'Every output anchored to exact Box document ID, page coordinate, and excerpt hash — eliminating hallucinations.', status: 'meets', sourceRef: 'IBM Bob Product Guide.pdf' },
  ],
  slides: [
    { title: 'RFP Response to Acme Bank', subtitle: 'AI-Powered Document Intelligence and Automated Proposal Platform', bullets: ['Prepared for: Acme Bank, N.A., Commercial Lending Division', 'Submitted by: IBM Corporation', 'Proposal: FSS-2026-1187, December 4, 2026', 'Presenter: Jordan Ellis, Vice President, Financial Services Sector'], speakerNotes: 'Thank you to the evaluation committee for the time today. We will spend the next twenty minutes on what we heard from your team, how Bob works, and why we believe it fits your lending operation. We will finish with a live demo on a real loan package.' },
    { title: 'Loan packages wait two days because people sort them by hand', bullets: ['48-hour intake backlog on commercial loan packages', 'Three legacy file shares, no unified search', 'Staff re-key the same data into Salesforce', 'Late HIPAA BAA addendum raises the compliance bar'], speakerNotes: 'This is what David Chen and Rachel Green described to us in discovery. The problem is not that your people are slow; it is that skilled underwriters spend their day opening PDFs and typing the same fields twice. Every day a package sits in the queue is a day a borrower waits for an answer. We built our approach around removing that wait without loosening any control.' },
    { title: 'Bob reads your Box content in place and shows its work', bullets: ['Connects to Box through MCP; nothing is copied out', 'watsonx Granite models tuned for financial documents', 'Inherits your Box permissions and Shield labels', 'Every answer links back to its source page'], speakerNotes: 'The key design choice is that your documents never leave Box. Bob asks for a file when it needs it, reads it in memory, and lets go. Because it inherits the permissions you already manage, an analyst only sees what they could already open. And when Bob gives an answer, you can click through to the exact page it came from, so nobody has to take the model on trust.' },
    { title: 'One loan package, from upload to underwriter, without re-keying', bullets: ['Package lands in Box; Bob classifies every document', 'Key terms and covenants extracted with page citations', 'Checked against credit policy; results sync to Salesforce', 'Next: we run this live on a real package'], speakerNotes: 'Think of a single borrower package with tax returns, insurance certificates and a draft credit agreement. Today someone sorts and tags each file, then types the headline terms into Salesforce. With Bob that work happens as the package arrives, and a person reviews the result rather than producing it. Let us show you rather than tell you, so we will switch to the live demo now.' },
    { title: 'Your data stays yours: certified, encrypted, never used to train', bullets: ['SOC 2 Type II and ISO/IEC 27001:2022 certified', 'AES-256 at rest, TLS 1.3 in transit', 'Zero customer data used to train models', 'HIPAA BAA executed for your late addendum'], speakerNotes: 'We know your InfoSec team will test this slide hardest, so we kept it to the controls they ask about first. The no-training commitment is written into the contract, not just a policy page, and it is covered by our independent audit. You can also bring your own encryption keys if your standards require it. We are happy to take the detailed questionnaire offline with your security reviewers.' },
    { title: 'A top-10 bank cut intake by 90% and saved $3.1M a year', bullets: ['90% reduction in intake time', 'Turnaround from 18 days to 2.5 days', '$3.1M annual savings', 'Same Box-based approach we propose for Acme Bank'], speakerNotes: 'This is a U.S. top-10 commercial bank with a lending operation much like yours, and we cannot name them. They started with a manual intake queue and the same Box repository you use. The gains came from taking classification and data entry off their specialists. We are glad to arrange a reference call once you are ready for that step.' },
    { title: 'Live in 8 weeks for $685K in Year 1', bullets: ['Four two-week phases, fixed fee, no change orders', 'Weeks 1-8: connect, index, tune, train 250 users', 'Year 1 total: $685K, fixed pricing', 'Sign-off from your team at the end of every phase'], speakerNotes: 'We deliberately kept this simple so your sourcing team can compare it line for line. You approve each phase before the next one starts, so you are never committed to more than you have seen working. Because the fee is fixed, the risk of overruns sits with us. We would welcome the chance to agree a kickoff date with you today.' },
  ],
}

export const MOCK_EMAIL = `Subject: IBM Proposal: AI-Powered Document Intelligence Platform for Acme Bank (RFP-2026-DOCAI-04)

Dear Acme Bank Procurement & Evaluation Committee,

On behalf of IBM, please find attached our formal proposal in response to RFP-2026-DOCAI-04 for Acme Bank's AI-Powered Document Intelligence Platform.

Our proposed solution pairs IBM Bob Enterprise with Acme Bank's existing Box Content Cloud via the Model Context Protocol (MCP). This delivers autonomous intake classification, bi-directional Salesforce synchronization, and verified 85% acceleration in commercial proposal workflows—backed by clean SOC 2 Type II certification and full execution of the HIPAA Business Associate Agreement (BAA) specified in your late addendum.

We have also enclosed our 7-slide finalist presentation and would welcome the opportunity to conduct a live architectural walkthrough with your evaluation team.

Sincerely,
Sarah Jenkins
Enterprise Client Executive, IBM Financial Services`
