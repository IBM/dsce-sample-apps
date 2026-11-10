import { DemoPlanStep } from '../types';

export const SYNTHETIC_DEMO_PLAN_STEPS: DemoPlanStep[] = [
  {
    stepNumber: 1,
    title: 'Introduce Acme\'s Current Onboarding Workflow Context',
    actionToDemonstrate: 'Frame the session around Acme\'s high-volume commercial onboarding intake and acknowledge the legacy file share bottleneck.',
    presenterTalkingPoint: '“We know your operations team processes hundreds of commercial accounts each month across disconnected repositories, leading to a 48-hour backlog and duplicate data entry into Salesforce.”',
    whyItMattersToAcme: 'Validates that we understand their specific operational reality and sets up the onboarding solution as directly addressing their 48-hour backlog.',
    supportingDocumentIds: ['box-doc-001', 'box-doc-007'],
    suggestedTransition: '“Let\'s look at how seamless this becomes when an intake specialist receives a new onboarding packet.”',
    durationMinutes: 2,
    category: 'Context & Framing'
  },
  {
    stepNumber: 2,
    title: 'Upload Sample Customer Onboarding Document',
    actionToDemonstrate: 'Drop a multi-page customer onboarding package (W-9, Certificate of Insurance, Articles of Incorporation) into the intake workspace.',
    presenterTalkingPoint: '“Notice how the intake specialist simply drops the raw customer package into Box. No manual folder hunting or preliminary renaming needed.”',
    whyItMattersToAcme: 'Directly addresses the friction described in discovery where staff searched across three separate legacy file shares.',
    supportingDocumentIds: ['box-doc-001', 'box-doc-005'],
    suggestedTransition: '“The moment this file lands, automated intelligence takes over.”',
    durationMinutes: 2,
    category: 'Ingestion'
  },
  {
    stepNumber: 3,
    title: 'Demonstrate Automated Document Classification',
    actionToDemonstrate: 'Show Box automatically identifying the document type (Commercial Tax W-9), extracting key metadata (Tax ID, Entity Name, Expiration Date), and applying governance tags.',
    presenterTalkingPoint: '“Box instantly classifies this document as a verified W-9 and extracts key fields without human tagging—eliminating the manual classification step Rachel identified as your biggest bottleneck.”',
    whyItMattersToAcme: 'Directly fulfills RFP Section 3.1 and eliminates the manual classification pain point documented by VP Ops and IT Director.',
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-010'],
    suggestedTransition: '“Once classified, the document immediately initiates the required approval path.”',
    durationMinutes: 3,
    category: 'AI & Automation'
  },
  {
    stepNumber: 4,
    title: 'Route Document Through Streamlined Approval Workflow',
    actionToDemonstrate: 'Trigger an automated approval task assigned to Underwriting, showing real-time task notifications, escalation timers, and audit trail generation.',
    presenterTalkingPoint: '“Instead of untracked Outlook email threads that stall when someone is out of office, approvals are assigned with built-in escalation rules and a tamper-evident audit trail.”',
    whyItMattersToAcme: 'Solves the email bottleneck highlighted in Customer Workflow Notes and meets CISO audit trail standards.',
    supportingDocumentIds: ['box-doc-003', 'box-doc-005', 'box-doc-008'],
    suggestedTransition: '“Now, let\'s see what happens simultaneously inside your CRM.”',
    durationMinutes: 3,
    category: 'Workflow'
  },
  {
    stepNumber: 5,
    title: 'Show the Live Salesforce Handoff',
    actionToDemonstrate: 'Switch to the Salesforce Account view. Show the newly classified document instantly linked in the Box Salesforce Canvas component with synchronized metadata.',
    presenterTalkingPoint: '“Here inside Salesforce Sales Cloud, the account record is automatically updated. Account reps see the verified document preview directly inside their account screen with zero manual re-entry.”',
    whyItMattersToAcme: 'Fulfills the #1 demo request from David Chen and solves the 2-3 hours daily spent re-typing metadata.',
    supportingDocumentIds: ['box-doc-004', 'box-doc-006', 'box-doc-009', 'box-doc-012'],
    suggestedTransition: '“Let\'s see how permissions protect this sensitive customer information across different roles.”',
    durationMinutes: 3,
    category: 'Integration'
  },
  {
    stepNumber: 6,
    title: 'Demonstrate Role-Based Access Controls (RBAC)',
    actionToDemonstrate: 'Toggle between Intake Specialist (upload & edit metadata), Approver (review & approve), and External Auditor (view-only watermarked preview).',
    presenterTalkingPoint: '“Marcus and the security team require strict role isolation. Notice how an Intake Specialist cannot approve files, while an external auditor sees watermarked previews without export permissions.”',
    whyItMattersToAcme: 'Directly responds to CISO security policies and David Chen\'s SE briefing request.',
    supportingDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-006'],
    suggestedTransition: '“Now let\'s look at how teams track progress and search across customer accounts.”',
    durationMinutes: 2,
    category: 'Security & Governance'
  },
  {
    stepNumber: 7,
    title: 'Show Document Search & Workflow-Status Visibility',
    actionToDemonstrate: 'Perform full-text search across indexed onboarding packages and view the centralized workflow status dashboard.',
    presenterTalkingPoint: '“Managers have full visibility into every onboarding stage—Approved, Pending Review, or Flagged—and can search across all historical files in seconds instead of 15 minutes per case.”',
    whyItMattersToAcme: 'Fulfills RFP Section 3.5 and resolves the visibility gap documented in Workflow Notes.',
    supportingDocumentIds: ['box-doc-001', 'box-doc-005', 'box-doc-008'],
    suggestedTransition: '“Let\'s reserve the remaining time to address your architecture and governance questions.”',
    durationMinutes: 2,
    category: 'Search & Visibility'
  },
  {
    stepNumber: 8,
    title: 'Close with Unresolved Architecture & Security Questions',
    actionToDemonstrate: 'Open technical architecture slide / validation matrix to confirm IdP preference (Okta vs. Azure AD), retention policies, and data residency.',
    presenterTalkingPoint: '“We\'ve reserved our final 15 minutes to review technical validation items: our native Okta/Azure AD SAML integration, AES-256 US-only data residency, and confirming your document retention schedule.”',
    whyItMattersToAcme: 'Honors the customer request to leave 15 minutes for CISO and IT questions, positioning the team as consultative and prepared.',
    supportingDocumentIds: ['box-doc-002', 'box-doc-003', 'box-doc-006', 'box-doc-012'],
    suggestedTransition: '“Open the floor for David Chen and Marcus Vance to ask questions.”',
    durationMinutes: 3,
    category: 'Architecture & Q&A'
  }
];

export const DEMO_CONFIRMATION_QUESTIONS = [
  {
    topic: 'Expected Monthly Document Volume',
    question: '“What is your estimated monthly document ingestion volume across all regional onboarding branches?”',
    whyToAsk: 'Unmetered in current documents; needed for precise API rate sizing and tenant capacity planning.',
    relatedDoc: 'Data_Governance_Requirements.pdf'
  },
  {
    topic: 'Records Retention Period Schedule',
    question: '“Has legal finalized whether onboarding records must be retained for 3 years or 7 years following account closure?”',
    whyToAsk: 'Both 3-year and 7-year options were noted in RFP and Data Governance drafts.',
    relatedDoc: 'Acme_RFP.pdf & Data_Governance_Requirements.pdf'
  },
  {
    topic: 'External Collaborator Volume',
    question: '“How many external legal counsel or partner reviewers will require guest portal access each month?”',
    whyToAsk: 'Noted as undergoing audit in September follow-up call.',
    relatedDoc: 'September_Follow_Up_Notes.docx'
  },
  {
    topic: 'Final Identity Provider Selection',
    question: '“Has your CISO finalized the enterprise IdP standard between Okta and Microsoft Azure AD?”',
    whyToAsk: 'Both are supported via SAML 2.0; confirming the selection finalizes SSO configuration details.',
    relatedDoc: 'Acme_Technical_Requirements.xlsx'
  },
  {
    topic: 'Metadata System of Record Master',
    question: '“For custom account metadata, should Salesforce or Box serve as the authoritative system of record?”',
    whyToAsk: 'Architectural debate highlighted in Architecture Workshop Notes.',
    relatedDoc: 'Architecture_Workshop_Notes.docx'
  }
];

export const DEPRIORITIZED_CAPABILITIES_NOTICE = [
  {
    capability: 'Real-Time Collaborative Whiteboard Canvas',
    reason: 'Not emphasized because supporting customer evidence was not found in available Box content.',
    guidance: 'Avoid spending time demonstrating freeform drawing or brainstorming tools during this onboarding demo.'
  },
  {
    capability: 'Video & Audio Transcoding Pipelines',
    reason: 'Not emphasized because supporting customer evidence was not found in available Box content.',
    guidance: 'Acme\'s documented scope is strictly PDF/DOCX/XLSX commercial onboarding documentation.'
  },
  {
    capability: 'Custom E-Signature Design Templates',
    reason: 'Not emphasized because supporting customer evidence was not found in available Box content.',
    guidance: 'Focus on automated document classification and Salesforce sync instead.'
  }
];
