import { Finding } from '../types';

export const SYNTHETIC_FINDINGS: Finding[] = [
  // 1. WHAT ACME EXPLICITLY ASKED TO SEE
  {
    id: 'want-auto-class',
    category: 'what_acme_wants_to_see',
    title: 'Automated Document Classification',
    statement: 'Acme explicitly asked for automated classification of uploaded customer documents upon intake.',
    groundedSummary: 'Mentioned across discovery discussions, RFP specifications, and follow-up communications as a core functional requirement.',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (3 sources)',
    supportingSourceCount: 3,
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-010'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Stated Goals for New Solution',
        text: 'Implement automated document classification upon intake to eliminate manual inspection of uploaded PDF/DOCX tax records and contracts.',
        relevanceNote: 'Directly stated as an onboarding goal in initial discovery meeting.'
      },
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 3.1 Mandatory Functional Requirements',
        text: 'The platform must automatically classify ingested onboarding collateral (W-9s, Certificate of Incorporation, KYC filings) without manual human labeling.',
        relevanceNote: 'Documented as mandatory criteria in formal RFP.'
      },
      {
        documentId: 'box-doc-010',
        documentName: 'September_Follow_Up_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Discussion Highlights',
        text: 'Rachel emphasized that automating classification of onboarding packages is their highest immediate operational goal.',
        relevanceNote: 'Reaffirmed in September alignment follow-up call.'
      }
    ]
  },
  {
    id: 'want-sf-integration',
    category: 'what_acme_wants_to_see',
    title: 'Integration with Salesforce',
    statement: 'Acme requires seamless integration with Salesforce Sales Cloud to eliminate manual data re-entry and embed document previews.',
    groundedSummary: 'Supported across four independent documents including architecture workshop notes, RFP, discovery, and integration matrices.',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (4 sources)',
    supportingSourceCount: 4,
    supportingDocumentIds: ['box-doc-001', 'box-doc-004', 'box-doc-005', 'box-doc-009'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Stated Goals for New Solution',
        text: 'Enable direct synchronization with Salesforce Sales Cloud to eliminate manual data entry.',
        relevanceNote: 'Identified as a critical objective during discovery.'
      },
      {
        documentId: 'box-doc-004',
        documentName: 'Architecture_Workshop_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'System Boundaries & Integration Topology',
        text: 'When a customer uploads onboarding documents, the content platform must auto-extract key metadata and link the document preview directly inside the Salesforce Account record.',
        relevanceNote: 'Architectural requirement established during technical workshop.'
      },
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 3.2 Mandatory Functional Requirements',
        text: 'Seamless integration with Salesforce CRM, allowing account executives to trigger intake requests and view synchronized document records.',
        relevanceNote: 'Formal RFP mandatory integration requirement.'
      },
      {
        documentId: 'box-doc-009',
        documentName: 'Integration_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Integration Capabilities Required',
        text: 'Salesforce Canvas / Embedded Preview for customer documentation and bidirectional metadata sync for Account records.',
        relevanceNote: 'Detailed technical specification matrix entry.'
      }
    ]
  },
  {
    id: 'want-rbac',
    category: 'what_acme_wants_to_see',
    title: 'Role-Based Access Controls (RBAC)',
    statement: 'Acme requires tiered role-based access controls to enforce separation of duties between Intake, Review, and Audit teams.',
    groundedSummary: 'Documented in RFP specifications and technical requirements spreadsheet.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-002', 'box-doc-005'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-03 Access Control & Governance',
        text: 'Granular Role-Based Access Controls (RBAC) required to separate Front-Office Intake Staff, Underwriting Approvers, and Compliance Auditors.',
        relevanceNote: 'Technical matrix requirement specification.'
      },
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 3.4 Role-Based Access Controls',
        text: 'Tiered permissions for Admins, Reviewers, and Viewers.',
        relevanceNote: 'RFP mandatory governance criteria.'
      }
    ]
  },
  {
    id: 'want-approval-flow',
    category: 'what_acme_wants_to_see',
    title: 'Streamlined Document Approval Workflow',
    statement: 'Acme requested an automated multi-stage document approval workflow with escalation and tracking.',
    groundedSummary: 'Found in RFP and Customer Workflow operational notes.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-005', 'box-doc-008'],
    excerpts: [
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 3.3 Approval Workflows',
        text: 'Out-of-the-box streamlined approval workflows with configurable multi-stage escalation and status tracking.',
        relevanceNote: 'RFP core workflow capability requirement.'
      },
      {
        documentId: 'box-doc-008',
        documentName: 'Customer_Workflow_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Operational Workflow Bottlenecks',
        text: 'Stated Need: A streamlined, automated approval workflow with clear status indicators at every stage of the document lifecycle.',
        relevanceNote: 'Director of IT operational workflow finding.'
      }
    ]
  },
  {
    id: 'want-search',
    category: 'what_acme_wants_to_see',
    title: 'Unified Search Across Customer Documents',
    statement: 'Acme needs comprehensive full-text and metadata search across all customer onboarding documentation.',
    groundedSummary: 'Referenced in RFP Section 3.5 and pre-demo alignment email summary.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-005', 'box-doc-012'],
    excerpts: [
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 3.5 Search',
        text: 'Comprehensive full-text search across all indexed customer documents.',
        relevanceNote: 'RFP search mandate.'
      },
      {
        documentId: 'box-doc-012',
        documentName: 'Demo_Planning_Email_Summary.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Email Thread Synopsis',
        text: 'We\'d like to see how an onboarding document uploaded by our intake team is indexed, searched, and seamlessly surfaced.',
        relevanceNote: 'Customer leadership requested search demonstration.'
      }
    ]
  },
  {
    id: 'want-status-visibility',
    category: 'what_acme_wants_to_see',
    title: 'Workflow Status Visibility',
    statement: 'Acme requested real-time visibility into the status of onboarding packages and review stages.',
    groundedSummary: 'Documented in Customer Workflow operational analysis.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-008'],
    excerpts: [
      {
        documentId: 'box-doc-008',
        documentName: 'Customer_Workflow_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Operational Workflow Bottlenecks',
        text: 'Business users and account managers have no centralized dashboard to check whether a customer\'s compliance package is pending review, approved, or rejected.',
        relevanceNote: 'Operational finding by IT Director.'
      }
    ]
  },

  // 2. DOCUMENTED PAIN POINTS
  {
    id: 'pain-manual-class',
    category: 'pain_points',
    title: 'Manual Document Classification & Backlog',
    statement: 'Operations staff manually inspect uploaded PDF/DOCX tax records and contracts, introducing human error and causing 48-hour backlogs.',
    groundedSummary: 'Documented in discovery session notes with VP of Operations.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-001'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Key Pain Points Discussed - #1',
        text: 'Operations staff manually inspect uploaded PDF/DOCX tax records, certificates of insurance, and contracts to tag them by account and document type. This introduces human error and creates a 48-hour backlog.',
        relevanceNote: 'Core operational bottleneck captured in discovery notes.'
      }
    ]
  },
  {
    id: 'pain-slow-approvals',
    category: 'pain_points',
    title: 'Slow & Inconsistent Email Approval Workflows',
    statement: 'Approval requests circulate via ad-hoc Outlook email chains with no escalation path, stalling onboarding for days when reviewers are away.',
    groundedSummary: 'Documented in Customer Workflow Notes and Discovery Notes.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-001', 'box-doc-008'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Key Pain Points Discussed - #4',
        text: 'Approval requests are circulated via email chains without standardized routing rules.',
        relevanceNote: 'Noted during initial discovery.'
      },
      {
        documentId: 'box-doc-008',
        documentName: 'Customer_Workflow_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Operational Workflow Bottlenecks - #1',
        text: 'Document approvals are sent through ad-hoc Outlook email threads. If a reviewer is out of office, onboarding applications stall for days with zero automated escalation.',
        relevanceNote: 'Detailed breakdown by IT Director.'
      }
    ]
  },
  {
    id: 'pain-search-friction',
    category: 'pain_points',
    title: 'Search Friction Across Disconnected Repositories',
    statement: 'Onboarding specialists search across three legacy file shares, spending 15+ minutes per case searching for historical documents.',
    groundedSummary: 'Supported across Discovery Notes and Current Architecture documentation.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-001', 'box-doc-007'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Key Pain Points Discussed - #2',
        text: 'Onboarding specialists search across three legacy file shares and shared network drives, complaining that "finding historical customer documentation takes 15+ minutes per case."',
        relevanceNote: 'Reported directly by Acme VP Ops.'
      },
      {
        documentId: 'box-doc-007',
        documentName: 'Acme_Current_Architecture.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Current Application Landscape - #4',
        text: 'Windows indexer fails across network shares, creating search friction across onboarding cases.',
        relevanceNote: 'Architectural documentation from Solutions Architect.'
      }
    ]
  },
  {
    id: 'pain-sf-reentry',
    category: 'pain_points',
    title: 'Manual Data Re-entry into Salesforce',
    statement: 'Operations reps manually copy customer documentation files and re-type client metadata and validation timestamps into Salesforce.',
    groundedSummary: 'Documented in Discovery Notes, Architecture Workshop Notes, and Current Architecture PDF.',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (3 sources)',
    supportingSourceCount: 3,
    supportingDocumentIds: ['box-doc-001', 'box-doc-004', 'box-doc-007'],
    excerpts: [
      {
        documentId: 'box-doc-001',
        documentName: 'Acme_Discovery_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Key Pain Points Discussed - #3',
        text: 'Once files are reviewed, ops personnel manually re-type client metadata and validation timestamps into Salesforce account records.',
        relevanceNote: 'Noted during discovery with operations team.'
      },
      {
        documentId: 'box-doc-004',
        documentName: 'Architecture_Workshop_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'System Boundaries & Integration Topology',
        text: 'Operations team currently copies customer onboarding files and manually types metadata fields into custom Salesforce objects.',
        relevanceNote: 'Identified during technical integration workshop.'
      },
      {
        documentId: 'box-doc-007',
        documentName: 'Acme_Current_Architecture.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Current Application Landscape - #3',
        text: 'No native bridge exists between SMB file storage and Salesforce; ops reps spend 2-3 hours daily manually locating files and retyping metadata.',
        relevanceNote: 'Documented in current-state architecture analysis.'
      }
    ]
  },
  {
    id: 'pain-rbac-security',
    category: 'pain_points',
    title: 'Security Reviewers Need Granular Access Controls',
    statement: 'Security and compliance reviewers lack granular role isolation, creating compliance concerns around sensitive customer data access.',
    groundedSummary: 'Documented in CISO Security Requirements policy.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-003'],
    excerpts: [
      {
        documentId: 'box-doc-003',
        documentName: 'Security_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Section 3 Role-Based Permissions & Isolation',
        text: 'Security reviewers require clear, granular role-based access control (RBAC). Document reviewers must only access files within their assigned territory and clearance tier.',
        relevanceNote: 'CISO formal security mandate requirement.'
      }
    ]
  },
  {
    id: 'pain-visibility',
    category: 'pain_points',
    title: 'Limited Visibility into Workflow & Onboarding Status',
    statement: 'Business teams and account managers lack centralized visibility into whether onboarding documents are pending, approved, or rejected.',
    groundedSummary: 'Documented in Customer Workflow operational analysis.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-008'],
    excerpts: [
      {
        documentId: 'box-doc-008',
        documentName: 'Customer_Workflow_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Operational Workflow Bottlenecks - #2',
        text: 'Business users and account managers have no centralized dashboard to check whether a customer\'s compliance package is pending review, approved, or rejected.',
        relevanceNote: 'Operational bottleneck recorded by IT Director.'
      }
    ]
  },

  // 3. TECHNICAL REQUIREMENTS
  {
    id: 'req-sso',
    category: 'technical_requirements',
    title: 'Single Sign-On (SSO)',
    statement: 'Corporate federated Single Sign-On (SAML 2.0 / OpenID Connect) is required for all enterprise users.',
    groundedSummary: 'Documented in Technical Requirements spreadsheet and Current Architecture overview.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-002', 'box-doc-007'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-01 Identity & Authentication',
        text: 'Single Sign-On (SSO) required for all corporate users. Protocol: SAML 2.0 / OpenID Connect.',
        relevanceNote: 'Technical requirement matrix item.'
      },
      {
        documentId: 'box-doc-007',
        documentName: 'Acme_Current_Architecture.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Current Application Landscape - #5',
        text: 'Moving towards centralized federated authentication across all corporate cloud services.',
        relevanceNote: 'Confirmed in architecture document.'
      }
    ]
  },
  {
    id: 'req-sf-integration',
    category: 'technical_requirements',
    title: 'Salesforce Sales Cloud Integration',
    statement: 'Integration with Salesforce Sales Cloud for embedded document preview, metadata synchronization, and automated intake triggers.',
    groundedSummary: 'Strongly supported across 4 documents (Technical matrix, Workshop notes, Integration specs, Architecture overview).',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (4 sources)',
    supportingSourceCount: 4,
    supportingDocumentIds: ['box-doc-004', 'box-doc-007', 'box-doc-009', 'box-doc-005'],
    excerpts: [
      {
        documentId: 'box-doc-004',
        documentName: 'Architecture_Workshop_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'System Boundaries & Integration Topology',
        text: 'Link the document preview directly inside the Salesforce Account record.',
        relevanceNote: 'Workshop integration architecture decision.'
      },
      {
        documentId: 'box-doc-009',
        documentName: 'Integration_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Integration Capabilities Required',
        text: 'Salesforce Canvas / Embedded Preview for customer documentation and bidirectional metadata sync.',
        relevanceNote: 'Technical spec line item.'
      }
    ]
  },
  {
    id: 'req-rest-api',
    category: 'technical_requirements',
    title: 'REST API Availability & Webhooks',
    statement: 'Comprehensive REST API availability with OAuth 2.0 JWT authentication and webhook event notifications for document milestones.',
    groundedSummary: 'Documented in Technical Requirements and Integration Requirements spreadsheets.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-002', 'box-doc-009'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-02 Application Programmability',
        text: 'Comprehensive REST API availability required for programmatic file uploads, metadata extraction, and workflow status queries. Webhook support for asynchronous document event notifications.',
        relevanceNote: 'API specification requirement.'
      },
      {
        documentId: 'box-doc-009',
        documentName: 'Integration_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Integration Capabilities Required',
        text: 'REST API Requirements: Standard JSON payloads, OAuth 2.0 JWT bearer token authentication, rate limit minimum 100 requests/sec. Webhook Subscriptions: Document Classified, Document Approved, Document Flagged.',
        relevanceNote: 'Technical integration payload specifications.'
      }
    ]
  },
  {
    id: 'req-rbac',
    category: 'technical_requirements',
    title: 'Role-Based Permissions (RBAC)',
    statement: 'Granular role-based permissions defining distinct capabilities for Intake Staff, Approvers, and Auditors.',
    groundedSummary: 'Documented in Technical Requirements and CISO Security Mandate.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-002', 'box-doc-003'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-03 Access Control & Governance',
        text: 'Granular Role-Based Access Controls (RBAC) required to separate Front-Office Intake Staff, Underwriting Approvers, and Compliance Auditors.',
        relevanceNote: 'Specification matrix requirement.'
      },
      {
        documentId: 'box-doc-003',
        documentName: 'Security_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Section 3 Role-Based Permissions & Isolation',
        text: 'Document reviewers must only access files within their assigned territory and clearance tier.',
        relevanceNote: 'Security policy compliance item.'
      }
    ]
  },
  {
    id: 'req-us-data',
    category: 'technical_requirements',
    title: 'US Data Residency Mandate',
    statement: 'Strict US Data Residency requirement with zero international data egress across storage and processing pipelines.',
    groundedSummary: 'Documented across 3 compliance sources (Tech Matrix, Security Policy, Data Governance Framework).',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (3 sources)',
    supportingSourceCount: 3,
    supportingDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-011'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-04 Data Residency & Location',
        text: 'Strict US Data Residency requirement. All stored content and processing pipelines must remain within continental US data centers.',
        relevanceNote: 'Technical matrix residency rule.'
      },
      {
        documentId: 'box-doc-003',
        documentName: 'Security_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Section 4 Data Sovereignty',
        text: 'Zero international data egress. All tenant storage and ingestion services must reside in US-based cloud infrastructure.',
        relevanceNote: 'CISO mandatory policy rule.'
      },
      {
        documentId: 'box-doc-011',
        documentName: 'Data_Governance_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Governance Mandates - #2',
        text: 'Strict restriction that data must never leave US regional borders.',
        relevanceNote: 'Corporate compliance framework.'
      }
    ]
  },
  {
    id: 'req-audit-log',
    category: 'technical_requirements',
    title: 'Comprehensive Audit Logging',
    statement: 'Tamper-evident audit logging for all document actions (create, view, edit, download, permission change) with minimum 365-day retention.',
    groundedSummary: 'Documented across Security Policy, RFP, and Data Governance Framework.',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (3 sources)',
    supportingSourceCount: 3,
    supportingDocumentIds: ['box-doc-003', 'box-doc-005', 'box-doc-011'],
    excerpts: [
      {
        documentId: 'box-doc-003',
        documentName: 'Security_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Section 2 Audit Logging & Traceability',
        text: 'Comprehensive immutable audit logging is mandatory. System must log document creation, view, metadata modification, permission changes, and download events with timestamp and user ID.',
        relevanceNote: 'CISO audit logging policy.'
      },
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 4.1 Compliance & Legal',
        text: 'Tamper-evident logging of all user activities.',
        relevanceNote: 'RFP criteria.'
      },
      {
        documentId: 'box-doc-011',
        documentName: 'Data_Governance_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Governance Mandates - #1',
        text: 'Mandatory retention of administrative and access audit logs for a minimum of 365 days.',
        relevanceNote: 'Data governance guideline.'
      }
    ]
  },
  {
    id: 'req-encryption',
    category: 'technical_requirements',
    title: 'Encryption in Transit & At Rest',
    statement: 'AES-256 encryption at rest and TLS 1.2+ encryption in transit across all endpoints and storage.',
    groundedSummary: 'Documented in CISO Security Mandate and Technical Requirements matrix.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-002', 'box-doc-003'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-05 Cryptography & Transport',
        text: 'Encryption in transit (TLS 1.2+ mandatory, TLS 1.3 preferred) and at rest (AES-256).',
        relevanceNote: 'Technical matrix cryptography standard.'
      },
      {
        documentId: 'box-doc-003',
        documentName: 'Security_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Section 1 Encryption Standards',
        text: 'Data at Rest: All files, blobs, and metadata indices must be encrypted using AES-256. Data in Transit: Mandatory TLS 1.2 or higher for all client-to-server and server-to-server API endpoints.',
        relevanceNote: 'CISO encryption requirement.'
      }
    ]
  },

  // 4. OPEN QUESTIONS (UNRESOLVED)
  {
    id: 'open-doc-volume',
    category: 'open_questions',
    title: 'Expected Monthly Document Volume',
    statement: 'The exact expected monthly ingestion volume across all branches is currently unmetered and pending operational audit.',
    groundedSummary: 'Explicitly marked as an open question in Data Governance Requirements.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-011'],
    excerpts: [
      {
        documentId: 'box-doc-011',
        documentName: 'Data_Governance_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Open Policy Questions',
        text: 'Total monthly ingestion volume across all branches is currently unmetered and pending operational audit.',
        relevanceNote: 'Documented as open data item.'
      }
    ]
  },
  {
    id: 'open-retention',
    category: 'open_questions',
    title: 'Required Records Retention Period',
    statement: 'Acme legal and compliance teams are evaluating whether onboarding files should be retained for 3 years or 7 years post-account closure.',
    groundedSummary: 'Documented in RFP and Data Governance Requirements.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-005', 'box-doc-011'],
    excerpts: [
      {
        documentId: 'box-doc-005',
        documentName: 'Acme_RFP.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Commercial & RFP',
        section: 'Section 4.2 Records Retention',
        text: 'Note: Acme legal team is currently reviewing corporate records-retention schedules (3 years vs. 7 years).',
        relevanceNote: 'RFP notes unresolved retention policy.'
      },
      {
        documentId: 'box-doc-011',
        documentName: 'Data_Governance_Requirements.pdf',
        folderPath: 'All Files / Customers / Acme Corp / Compliance & Security',
        section: 'Open Policy Questions',
        text: 'Legal and Compliance teams are evaluating whether onboarding files should be retained for 3 years or 7 years post-account closure.',
        relevanceNote: 'Governance framework confirms open decision.'
      }
    ]
  },
  {
    id: 'open-external-collab',
    category: 'open_questions',
    title: 'Number of External Collaborators',
    statement: 'The count and frequency of external legal counsel / partner reviewers requiring portal access is currently unconfirmed.',
    groundedSummary: 'Noted in September Follow-Up call notes.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-010'],
    excerpts: [
      {
        documentId: 'box-doc-010',
        documentName: 'September_Follow_Up_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Discussion Highlights - #2',
        text: 'Rachel mentioned that Acme occasionally invites external legal counsel to review high-value contracts, but the exact number of external collaborators is currently unknown and undergoing audit.',
        relevanceNote: 'Stakeholder call noted external access volume is unknown.'
      }
    ]
  },
  {
    id: 'open-idp',
    category: 'open_questions',
    title: 'Final Identity Provider Selection',
    statement: 'Acme is actively evaluating whether corporate SSO will standardize on Okta or Microsoft Azure AD.',
    groundedSummary: 'Documented across Technical Requirements, Architecture Workshop Notes, and Follow-Up Notes.',
    strength: 'strongly_supported',
    strengthLabel: 'Strongly Supported (3 sources)',
    supportingSourceCount: 3,
    supportingDocumentIds: ['box-doc-002', 'box-doc-004', 'box-doc-010'],
    excerpts: [
      {
        documentId: 'box-doc-002',
        documentName: 'Acme_Technical_Requirements.xlsx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'REQ-01 Identity & Authentication',
        text: 'Identity provider decision currently evaluating Okta vs. Azure AD (Pending final CISO review).',
        relevanceNote: 'Technical matrix note.'
      },
      {
        documentId: 'box-doc-004',
        documentName: 'Architecture_Workshop_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Open Architectural Questions - #2',
        text: 'Identity Provider: Evaluating if single sign-on should originate from Okta enterprise directory or Azure AD.',
        relevanceNote: 'Architecture workshop discussion item.'
      },
      {
        documentId: 'box-doc-010',
        documentName: 'September_Follow_Up_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Discovery Notes',
        section: 'Discussion Highlights - #3',
        text: 'Still unresolved whether corporate SSO will standardize on Okta or Microsoft Azure AD.',
        relevanceNote: 'Confirmed as unresolved in September alignment.'
      }
    ]
  },
  {
    id: 'open-metadata-sor',
    category: 'open_questions',
    title: 'System of Record for Document Metadata',
    statement: 'The architecture team is debating whether Salesforce or Box should act as the master system of record for custom document metadata fields.',
    groundedSummary: 'Documented in Architecture Workshop Notes.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-004'],
    excerpts: [
      {
        documentId: 'box-doc-004',
        documentName: 'Architecture_Workshop_Notes.docx',
        folderPath: 'All Files / Customers / Acme Corp / Architecture & Tech',
        section: 'Open Architectural Questions - #1',
        text: 'System of Record for Metadata: Architecture team is debating whether Salesforce or Box should act as the master system of record for custom document metadata (e.g., Customer Tax ID, Verification Status, Expiration Date).',
        relevanceNote: 'Workshop architectural question for SE team to address.'
      }
    ]
  },

  // 5. RECENT CUSTOMER REQUESTS
  {
    id: 'recent-sf-handoff',
    category: 'recent_requests',
    title: 'Show the Salesforce Handoff During Demo',
    statement: 'Acme leadership specifically requested a live demonstration showing how an uploaded onboarding document automatically surfaces inside Salesforce.',
    groundedSummary: 'Highlighted in Demo Request briefing and Pre-Demo Alignment Email Summary.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-006', 'box-doc-012'],
    excerpts: [
      {
        documentId: 'box-doc-006',
        documentName: 'Demo_Request.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Recent Customer Requests - #1',
        text: 'Show the Salesforce Handoff: The team wants to see a live demonstration of how an uploaded customer document automatically populates Salesforce and provides seamless access.',
        relevanceNote: 'Direct SE demo request item.'
      },
      {
        documentId: 'box-doc-012',
        documentName: 'Demo_Planning_Email_Summary.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Email Thread Synopsis',
        text: 'For tomorrow\'s demonstration, our leadership team wants to ensure we cover the Salesforce integration thoroughly.',
        relevanceNote: 'Customer leadership email request.'
      }
    ]
  },
  {
    id: 'recent-role-perms',
    category: 'recent_requests',
    title: 'Demonstrate Role-Specific Permissions',
    statement: 'Show how the interface, editing rights, and viewing scopes differ when logged in as Intake Clerk vs. Approver vs. Auditor.',
    groundedSummary: 'Documented in SE Demo Request briefing.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-006'],
    excerpts: [
      {
        documentId: 'box-doc-006',
        documentName: 'Demo_Request.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Recent Customer Requests - #2',
        text: 'Demonstrate Role-Specific Permissions: Explicitly show how the interface changes when logged in as an Intake Clerk vs. Underwriting Approver vs. Auditor.',
        relevanceNote: 'Requested for tomorrow\'s demo.'
      }
    ]
  },
  {
    id: 'recent-class-approval',
    category: 'recent_requests',
    title: 'Live Example of Document Classification & Routing',
    statement: 'Walk through an actual customer onboarding file being classified in real time and automatically routed to the next reviewer.',
    groundedSummary: 'Documented in SE Demo Request briefing.',
    strength: 'supported',
    strengthLabel: 'Supported (1 source)',
    supportingSourceCount: 1,
    supportingDocumentIds: ['box-doc-006'],
    excerpts: [
      {
        documentId: 'box-doc-006',
        documentName: 'Demo_Request.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Recent Customer Requests - #3',
        text: 'Live Classification & Approval Routing: Walk through an actual document being classified and automatically routed to the next reviewer.',
        relevanceNote: 'SE briefing key demo step.'
      }
    ]
  },
  {
    id: 'recent-qa-time',
    category: 'recent_requests',
    title: 'Reserve 15 Minutes for Architecture & Security Q&A',
    statement: 'Keep presentation crisp under 20 minutes and preserve at least 15 minutes for technical Q&A with CISO and IT leads.',
    groundedSummary: 'Documented in Demo Request and Alignment Email Summary.',
    strength: 'supported',
    strengthLabel: 'Supported (2 sources)',
    supportingSourceCount: 2,
    supportingDocumentIds: ['box-doc-006', 'box-doc-012'],
    excerpts: [
      {
        documentId: 'box-doc-006',
        documentName: 'Demo_Request.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Recent Customer Requests - #4',
        text: 'Leave Adequate Time for Technical Q&A: Reserve at least 15 minutes at the end for architecture, security, and SSO questions.',
        relevanceNote: 'SE scheduling guideline.'
      },
      {
        documentId: 'box-doc-012',
        documentName: 'Demo_Planning_Email_Summary.docx',
        folderPath: 'All Files / Customers / Acme Corp / Sales Alignment',
        section: 'Email Thread Synopsis',
        text: 'Please keep the presentation crisp (under 20 minutes) and make sure we have at least 15 minutes left for our security architect and IT leads to ask questions.',
        relevanceNote: 'Customer leadership requested timeline.'
      }
    ]
  },

  // 6. DEPRIORITIZED CAPABILITIES (EXPLICITLY LABELED AS NOT FOUND IN EVIDENCE)
  {
    id: 'deprioritized-video-canvas',
    category: 'deprioritized',
    title: 'Real-Time Canvas & Video Transcoding Features',
    statement: 'Features such as interactive whiteboard canvas and media streaming transcoding were not mentioned in any Acme Box documentation.',
    groundedSummary: 'Not emphasized because supporting customer evidence was not found in available Box content.',
    strength: 'not_found',
    strengthLabel: 'Not Found in Content (0 sources)',
    supportingSourceCount: 0,
    supportingDocumentIds: [],
    excerpts: [],
    insufficientEvidence: true,
    missingInfoNote: 'No discovery notes, RFP sections, or architecture documents requested video transcoding or whiteboard canvas features.'
  }
];
