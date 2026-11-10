import { TechnicalValidationItem, FollowUpQuestionItem } from '../types';

export const DEMO_SCRIPT_CONTENT = `ACME CORP - TAILORED CUSTOMER DEMONSTRATION SCRIPT
Estimated Duration: 18 Minutes (Presentation: 12 min | Technical Q&A: 6+ min)
Presenter: Lead Sales Engineer | Solution: Box Content Cloud + IBM Bob
Target Stakeholders: David Chen (IT Lead), Rachel Green (IT Director), Marcus Vance (CISO Office)

================================================================================
PART 1: WELCOME & THE ACME ONBOARDING CHALLENGE (2 MIN)
================================================================================
[Visual: Slide / Architecture Summary - Current vs. Target State]
PRESENTER:
"Good morning, David, Rachel, and team. Thank you for joining us today.

When we reviewed your onboarding operations, one clear theme emerged: Acme processes hundreds of commercial accounts every month, but your teams are wrestling with fragmented network shares, a 48-hour classification backlog, and hours spent manually re-entering document data into Salesforce.

Today, we're going to demonstrate exactly how Box and IBM Bob eliminate that friction. We'll show you an end-to-end flow: from raw intake, to automated AI classification, streamlined approval routing, and instantaneous Salesforce synchronization."

================================================================================
PART 2: INGESTION & AUTOMATED CLASSIFICATION (3 MIN)
================================================================================
[Visual: Box Intake Portal - Customer Upload Dropzone]
PRESENTER:
"Let's start where your intake specialists work. When a new customer package arrives—like this commercial tax form and business license—the specialist simply uploads the files to Box.

[Action: Drop Acme_Commercial_W9_Packet.pdf into intake folder]

Notice what happens immediately: Box doesn't just store the file. Through automated classification, Box analyzes the document structure, identifies it as an IRS Form W-9, and extracts key metadata fields—like the Employer Identification Number, Legal Entity Name, and Expiration Date—with zero manual labeling required.

Rachel, this is the exact capability you requested in the RFP to eliminate that 48-hour backlog."

================================================================================
PART 3: APPROVAL ROUTING & AUDIT TRAIL (2.5 MIN)
================================================================================
[Visual: Box Relay / Workflow Task Panel]
PRESENTER:
"Because this document is classified as a high-tier onboarding asset, Box automatically triggers your standardized underwriting approval workflow.

[Action: Show Underwriting Review Task with automated escalation rules]

Instead of untracked Outlook email threads where cases get lost when reviewers are out of office, the approver receives an actionable task with clear deadlines. Every view, edit, and approval decision is immutably logged into Box's tamper-evident audit trail—meeting Marcus's mandatory 365-day compliance standard."

================================================================================
PART 4: THE LIVE SALESFORCE HANDOFF (3.5 MIN)
================================================================================
[Visual: Salesforce Sales Cloud Account View - Acme Commercial Account]
PRESENTER:
"Now let's switch over to Salesforce Sales Cloud, where your account executives and customer success reps live.

[Action: Open Salesforce Account Record -> Box Embedded Canvas Component]

Without anyone typing a single line of metadata or uploading duplicate files, the account record is instantly synchronized. The account manager sees the verified document preview right inside Salesforce, complete with extracted metadata badges and real-time approval status.

David, this directly eliminates the 2 to 3 hours daily your ops team spent manually locating files and retyping data."

================================================================================
PART 5: GRANULAR ROLE-BASED ACCESS CONTROLS (2 MIN)
================================================================================
[Visual: Box Permissions & Role Simulation]
PRESENTER:
"Let's touch on security. Marcus's team mandated strict RBAC. Watch what happens when I switch roles:
- As an Intake Clerk, I can upload files but cannot approve or modify governance policies.
- As an Underwriting Approver, I have review and sign-off authority.
- And if an external legal auditor needs temporary access, they receive a view-only, dynamic watermarked preview with downloading restricted. All stored with AES-256 encryption in US data centers."

================================================================================
PART 6: TRANSITION TO TECHNICAL VALIDATION & Q&A (5+ MIN)
================================================================================
[Visual: Technical Validation Matrix]
PRESENTER:
"To wrap up our demonstration and respect the 15 minutes we reserved for David and Marcus: we've pre-validated your requirements for REST APIs, SAML Single Sign-On, and US Data Residency. Let's open the floor to address your specific IdP selection and records retention schedules."
`;

export const PRESENTER_TALKING_POINTS = [
  {
    topic: 'Automated Document Classification',
    talkingPoint: '“Box extracts taxonomy and metadata immediately upon intake, eliminating the 48-hour classification backlog mentioned in discovery.”',
    supportingSources: ['Acme_Discovery_Notes.docx', 'Acme_RFP.pdf', 'September_Follow_Up_Notes.docx'],
    category: 'AI & Automation'
  },
  {
    topic: 'Salesforce CRM Integration',
    talkingPoint: '“Document previews and extracted metadata sync directly into Salesforce Account objects, eliminating 2-3 hours of daily manual re-entry.”',
    supportingSources: ['Acme_Discovery_Notes.docx', 'Architecture_Workshop_Notes.docx', 'Integration_Requirements.xlsx'],
    category: 'CRM & Systems'
  },
  {
    topic: 'Approval Workflows & Audit Logs',
    talkingPoint: '“Configurable workflow routing with automated escalations replaces untracked Outlook email threads and satisfies CISO audit trail mandates.”',
    supportingSources: ['Security_Requirements.pdf', 'Customer_Workflow_Notes.docx'],
    category: 'Governance'
  },
  {
    topic: 'Role-Based Access Controls (RBAC)',
    talkingPoint: '“Intake staff, underwriting approvers, and external auditors operate with distinct least-privilege permission tiers and dynamic watermarking.”',
    supportingSources: ['Acme_Technical_Requirements.xlsx', 'Security_Requirements.pdf', 'Demo_Request.docx'],
    category: 'Security'
  },
  {
    topic: 'US Data Residency & Encryption',
    talkingPoint: '“All content and ingestion pipelines are encrypted via AES-256 and TLS 1.2+, strictly bound to continental US regional infrastructure.”',
    supportingSources: ['Acme_Technical_Requirements.xlsx', 'Security_Requirements.pdf', 'Data_Governance_Requirements.pdf'],
    category: 'Compliance'
  }
];

export const TECHNICAL_VALIDATION_CHECKLIST: TechnicalValidationItem[] = [
  {
    id: 'val-sso',
    requirement: 'Single Sign-On (SAML 2.0 / OpenID Connect)',
    status: 'documented',
    sourceDocumentIds: ['box-doc-002', 'box-doc-007'],
    notes: 'Documented in Tech Matrix REQ-01 and Current Architecture. Ready for Okta or Azure AD federation.',
    category: 'Security'
  },
  {
    id: 'val-sf',
    requirement: 'Salesforce Sales Cloud Bi-directional Integration',
    status: 'documented',
    sourceDocumentIds: ['box-doc-004', 'box-doc-005', 'box-doc-009'],
    notes: 'Documented in RFP 3.2, Architecture Workshop, and Integration Matrix. Embedded canvas + REST sync.',
    category: 'Integration'
  },
  {
    id: 'val-rest',
    requirement: 'REST APIs & Webhooks for Asynchronous Events',
    status: 'documented',
    sourceDocumentIds: ['box-doc-002', 'box-doc-009'],
    notes: 'Documented in Tech Matrix REQ-02 and Integration Matrix. Minimum 100 req/sec rate limit supported.',
    category: 'Architecture'
  },
  {
    id: 'val-rbac',
    requirement: 'Granular Role-Based Access Controls (RBAC)',
    status: 'documented',
    sourceDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-005'],
    notes: 'Documented in CISO Mandate and Tech Matrix. Segregation of Intake, Review, and Audit tiers.',
    category: 'Security'
  },
  {
    id: 'val-us-residency',
    requirement: 'Strict US Data Residency (Zero International Egress)',
    status: 'documented',
    sourceDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-011'],
    notes: 'Documented in CISO Mandate and Data Governance. US-only data center regions enforced.',
    category: 'Compliance'
  },
  {
    id: 'val-audit',
    requirement: 'Tamper-Evident Audit Logging (365-Day Minimum)',
    status: 'documented',
    sourceDocumentIds: ['box-doc-003', 'box-doc-005', 'box-doc-011'],
    notes: 'Documented in CISO Mandate and RFP 4.1. Comprehensive immutable event logging.',
    category: 'Compliance'
  },
  {
    id: 'val-encryption',
    requirement: 'AES-256 At Rest & TLS 1.2+ In Transit Cryptography',
    status: 'documented',
    sourceDocumentIds: ['box-doc-002', 'box-doc-003'],
    notes: 'Documented in CISO Mandate and Tech Matrix REQ-05.',
    category: 'Security'
  },
  {
    id: 'val-volume',
    requirement: 'Monthly Ingestion Document Volume & Tenant Sizing',
    status: 'needs_confirmation',
    sourceDocumentIds: ['box-doc-011'],
    notes: 'Unresolved in Data Governance framework. Needs confirmation during architecture Q&A.',
    category: 'Operations'
  },
  {
    id: 'val-retention',
    requirement: 'Automated Records Retention Schedule (3 Years vs. 7 Years)',
    status: 'needs_confirmation',
    sourceDocumentIds: ['box-doc-005', 'box-doc-011'],
    notes: 'Unresolved in RFP Section 4.2 and Data Governance. Legal review in progress.',
    category: 'Compliance'
  },
  {
    id: 'val-metadata-sor',
    requirement: 'System of Record for Custom Document Metadata',
    status: 'needs_confirmation',
    sourceDocumentIds: ['box-doc-004'],
    notes: 'Architecture team debating Salesforce vs. Box as authoritative master.',
    category: 'Architecture'
  }
];

export const FOLLOW_UP_QUESTIONS: FollowUpQuestionItem[] = [
  {
    category: 'Business Process',
    question: 'How many distinct document subtypes are processed in high-volume commercial onboarding beyond W-9s and certificates of insurance?',
    context: 'To ensure automated classification models are seeded with appropriate training schemas.',
    relevantStakeholder: 'Rachel Green (IT Director) / Ops Leads'
  },
  {
    category: 'Architecture',
    question: 'For custom metadata attributes (e.g., Tax ID, Verification Timestamp), has the team agreed on whether Salesforce or Box serves as the master record?',
    context: 'Architecture workshop noted ongoing discussion on metadata ownership.',
    relevantStakeholder: 'David Chen (Solutions Architect)'
  },
  {
    category: 'Security',
    question: 'Has CISO Marcus Vance confirmed the final federated identity provider standard (Okta vs. Azure AD)?',
    context: 'Both SAML connectors are ready; confirming will streamline sandbox SSO provisioning.',
    relevantStakeholder: 'Marcus Vance (CISO)'
  },
  {
    category: 'Integration',
    question: 'Are there custom Salesforce objects or third-party CRM plugins that need real-time webhook subscriptions when documents are approved?',
    context: 'To finalize webhook payload specifications from Integration_Requirements.xlsx.',
    relevantStakeholder: 'David Chen (Integration Engineering)'
  },
  {
    category: 'Operations',
    question: 'What is Acme\'s expected monthly document ingestion volume across all regional branches during peak periods?',
    context: 'To benchmark tenant throughput and API rate limits.',
    relevantStakeholder: 'Rachel Green (Director of IT & Procurement)'
  }
];
