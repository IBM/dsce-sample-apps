import { BoxDocument } from '../types';

export const SYNTHETIC_BOX_DOCUMENTS: BoxDocument[] = [
  {
    id: 'box-doc-001',
    name: 'Acme_Discovery_Notes.docx',
    type: 'docx',
    size: '142 KB',
    modifiedAt: '2024-09-18T14:32:00Z',
    owner: {
      name: 'Sarah Jenkins',
      role: 'Enterprise Account Executive',
    },
    folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
    summary: 'Discovery meeting notes with VP Ops detailing manual intake friction, multi-repository search challenges, and Salesforce re-entry issues.',
    excerptCount: 4,
    supportedFindingIds: ['pain-manual-class', 'pain-search-friction', 'pain-sf-reentry', 'want-auto-class'],
    metadata: {
      tags: ['Discovery', 'Acme-Q3', 'Onboarding', 'Pain-Points'],
      classification: 'Internal / Confidential',
      department: 'Sales & Customer Success',
      lastSynced: '2 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839210',
    },
    fullContent: `ACME CORP - CUSTOMER ONBOARDING DISCOVERY SESSION
Date: September 18, 2024
Participants: Sarah Jenkins (AE), Marcus Vance (SE), David Chen (Acme VP Ops), Rachel Green (Acme IT Director)

EXECUTIVE SUMMARY:
Acme Corp processes hundreds of new commercial accounts every month. The current onboarding workflow suffers from acute friction due to fragmented content repositories and manual document handling.

KEY PAIN POINTS DISCUSSED:
1. Manual Document Classification: Operations staff manually inspect uploaded PDF/DOCX tax records, certificates of insurance, and contracts to tag them by account and document type. This introduces human error and creates a 48-hour backlog.
2. Disconnected Content Repositories: Onboarding specialists search across three legacy file shares and shared network drives, complaining that "finding historical customer documentation takes 15+ minutes per case."
3. Manual Data Re-entry into Salesforce: Once files are reviewed, ops personnel manually re-type client metadata and validation timestamps into Salesforce account records.
4. Slow Approvals: Approval requests are circulated via email chains without standardized routing rules.

STATED GOALS FOR NEW SOLUTION:
- Implement automated document classification upon intake.
- Enable direct synchronization with Salesforce Sales Cloud to eliminate manual data entry.
- Centralize search across all customer onboarding documentation.
- Provide real-time workflow status visibility.`
  },
  {
    id: 'box-doc-002',
    name: 'Acme_Technical_Requirements.xlsx',
    type: 'xlsx',
    size: '98 KB',
    modifiedAt: '2024-09-22T09:15:00Z',
    owner: {
      name: 'David Chen',
      role: 'Acme IT Lead / Solutions Architect',
    },
    folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
    summary: 'Technical matrix defining Single Sign-On, REST API standards, Role-Based Access Controls (RBAC), and US Data Residency requirements.',
    excerptCount: 4,
    supportedFindingIds: ['req-sso', 'req-rest-api', 'req-rbac', 'req-us-data', 'open-idp'],
    metadata: {
      tags: ['Technical Specs', 'Architecture', 'Security', 'Compliance'],
      classification: 'Confidential',
      department: 'Enterprise Architecture',
      lastSynced: '4 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839211',
    },
    fullContent: `ACME CORP - ENTERPRISE CONTENT PLATFORM TECHNICAL REQUIREMENTS MATRIX
Version: 1.4 | Updated: Sept 22, 2024

REQUIREMENT SPECIFICATIONS:
[REQ-01] Identity & Authentication:
- Single Sign-On (SSO) required for all corporate users.
- Protocol: SAML 2.0 / OpenID Connect.
- Note: Identity provider decision currently evaluating Okta vs. Azure AD (Pending final CISO review).

[REQ-02] Application Programmability:
- Comprehensive REST API availability required for programmatic file uploads, metadata extraction, and workflow status queries.
- Webhook support for asynchronous document event notifications.

[REQ-03] Access Control & Governance:
- Granular Role-Based Access Controls (RBAC) required to separate Front-Office Intake Staff, Underwriting Approvers, and Compliance Auditors.

[REQ-04] Data Residency & Location:
- Strict US Data Residency requirement. All stored content and processing pipelines must remain within continental US data centers.

[REQ-05] Cryptography & Transport:
- Encryption in transit (TLS 1.2+ mandatory, TLS 1.3 preferred) and at rest (AES-256).`
  },
  {
    id: 'box-doc-003',
    name: 'Security_Requirements.pdf',
    type: 'pdf',
    size: '312 KB',
    modifiedAt: '2024-09-25T11:45:00Z',
    owner: {
      name: 'Marcus Vance',
      role: 'Chief Information Security Officer',
    },
    folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
    summary: 'Mandatory CISO security compliance policies covering encryption standards, audit logging, US data residency, and RBAC tiers.',
    excerptCount: 4,
    supportedFindingIds: ['req-encryption', 'req-audit-log', 'req-us-data', 'req-rbac', 'pain-rbac-security'],
    metadata: {
      tags: ['CISO', 'Security', 'Audit-Logging', 'Compliance'],
      classification: 'Restricted',
      department: 'Information Security',
      lastSynced: '5 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839212',
    },
    fullContent: `ACME CORP - INFORMATION SECURITY & COMPLIANCE MANDATE
Document ID: SEC-POL-2024-89 | Approved by: Marcus Vance, CISO

SECURITY REQUIREMENTS:
1. Encryption Standards:
   - Data at Rest: All files, blobs, and metadata indices must be encrypted using AES-256.
   - Data in Transit: Mandatory TLS 1.2 or higher for all client-to-server and server-to-server API endpoints.

2. Audit Logging & Traceability:
   - Comprehensive immutable audit logging is mandatory. System must log document creation, view, metadata modification, permission changes, and download events with timestamp and user ID.

3. Role-Based Permissions & Isolation:
   - Security reviewers require clear, granular role-based access control (RBAC). Document reviewers must only access files within their assigned territory and clearance tier.

4. Data Sovereignty:
   - Zero international data egress. All tenant storage and ingestion services must reside in US-based cloud infrastructure.`
  },
  {
    id: 'box-doc-004',
    name: 'Architecture_Workshop_Notes.docx',
    type: 'docx',
    size: '185 KB',
    modifiedAt: '2024-09-28T16:00:00Z',
    owner: {
      name: 'David Chen',
      role: 'Solutions Architect',
    },
    folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
    summary: 'Technical workshop notes detailing Salesforce bidirectional integration, legacy migration, and metadata synchronization architecture.',
    excerptCount: 4,
    supportedFindingIds: ['want-sf-integration', 'req-sf-integration', 'open-metadata-sor', 'pain-sf-reentry'],
    metadata: {
      tags: ['Architecture', 'Salesforce', 'Integration', 'Metadata'],
      classification: 'Internal Working Draft',
      department: 'Enterprise Architecture',
      lastSynced: '10 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839213',
    },
    fullContent: `ACME CORP - ARCHITECTURE WORKSHOP NOTES: ONBOARDING CONTENT INTEGRATION
Date: September 28, 2024
Lead: David Chen (Acme), Elena Rostova (Lead SE)

SYSTEM BOUNDARIES & INTEGRATION TOPOLOGY:
- Core CRM: Salesforce Sales Cloud (Opportunity & Account records).
- Pain: Operations team currently copies customer onboarding files and manually types metadata fields into custom Salesforce objects.
- Integration Target: When a customer uploads onboarding documents, the content platform must auto-extract key metadata and link the document preview directly inside the Salesforce Account record.

OPEN ARCHITECTURAL QUESTIONS:
1. System of Record for Metadata: Architecture team is debating whether Salesforce or Box should act as the master system of record for custom document metadata (e.g., Customer Tax ID, Verification Status, Expiration Date).
2. Identity Provider: Evaluating if single sign-on should originate from Okta enterprise directory or Azure AD.`
  },
  {
    id: 'box-doc-005',
    name: 'Acme_RFP.pdf',
    type: 'pdf',
    size: '520 KB',
    modifiedAt: '2024-10-02T10:20:00Z',
    owner: {
      name: 'Rachel Green',
      role: 'Director of Procurement & IT',
    },
    folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
    summary: 'Formal Request for Proposal outlining mandatory requirements: automated classification, Salesforce integration, RBAC, approval flows, and audit logs.',
    excerptCount: 5,
    supportedFindingIds: ['want-auto-class', 'want-sf-integration', 'want-approval-flow', 'want-rbac', 'req-audit-log', 'open-retention'],
    metadata: {
      tags: ['RFP', 'Commercial', 'Mandatory-Criteria', 'Scope'],
      classification: 'Commercial Confidential',
      department: 'Procurement',
      lastSynced: '12 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839214',
    },
    fullContent: `REQUEST FOR PROPOSAL (RFP) - ACME CORP CLOUD CONTENT PLATFORM
RFP Reference: RFP-2024-CONTENT-09

SECTION 3: MANDATORY FUNCTIONAL REQUIREMENTS:
3.1 Automated Classification: The platform must automatically classify ingested onboarding collateral (W-9s, Certificate of Incorporation, KYC filings) without manual human labeling.
3.2 Salesforce Integration: Seamless integration with Salesforce CRM, allowing account executives to trigger intake requests and view synchronized document records.
3.3 Approval Workflows: Out-of-the-box streamlined approval workflows with configurable multi-stage escalation and status tracking.
3.4 Role-Based Access Controls: Tiered permissions for Admins, Reviewers, and Viewers.
3.5 Search: Comprehensive full-text search across all indexed customer documents.

SECTION 4: COMPLIANCE & LEGAL:
4.1 Audit Logs: Tamper-evident logging of all user activities.
4.2 Records Retention: Vendor must provide automated document lifecycle and retention scheduling. Note: Acme legal team is currently reviewing corporate records-retention schedules (3 years vs. 7 years).`
  },
  {
    id: 'box-doc-006',
    name: 'Demo_Request.docx',
    type: 'docx',
    size: '115 KB',
    modifiedAt: '2024-10-08T13:40:00Z',
    owner: {
      name: 'Sarah Jenkins',
      role: 'Enterprise Account Executive',
    },
    folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
    summary: 'Sales Engineering briefing for tomorrow’s demo detailing explicit customer requests: Salesforce handoff, role permissions, and live classification.',
    excerptCount: 4,
    supportedFindingIds: ['recent-sf-handoff', 'recent-role-perms', 'recent-class-approval', 'recent-qa-time'],
    metadata: {
      tags: ['Demo-Brief', 'SE-Prep', 'Tomorrow-Meeting', 'High-Priority'],
      classification: 'Internal / AE-SE',
      department: 'Sales Engineering',
      lastSynced: '15 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839215',
    },
    fullContent: `SE DEMO BRIEFING - ACME CORP DEMONSTRATION
Date of Demo: Tomorrow, 10:00 AM EST
Audience: David Chen (IT Lead), Rachel Green (IT Director), Ops Team Leads

RECENT CUSTOMER REQUESTS FOR TOMORROW'S SESSION:
1. Show the Salesforce Handoff: The team wants to see a live demonstration of how an uploaded customer document automatically populates Salesforce and provides seamless access.
2. Demonstrate Role-Specific Permissions: Explicitly show how the interface changes when logged in as an Intake Clerk vs. Underwriting Approver vs. Auditor.
3. Live Classification & Approval Routing: Walk through an actual document being classified and automatically routed to the next reviewer.
4. Leave Adequate Time for Technical Q&A: Reserve at least 15 minutes at the end for architecture, security, and SSO questions.`
  },
  {
    id: 'box-doc-007',
    name: 'Acme_Current_Architecture.pdf',
    type: 'pdf',
    size: '410 KB',
    modifiedAt: '2024-09-15T08:30:00Z',
    owner: {
      name: 'David Chen',
      role: 'Solutions Architect',
    },
    folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
    summary: 'Current-state architecture diagram documenting legacy network shares, Salesforce CRM usage, and fragmented authentication touchpoints.',
    excerptCount: 3,
    supportedFindingIds: ['pain-search-friction', 'req-sf-integration', 'req-sso'],
    metadata: {
      tags: ['Architecture', 'Current-State', 'Diagrams', 'Legacy'],
      classification: 'Internal Architecture',
      department: 'Enterprise Architecture',
      lastSynced: '18 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839216',
    },
    fullContent: `CURRENT STATE SYSTEMS TOPOLOGY - ACME CORP ONBOARDING
Author: David Chen, Solutions Architect

CURRENT APPLICATION LANDSCAPE:
1. Ingestion Point: Customer portal uploads land on legacy on-premise Windows SMB file shares.
2. CRM: Salesforce Sales Cloud (Enterprise Edition) used for lead management and account records.
3. Pain: No native bridge exists between SMB file storage and Salesforce; ops reps spend 2-3 hours daily manually locating files and retyping metadata.
4. Search: Windows indexer fails across network shares, creating search friction across onboarding cases.
5. SSO: Moving towards centralized federated authentication across all corporate cloud services.`
  },
  {
    id: 'box-doc-008',
    name: 'Customer_Workflow_Notes.docx',
    type: 'docx',
    size: '128 KB',
    modifiedAt: '2024-09-20T15:10:00Z',
    owner: {
      name: 'Rachel Green',
      role: 'IT Director',
    },
    folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
    summary: 'Detailed operational breakdown of onboarding document intake bottlenecks, approval delays, and lack of workflow visibility.',
    excerptCount: 3,
    supportedFindingIds: ['pain-slow-approvals', 'pain-visibility', 'want-approval-flow', 'want-status-visibility'],
    metadata: {
      tags: ['Operations', 'Bottlenecks', 'Workflow', 'Approvals'],
      classification: 'Internal Notes',
      department: 'Business Operations',
      lastSynced: '22 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839217',
    },
    fullContent: `CUSTOMER ONBOARDING WORKFLOW ANALYSIS & PAIN POINTS
Documented by Rachel Green, IT Director

OPERATIONAL WORKFLOW BOTTLENECKS:
1. Approval Inconsistencies: Document approvals are sent through ad-hoc Outlook email threads. If a reviewer is out of office, onboarding applications stall for days with zero automated escalation.
2. Lack of Status Visibility: Business users and account managers have no centralized dashboard to check whether a customer's compliance package is pending review, approved, or rejected.
3. Stated Need: A streamlined, automated approval workflow with clear status indicators at every stage of the document lifecycle.`
  },
  {
    id: 'box-doc-009',
    name: 'Integration_Requirements.xlsx',
    type: 'xlsx',
    size: '104 KB',
    modifiedAt: '2024-09-24T14:00:00Z',
    owner: {
      name: 'David Chen',
      role: 'Solutions Architect',
    },
    folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
    summary: 'Technical specifications for Salesforce API endpoints, metadata bidirectional synchronization, and webhook notification payloads.',
    excerptCount: 3,
    supportedFindingIds: ['want-sf-integration', 'req-sf-integration', 'req-rest-api'],
    metadata: {
      tags: ['Salesforce', 'API', 'Webhooks', 'Integration-Specs'],
      classification: 'Technical Working Doc',
      department: 'Enterprise Architecture',
      lastSynced: '25 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839218',
    },
    fullContent: `SALESFORCE INTEGRATION SPECIFICATION & FIELD MAPPINGS
Document Owner: David Chen | Acme Corp Integration Engineering

INTEGRATION CAPABILITIES REQUIRED:
- Salesforce Canvas / Embedded Preview for customer documentation.
- Bidirectional Metadata Sync: Account Number, Verification Status, Ingestion Timestamp.
- REST API Requirements: Standard JSON payloads, OAuth 2.0 JWT bearer token authentication, rate limit minimum 100 requests/sec.
- Webhook Subscriptions: Document Classified, Document Approved, Document Flagged.`
  },
  {
    id: 'box-doc-010',
    name: 'September_Follow_Up_Notes.docx',
    type: 'docx',
    size: '112 KB',
    modifiedAt: '2024-09-30T17:20:00Z',
    owner: {
      name: 'Sarah Jenkins',
      role: 'Enterprise Account Executive',
    },
    folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
    summary: 'Follow-up call notes summarizing discussion on classification accuracy, external partner access, and open identity provider choices.',
    excerptCount: 3,
    supportedFindingIds: ['want-auto-class', 'open-idp', 'open-external-collab'],
    metadata: {
      tags: ['Follow-Up', 'Stakeholders', 'Q3-Notes', 'Open-Items'],
      classification: 'Internal / Confidential',
      department: 'Sales',
      lastSynced: '28 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839219',
    },
    fullContent: `ACME CORP - SEPTEMBER FOLLOW-UP ALIGNMENT CALL
Date: September 30, 2024
Attendees: Sarah Jenkins, Marcus Vance, Rachel Green

DISCUSSION HIGHLIGHTS:
1. Automated Classification: Rachel emphasized that automating classification of onboarding packages is their highest immediate operational goal.
2. External Collaboration: Rachel mentioned that Acme occasionally invites external legal counsel to review high-value contracts, but the exact number of external collaborators is currently unknown and undergoing audit.
3. Identity Provider: Still unresolved whether corporate SSO will standardize on Okta or Microsoft Azure AD.`
  },
  {
    id: 'box-doc-011',
    name: 'Data_Governance_Requirements.pdf',
    type: 'pdf',
    size: '275 KB',
    modifiedAt: '2024-10-04T12:00:00Z',
    owner: {
      name: 'Marcus Vance',
      role: 'Chief Information Security Officer',
    },
    folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
    summary: 'Corporate compliance policies outlining audit trail requirements, data retention ambiguity, and US data sovereignty safeguards.',
    excerptCount: 3,
    supportedFindingIds: ['req-audit-log', 'req-us-data', 'open-retention', 'open-doc-volume'],
    metadata: {
      tags: ['Data-Governance', 'Retention', 'Audit', 'Sovereignty'],
      classification: 'Corporate Policy',
      department: 'Information Security & Legal',
      lastSynced: '30 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839220',
    },
    fullContent: `ACME CORP DATA GOVERNANCE & COMPLIANCE FRAMEWORK
Approved: October 4, 2024 | Version 2.1

GOVERNANCE MANDATES:
1. Audit Logs: Mandatory retention of administrative and access audit logs for a minimum of 365 days.
2. US Data Residency: Strict restriction that data must never leave US regional borders.
3. Open Policy Questions:
   - Corporate Records Retention Schedule: Legal and Compliance teams are evaluating whether onboarding files should be retained for 3 years or 7 years post-account closure.
   - Monthly Ingestion Document Volume: Total monthly ingestion volume across all branches is currently unmetered and pending operational audit.`
  },
  {
    id: 'box-doc-012',
    name: 'Demo_Planning_Email_Summary.docx',
    type: 'docx',
    size: '94 KB',
    modifiedAt: '2024-10-09T08:15:00Z',
    owner: {
      name: 'Sarah Jenkins',
      role: 'Enterprise Account Executive',
    },
    folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
    summary: 'Summary of pre-demo alignment emails with Acme executive team confirming agenda, presentation pacing, and Q&A allocation.',
    excerptCount: 3,
    supportedFindingIds: ['recent-sf-handoff', 'recent-qa-time', 'want-search'],
    metadata: {
      tags: ['Email-Summary', 'Alignment', 'Agenda', 'Demo-Prep'],
      classification: 'Internal Sales Alignment',
      department: 'Sales & Engineering',
      lastSynced: '35 mins ago via Box MCP',
      boxFileId: 'BOX-FILE-8839221',
    },
    fullContent: `PRE-DEMO ALIGNMENT EMAIL SUMMARY - ACME CORP
Compiled by: Sarah Jenkins, Account Executive

EMAIL THREAD SYNOPSIS (Oct 8-9, 2024):
From: David Chen (Acme IT Lead)
To: Sarah Jenkins (AE), Marcus Vance (SE)

"Hi Sarah and team,
For tomorrow's demonstration, our leadership team wants to ensure we cover the Salesforce integration thoroughly. We'd like to see how an onboarding document uploaded by our intake team is indexed, searched, and seamlessly surfaced in Salesforce without manual intervention.

Please keep the presentation crisp (under 20 minutes) and make sure we have at least 15 minutes left for our security architect and IT leads to ask questions on RBAC and encryption."`
  }
];
