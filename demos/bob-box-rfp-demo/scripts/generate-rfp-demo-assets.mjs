import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderDocx, renderPdf, renderXlsx, renderText } from './mock-documents/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const boxRoot = path.join(root, 'Box_Upload_Folder');

const RENDER = { docx: renderDocx, pdf: renderPdf, xlsx: renderXlsx };

const documents = [];

// ============================================================================
// 1. PAST RFP RESPONSES
// ============================================================================

documents.push({
  dir: 'Past RFP Responses',
  file: 'Banking RFP Response - Chase.pdf',
  kind: 'pdf',
  spec: {
    title: 'Formal RFP Response - Enterprise AI Document Intelligence Platform',
    author: 'IBM Software Solutions - Global Financial Services Practice',
    subject: 'JPMorgan Chase & Co. - Commercial Banking RFP-2024-AI-088',
    header: 'IBM / JPMorgan Chase & Co. | Commercial Confidential RFP Response',
    footer: 'Confidential - IBM Corporation & JPMorgan Chase & Co.',
    blocks: [
      {
        type: 'title',
        text: 'PROPOSAL RESPONSE: ENTERPRISE AI DOCUMENT INTELLIGENCE & CONTEXTUAL REASONING PLATFORM',
        subtitle: 'Prepared for JPMorgan Chase & Co. Commercial Banking & Asset Management Operations',
      },
      {
        type: 'meta',
        rows: [
          ['Client Name', 'JPMorgan Chase & Co.'],
          ['RFP Reference', 'RFP-2024-AI-088 (Commercial Document Intelligence)'],
          ['Submitting Entity', 'IBM Corporation - Hybrid Cloud & AI Practice'],
          ['Proposed Platform', 'IBM Bob Enterprise Edition (with Box Content Cloud MCP Connector)'],
          ['Submission Date', 'June 18, 2024'],
          ['Security Clearance', 'Banking Tier-1 Confidential / Non-Public Financial Data'],
        ],
      },
      { type: 'h1', text: '1. Executive Summary' },
      {
        type: 'p',
        text: 'IBM is pleased to present **IBM Bob Enterprise** to JPMorgan Chase & Co. as the enterprise-grade AI document intelligence and agentic workflow platform. Financial institutions manage millions of unstructured documents annually—including loan covenants, syndicated credit agreements, KYC packages, and regulatory filings. IBM Bob directly connects to Chase’s existing Box Content Cloud via the **Model Context Protocol (MCP)**, delivering agentic document reasoning, deterministic extraction, and automated proposal/RFP drafting with zero data retention for model training.',
      },
      {
        type: 'callout',
        label: 'Key Value Proposition:',
        text: 'Combines deep IBM agentic AI with Box’s single content layer, reducing commercial loan review cycles from **48 hours to under 15 minutes** while ensuring 100% adherence to FINRA, OCC, and SEC regulatory standards.',
      },
      { type: 'h1', text: '2. Technical Architecture & Box Integration' },
      {
        type: 'p',
        text: 'IBM Bob connects directly to Box repositories using high-throughput, secure MCP connectors. When processing inbound document packages or generating structured responses, Bob executes deterministic multi-step reasoning:',
      },
      {
        type: 'ul',
        items: [
          '**Model Context Protocol (MCP) Boundary:** Secure, token-scoped in-memory execution connecting to Box folders, metadata templates, and Box Shield classification tags.',
          '**Hybrid AI Engine:** Powered by IBM watsonx Granite enterprise models optimized for financial document parsing, tabular data extraction, and cross-reference synthesis.',
          '**Zero-Hallucination Guardrails:** Every generated answer is anchored to specific Box document IDs, page coordinates, and exact sentence excerpts.',
          '**Enterprise RBAC Mirroring:** Inherits Box user permissions and Active Directory/PingFederate SAML groups in real time.',
        ],
      },
      { type: 'h1', text: '3. Security, Encryption & Regulatory Compliance' },
      {
        type: 'table',
        head: ['Control Domain', 'JPMC Requirement', 'IBM Bob Specification', 'Compliance Status'],
        rows: [
          ['Encryption at Rest', 'AES-256 with CMEK support', 'FIPS 140-3 validated AES-256; Customer-Managed Encryption Keys via IBM Key Protect / Box Shield', 'Compliant'],
          ['Encryption in Transit', 'TLS 1.2+ mandatory (TLS 1.3 preferred)', 'Strict TLS 1.3 enforced on all REST / gRPC / MCP endpoints; mTLS between microservices', 'Compliant'],
          ['Data Retention Policy', 'Zero AI model training on customer data', 'Zero customer data used for base model training or fine-tuning; ephemeral in-memory tokenization only', 'Compliant'],
          ['Audit Logging', '365-day immutable audit trail', 'Detailed SIEM export (Splunk/QRadar) with user attribution, document IDs accessed, and exact prompts', 'Compliant'],
          ['Certifications', 'SOC 2 Type II, ISO 27001, PCI-DSS', 'SOC 2 Type II (all 5 Trust Criteria), ISO/IEC 27001:2022, ISO 27701 (Privacy)', 'Compliant'],
        ],
        widths: [20, 25, 40, 15],
      },
      { type: 'h1', text: '4. Proposed Implementation Methodology' },
      {
        type: 'p',
        text: 'IBM proposes an **8-week Enterprise Fast-Track Delivery Roadmap** comprising four structured 2-week sprints:',
      },
      {
        type: 'ol',
        items: [
          '**Sprint 1-2 (Foundation & IAM):** Provision dedicated VPC, configure Box MCP enterprise OAuth 2.0 app, and bind PingFederate SAML 2.0 SSO.',
          '**Sprint 3-4 (Taxonomy & Folder Grounding):** Ingest and index Chase commercial lending templates, regulatory knowledge bases, and credit policy manuals in Box.',
          '**Sprint 5-6 (Agent Customization & UAT):** Deploy customized prompt pipelines for loan covenant extraction, automated RFP generation, and KYC cross-checking.',
          '**Sprint 7-8 (Production Go-Live & Enablement):** Security sign-off, SOC monitoring integration, and enablement workshops for 250 commercial loan underwriters.',
        ],
      },
    ],
  },
});

documents.push({
  dir: 'Past RFP Responses',
  file: 'Healthcare RFP Response - Kaiser.docx',
  kind: 'docx',
  spec: {
    title: 'RFP Response - Clinical Protocol & Administrative Document Intelligence',
    author: 'IBM Healthcare & Life Sciences Practice Group',
    subject: 'Kaiser Permanente RFP-2024-MED-0412',
    header: 'IBM / Kaiser Permanente | Health Systems Confidential',
    footer: 'Confidential - IBM Corporation & Kaiser Foundation Hospitals',
    blocks: [
      {
        type: 'title',
        text: 'HEALTHCARE RFP RESPONSE: CLINICAL & ADMINISTRATIVE DOCUMENT INTELLIGENCE',
        subtitle: 'Enterprise AI Assistance Grounded in Box Health Content Cloud',
      },
      {
        type: 'meta',
        rows: [
          ['Client Name', 'Kaiser Permanente Health Plan & Hospitals'],
          ['RFP Reference', 'RFP-2024-MED-0412'],
          ['Solution', 'IBM Bob Healthcare Edition (HIPAA BAA Compliant)'],
          ['Lead Architect', 'Dr. Marcus Vance, MD, Chief Healthcare AI Architect, IBM'],
          ['Submission Date', 'August 14, 2024'],
        ],
      },
      { type: 'h1', text: '1. Executive Overview & Healthcare Context' },
      {
        type: 'p',
        text: 'Kaiser Permanente requires an intelligent document platform capable of reviewing clinical trial reports, prior authorization requests, provider credentialing packages, and payer contracts stored in Box. **IBM Bob Healthcare Edition** pairs state-of-the-art document intelligence with strict HIPAA, HITECH, and HITRUST compliance controls.',
      },
      { type: 'h1', text: '2. HIPAA / BAA Compliance & PHI Safeguards' },
      {
        type: 'ul',
        items: [
          '**Executed Business Associate Agreement (BAA):** Full HIPAA BAA coverage across all compute, storage, and agent execution runtimes.',
          '**Automated PHI De-identification:** Built-in Safe Harbor / Expert Determination redaction filters that strip 18 HIPAA identifiers before prompt evaluation.',
          '**Granular Clinical Access Control:** Role-Based Access Control (RBAC) synchronized directly with Epic/Cerner provider roles and Box clinical folder access policies.',
        ],
      },
      { type: 'h1', text: '3. Solution Capabilities' },
      {
        type: 'table',
        head: ['Healthcare Use Case', 'Clinical Workflow', 'IBM Bob AI Action', 'Measurable Impact'],
        rows: [
          ['Prior Authorization Review', 'Review complex 80-page medical history charts', 'Extract ICD-10/CPT codes and compare against clinical criteria', '72% faster turnaround'],
          ['Provider Credentialing', 'Verify medical licenses, DEA certs, malpractice insurance', 'Cross-match credentials against state medical board databases', 'Zero manual entry errors'],
          ['RFP & Grant Proposals', 'Draft responses to state health authority tenders', 'Synthesize past RFP responses, quality metrics, and clinical outcomes', '80% faster draft creation'],
        ],
        widths: [22, 28, 35, 15],
      },
      { type: 'h1', text: '4. Implementation Approach & Clinical Governance' },
      {
        type: 'p',
        text: 'Our 10-week clinical onboarding methodology ensures zero disruption to provider workflows. Dedicated clinical validation gates require MD oversight before automated summaries are committed to system of record.',
      },
    ],
  },
});

documents.push({
  dir: 'Past RFP Responses',
  file: 'Government Procurement Response.docx',
  kind: 'docx',
  spec: {
    title: 'Technical & Security Proposal - Federal Content Intelligence Platform',
    author: 'IBM Federal Systems Practice',
    subject: 'GSA Schedule 70 - Federal Procurement RFP-FED-2024-099',
    header: 'IBM Federal | Commercial & Government Confidential',
    footer: 'GSA Schedule 70 Contract - IBM Federal Systems',
    blocks: [
      {
        type: 'title',
        text: 'FEDERAL PROCUREMENT PROPOSAL: AGENCY-WIDE CONTENT INTELLIGENCE & POLICY ANALYSIS',
        subtitle: 'Prepared under GSA Multiple Award Schedule (MAS) - IT Category',
      },
      {
        type: 'meta',
        rows: [
          ['Procuring Agency', 'U.S. General Services Administration (GSA) & Partner Agencies'],
          ['Solicitation Number', 'RFP-FED-2024-099 / Contract GS-35F-110DA'],
          ['Offered Solution', 'IBM Bob GovCloud / Dedicated Sovereign Edition'],
          ['Clearance Level', 'FedRAMP High Ready / NIST SP 800-53 Rev 5 Moderate/High'],
        ],
      },
      { type: 'h1', text: '1. Executive Summary' },
      {
        type: 'p',
        text: 'IBM Federal offers **IBM Bob Dedicated Sovereign Edition**, designed specifically for federal agencies requiring secure AI reasoning over massive document corpora stored in Box GovCloud. IBM Bob enables contract officers and policy analysts to query thousands of FAR/DFARS regulations, inter-agency agreements, and procurement histories in natural language.',
      },
      { type: 'h1', text: '2. Federal Security & Statutory Compliance' },
      {
        type: 'ul',
        items: [
          '**FedRAMP High Baseline:** Implements all 421 NIST SP 800-53 Rev 5 security controls across access control, audit, incident response, and system integrity.',
          '**FIPS 140-3 Cryptography:** End-to-end hardware-backed encryption with FIPS 140-3 Level 3 HSM modules for key storage.',
          '**US Sovereign Operations:** 100% US-based infrastructure maintained exclusively by US citizens with active background clearances.',
          '**Section 508 Accessibility:** Full compliance with WCAG 2.1 Level AA and Section 508 federal accessibility standards.',
        ],
      },
      { type: 'h1', text: '3. Proposed Delivery Milestone Schedule' },
      {
        type: 'table',
        head: ['Milestone', 'Deliverable Item', 'Target Window', 'Acceptance Authority'],
        rows: [
          ['M-1', 'System Security Plan (SSP) & Architecture Review', 'Day 15', 'Agency ISSO'],
          ['M-2', 'Box GovCloud MCP Connector Integration & ATO Verification', 'Day 30', 'Lead Security Assessor'],
          ['M-3', 'FAR/DFARS Knowledge Repository Ingestion & Grounding', 'Day 45', 'Procurement Officer'],
          ['M-4', 'Production Deployment & User Training for 500 Contracting Specialists', 'Day 60', 'Program Manager'],
        ],
        widths: [15, 45, 18, 22],
      },
    ],
  },
});

// ============================================================================
// 2. SECURITY & COMPLIANCE DOCUMENTS
// ============================================================================

documents.push({
  dir: 'Security & Compliance Documents',
  file: 'SOC 2 Report.pdf',
  kind: 'pdf',
  spec: {
    title: 'SOC 2 Type II Independent Service Auditor’s Assurance Report',
    author: 'PricewaterhouseCoopers LLP (Independent Auditor)',
    subject: 'Report on Controls Relevant to Security, Availability, and Confidentiality',
    header: 'PwC Independent Audit Report | IBM Bob Cloud Services',
    footer: 'SOC 2 Type II Confidential - For Client Due Diligence Use Only',
    blocks: [
      {
        type: 'title',
        text: 'SERVICE ORGANIZATION CONTROL (SOC 2) TYPE II AUDIT REPORT',
        subtitle: 'Independent Auditor’s Report on Controls Relevant to Security, Availability, and Confidentiality',
      },
      {
        type: 'meta',
        rows: [
          ['Service Organization', 'IBM Corporation (IBM Bob Cloud Services Platform)'],
          ['Independent Auditor', 'PricewaterhouseCoopers LLP (PwC)'],
          ['Audit Period', 'January 1, 2024 through December 31, 2024'],
          ['Trust Services Criteria', 'Security (Common Criteria), Availability, Confidentiality, Privacy'],
          ['Audit Opinion', 'Unqualified (Clean Opinion) - Zero Material Exceptions'],
        ],
      },
      { type: 'h1', text: 'Section I: Independent Service Auditor’s Report' },
      {
        type: 'p',
        text: 'In our opinion, in all material respects: (a) The accompanying description fairly presents the IBM Bob Enterprise Platform system that was designed and implemented throughout the audit period; (b) The controls stated in the description were suitably designed to provide reasonable assurance that the service commitments and system requirements were achieved based on the Trust Services Criteria; and (c) The controls tested operated effectively throughout the period.',
      },
      { type: 'h1', text: 'Section II: Trust Services Criteria Control Summary' },
      {
        type: 'table',
        head: ['TSC Reference', 'Control Description', 'Testing Procedure', 'Auditor Result'],
        rows: [
          ['CC6.1 - Logical Access', 'Multi-factor authentication (MFA) and RBAC enforced on all production boundaries.', 'Inspected 100% of engineer access logs and IAM policies.', 'No exception noted'],
          ['CC6.6 - Boundary Protection', 'Firewalls, WAF, and private VPC peering isolate Box MCP connectors from public Internet.', 'Executed external network penetration test & configuration audits.', 'No exception noted'],
          ['CC6.7 - Data Transmission', 'TLS 1.3 enforced for data in transit; deprecated cipher suites blocked.', 'Verified TLS cipher configurations across all load balancers.', 'No exception noted'],
          ['CC6.8 - Data at Rest', 'AES-256 encryption enforced across all persistent volumes and ephemeral token stores.', 'Inspected KMS key rotation logs and automated encryption policies.', 'No exception noted'],
          ['CC7.2 - Incident Monitoring', '24/7 Security Operations Center (SOC) with automated SIEM alerting within 15 min.', 'Tested simulated breach drills and incident response logs.', 'No exception noted'],
          ['CC8.1 - Change Management', 'Automated CI/CD with mandatory peer reviews and automated SAST/DAST gating.', 'Sampled 65 production release pull requests and test tickets.', 'No exception noted'],
        ],
        widths: [20, 35, 30, 15],
      },
      { type: 'h1', text: 'Section III: Service Organization Assertion' },
      {
        type: 'p',
        text: 'IBM management confirms that system boundaries, security controls, and data privacy safeguards remained continuously active, monitored, and compliant throughout the entire reporting period.',
      },
    ],
  },
});

documents.push({
  dir: 'Security & Compliance Documents',
  file: 'ISO 27001 Certification.pdf',
  kind: 'pdf',
  spec: {
    title: 'ISO/IEC 27001:2022 Certificate of Registration & Statement of Applicability',
    author: 'BSI Group (British Standards Institution) - Accredited Registrar',
    subject: 'Information Security Management System (ISMS) Certification',
    header: 'BSI Certification Body | ISO/IEC 27001:2022 Certificate',
    footer: 'Official Certificate - BSI Accredited Information Security Register',
    blocks: [
      {
        type: 'title',
        text: 'CERTIFICATE OF REGISTRATION: ISO/IEC 27001:2022',
        subtitle: 'Information Security Management System (ISMS) - IBM Bob Platform',
      },
      {
        type: 'meta',
        rows: [
          ['Certificate Number', 'ISMS-IBM-BOB-99281'],
          ['Certified Entity', 'IBM Corporation - Hybrid Cloud & AI Document Systems'],
          ['Standard', 'ISO/IEC 27001:2022 (Information Security, Cybersecurity & Privacy)'],
          ['Issuing Registrar', 'BSI Assurance UK Limited (ANAB & UKAS Accredited)'],
          ['Issue Date / Expiry', 'March 15, 2024 / March 14, 2027 (Annual Surveillance Audits)'],
        ],
      },
      { type: 'h1', text: 'Scope of Registration' },
      {
        type: 'p',
        text: 'The Information Security Management System (ISMS) covers the architecture, software development, cloud infrastructure hosting, data ingestion pipelines, Model Context Protocol (MCP) connectors to Box Content Cloud, and global 24/7 technical support for the **IBM Bob Enterprise Platform**.',
      },
      { type: 'h1', text: 'Annex A Control Implementation Highlights' },
      {
        type: 'table',
        head: ['Annex A Domain', 'Standard Control Description', 'IBM Bob Technical Implementation'],
        rows: [
          ['A.5 Organizational Controls', 'Policies for information security, threat intelligence, supplier relationships.', 'Formal quarterly ISMS reviews; strict third-party vendor risk assessments.'],
          ['A.6 People Controls', 'Screening, background checks, security awareness training.', 'Annual mandatory cybersecurity training; background screening for 100% of personnel.'],
          ['A.7 Physical Controls', 'Physical security perimeters, equipment protection.', 'Hosted exclusively in Tier III+ / Tier IV enterprise datacenters with biometric controls.'],
          ['A.8.20 Network Security', 'Network controls, segmentation, security of network services.', 'Zero-trust network architecture; private VPC endpoints; strict egress firewall rules.'],
          ['A.8.24 Cryptography', 'Cryptographic controls and key management policies.', 'AES-256 for all stored data; TLS 1.3 in transit; automated envelope key rotation.'],
          ['A.8.28 Secure Coding', 'Secure software development life cycle (SSDLC).', 'Automated static code analysis (SAST), software composition analysis, and container image scans.'],
          ['A.8.31 Separation of Envs', 'Separation of development, testing and operational environments.', 'Physically and logically isolated VPC environments; zero customer data in test environments.'],
        ],
        widths: [24, 36, 40],
      },
    ],
  },
});

documents.push({
  dir: 'Security & Compliance Documents',
  file: 'Security Whitepaper.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Security, Architecture & Trust Whitepaper',
    author: 'IBM Security & AI Ethics Office',
    subject: 'Technical Architecture, Cryptography, and Zero-Data-Retention Safeguards',
    header: 'IBM Security Whitepaper | IBM Bob Platform Architecture',
    footer: 'IBM Corporation 2025 - Security & Trust Architecture',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: SECURITY, PRIVACY & ARCHITECTURE WHITEPAPER',
        subtitle: 'Enterprise-Grade Defense-in-Depth for AI Document Intelligence & Box Integration',
      },
      {
        type: 'meta',
        rows: [
          ['Document Version', 'Version 3.4 (Enterprise Edition)'],
          ['Target Audience', 'Chief Information Security Officers (CISOs), Security Architects, Compliance Officers'],
          ['Authoring Group', 'IBM Cybersecurity & AI Governance Directorate'],
          ['Classification', 'Public Whitepaper / Approved for Customer Due Diligence'],
        ],
      },
      { type: 'h1', text: '1. Core Security Architecture Principles' },
      {
        type: 'p',
        text: 'IBM Bob is engineered on a foundation of **zero trust**, **zero model training on customer data**, and **evidence-first deterministic execution**. Unlike consumer AI systems that ingest and retain user prompts to update public weights, IBM Bob enforces absolute data isolation.',
      },
      {
        type: 'callout',
        label: 'Mandatory Policy:',
        text: 'Under no circumstances are customer documents, prompts, or generated responses retained to train, fine-tune, or improve foundation models. Ingestion is 100% ephemeral and in-memory.',
      },
      { type: 'h1', text: '2. Model Context Protocol (MCP) Security Model' },
      {
        type: 'p',
        text: 'The Box MCP connector establishes a cryptographically secure, least-privilege boundary between the Bob execution engine and Box Content Cloud:',
      },
      {
        type: 'ul',
        items: [
          '**Ephemeral Token Scoping:** Bob queries Box using short-lived OAuth 2.0 access tokens scoped strictly to the requesting user’s permission context.',
          '**In-Memory Context Window:** Document pages retrieved for reasoning exist only during execution and are immediately zeroized in memory upon completion.',
          '**Box Shield Integration:** Bob respects Box Shield classification labels (e.g., Restricted, Confidential, PII) and enforces downstream DLP policies.',
          '**Deterministic Provenance:** Every statement generated contains a verifiable hash linking back to the originating Box file ID and chunk coordinate.',
        ],
      },
      { type: 'h1', text: '3. Threat Modeling & Continuous Testing' },
      {
        type: 'p',
        text: 'IBM conducts continuous red-team exercises, weekly dynamic vulnerability assessments, and independent third-party penetration tests. All code undergoes automated SAST, dependency vulnerability scanning (Mend/Snyk), and container image verification against Red Hat UBI minimal baselines.',
      },
    ],
  },
});

documents.push({
  dir: 'Security & Compliance Documents',
  file: 'Data Privacy Documentation.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Global Data Privacy, Governance & Regulatory Compliance Guide',
    author: 'IBM Chief Privacy Office',
    subject: 'GDPR, CCPA, CPRA, HIPAA, and Cross-Border Data Residency Architecture',
    header: 'IBM Privacy Office | Global Data Protection Guide',
    footer: 'Confidential - IBM Privacy & Regulatory Compliance',
    blocks: [
      {
        type: 'title',
        text: 'GLOBAL DATA PRIVACY & REGULATORY COMPLIANCE GUIDE',
        subtitle: 'Enterprise Data Sovereignty, PII Protection & Cross-Border Frameworks',
      },
      {
        type: 'meta',
        rows: [
          ['Compliance Frameworks', 'GDPR (EU 2016/679), CCPA/CPRA (California), HIPAA/HITECH, PIPEDA (Canada)'],
          ['Data Residency Options', 'US Sovereign (Dedicated AWS/IBM Cloud Gov), EU Frankfurt/Paris, UK London, APAC Sydney/Tokyo'],
          ['Data Processor Role', 'IBM acts strictly as Data Processor; Customer retains 100% Data Controller authority'],
        ],
      },
      { type: 'h1', text: '1. Data Sovereignty & Regional VPC Pinning' },
      {
        type: 'p',
        text: 'Enterprise customers can pin their IBM Bob runtime and Box connector to specific geographic regions. Customer data never crosses regional boundaries. For US banking and federal accounts, all processing occurs within US sovereign data centers managed exclusively by US personnel.',
      },
      { type: 'h1', text: '2. PII / Sensitive Data Handling' },
      {
        type: 'ul',
        items: [
          '**Real-Time PII Masking:** Automated identification and tokenization of SSNs, credit card numbers, Tax IDs, and dates of birth.',
          '**Data Subject Access Requests (DSAR):** Full programmatic support for GDPR Articles 15-20 (Right to Access, Rectification, and Erasure).',
          '**Sub-Processor Transparency:** Complete listing of vetted sub-processors with contractual guarantees mirroring primary customer terms.',
        ],
      },
      { type: 'h1', text: '3. Data Transfer Impact Assessment (DTIA)' },
      {
        type: 'p',
        text: 'IBM provides comprehensive pre-completed DTIAs and EU Standard Contractual Clauses (SCCs) to facilitate customer cross-border regulatory filings with national data protection authorities.',
      },
    ],
  },
});

// ============================================================================
// 3. PRODUCT DOCUMENTATION
// ============================================================================

documents.push({
  dir: 'Product Documentation',
  file: 'IBM Bob Product Guide.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Enterprise Product Guide - Agentic Document Intelligence',
    author: 'IBM Product Management & Engineering',
    subject: 'Product Capabilities, Architecture, and Agent Workflows',
    header: 'IBM Bob Product Guide | Enterprise Edition',
    footer: 'IBM Corporation 2025 - Product Guide',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: PRODUCT & CAPABILITIES GUIDE',
        subtitle: 'Agentic Document Intelligence, Knowledge Synthesis & Enterprise Workflow Automation',
      },
      {
        type: 'meta',
        rows: [
          ['Product Name', 'IBM Bob Enterprise Edition'],
          ['Version', 'Release 2025.2 (LTS)'],
          ['Primary Connectors', 'Box Content Cloud (MCP), Salesforce CRM, ServiceNow, Jira, REST API'],
          ['Supported Modalities', 'PDF, DOCX, XLSX, PPTX, Scanned OCR, Structured JSON/XML, Markdown'],
        ],
      },
      { type: 'h1', text: '1. What is IBM Bob?' },
      {
        type: 'p',
        text: '**IBM Bob** is an agentic AI platform designed to transform unstructured enterprise repositories into actionable intelligence, automated responses, and structured workflows. Unlike simple search engines or conversational chatbots, Bob functions as an autonomous reasoning agent that can investigate large document collections, cross-reference multiple conflicting sources, synthesize findings, and produce finished, evidence-backed deliverables.',
      },
      { type: 'h1', text: '2. Key Functional Capabilities' },
      {
        type: 'ul',
        items: [
          '**Autonomous Knowledge Synthesis:** Reads across dozens of past RFPs, security whitepapers, product manuals, and case studies stored in Box to assemble complete proposal responses.',
          '**Deterministic Evidence Attribution:** Links every extracted claim, metric, and paragraph directly to its original source file in Box with page-level citations.',
          '**Multi-Modal Document Parsing:** Processes complex tables, embedded charts, forms, and multi-column layouts across PDF, Office, and scanned documents.',
          '**Interactive Simulator & Prototype Builder:** Converts customer requirements into functioning workflow prototypes and validation checklists in seconds.',
          '**Model Context Protocol (MCP) Integration:** Communicates seamlessly with Box and other enterprise systems using open, standardized agent protocols.',
        ],
      },
      { type: 'h1', text: '3. Admin & Governance Controls' },
      {
        type: 'p',
        text: 'IBM Bob Enterprise provides comprehensive administrative controls including spending limits, role-based access management (User vs. Admin), team budgeting, audit logging, and private tenant isolation.',
      },
    ],
  },
});

documents.push({
  dir: 'Product Documentation',
  file: 'Feature Documentation.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Feature Specification & Functional Capability Matrix',
    author: 'IBM Product Engineering',
    subject: 'Technical Feature Breakdown and API Specification',
    header: 'IBM Bob Feature Matrix | Enterprise Capabilities',
    footer: 'IBM Corporation 2025 - Feature Specification',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB: DETAILED FEATURE SPECIFICATION & CAPABILITY MATRIX',
        subtitle: 'Comprehensive Breakdown of Document Intelligence, Ingestion & Generation Modules',
      },
      {
        type: 'meta',
        rows: [
          ['Module Count', '6 Core Enterprise Modules'],
          ['API Standards', 'OpenAPI 3.1, Model Context Protocol (MCP) v1.0, GraphQL, gRPC'],
          ['Supported File Formats', 'PDF, DOCX, XLSX, PPTX, TXT, CSV, JSON, TIFF, PNG, JPEG'],
        ],
      },
      { type: 'h1', text: '1. Document Ingestion & Parsing Engine' },
      {
        type: 'table',
        head: ['Feature Name', 'Description', 'Supported Envs', 'Latency SLA'],
        rows: [
          ['Box MCP Streaming Ingestion', 'Direct stream ingestion of Box files with zero local disk caching.', 'Cloud / Hybrid / Gov', '< 250ms per doc'],
          ['Complex Table Reconstruction', 'Reconstructs merged-cell financial tables and multi-column spreadsheets.', 'All platforms', '< 500ms per table'],
          ['OCR & Scanned Document AI', 'Extracts text and key-value pairs from scanned PDFs and images.', 'Cloud / On-Prem', '< 1.2s per page'],
          ['Classification & Tagging', 'Auto-classifies files by document type (RFP, MSA, SOC2, Financial).', 'All platforms', '< 150ms per doc'],
        ],
        widths: [25, 45, 15, 15],
      },
      { type: 'h1', text: '2. Agentic Reasoning & Response Generation' },
      {
        type: 'table',
        head: ['Feature Name', 'Description', 'Accuracy Benchmark'],
        rows: [
          ['Automated RFP Drafting', 'Generates 50+ page RFP response drafts across executive summary, technical, security, and case study sections.', '99.4% factual accuracy'],
          ['Evidence Grounding Engine', 'Attaches clickable Box deep-links, page numbers, and exact sentence snippets to every answer.', '100% verifiable citations'],
          ['Conflict Detection', 'Identifies discrepancies across multiple document versions (e.g. outdated vs current SLAs).', 'Automated warning flags'],
          ['Gap Analysis & Missing Info', 'Flags missing requirements or unsupported questions with explicit "Insufficient Evidence" notices.', 'Zero hallucination guardrail'],
        ],
        widths: [25, 55, 20],
      },
    ],
  },
});

documents.push({
  dir: 'Product Documentation',
  file: 'Architecture Overview.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob System Architecture & MCP Integration Blueprint',
    author: 'IBM Office of the Chief Architect',
    subject: 'System Architecture, Security Enclaves, and Box MCP Integration',
    header: 'IBM Systems Architecture | Bob Platform Topology',
    footer: 'IBM Corporation 2025 - Architecture Blueprint',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB: SYSTEM ARCHITECTURE & INTEGRATION BLUEPRINT',
        subtitle: 'High-Availability Cloud Architecture, Agent Orchestration & Box MCP Gateway',
      },
      {
        type: 'meta',
        rows: [
          ['Architecture Pattern', 'Distributed Microservices / Agentic Orchestration Layer / MCP Gateway'],
          ['Deployment Options', 'Multi-Tenant SaaS (Isolated VPCs), Single-Tenant Dedicated, Sovereign GovCloud'],
          ['High Availability Target', '99.95% SLA with Multi-AZ Active-Active Failover'],
        ],
      },
      { type: 'h1', text: '1. Architectural Topology Overview' },
      {
        type: 'p',
        text: 'The IBM Bob platform comprises four decoupled, highly scalable architectural layers:',
      },
      {
        type: 'ul',
        items: [
          '**Client & Presentation Tier:** Web UI, IDE extensions, CLI tools, and embedded Salesforce/Box UI components communicating over TLS 1.3.',
          '**Agent Orchestration Engine:** Multi-agent coordinator managing task decomposition, reasoning loops, evidence synthesis, and subagent delegation.',
          '**Model Context Protocol (MCP) Gateway:** Secure bridge managing bidirectional communication between Bob agents and enterprise data sources like Box Content Cloud.',
          '**watsonx Enterprise Foundation Layer:** Enterprise model routing supporting IBM Granite, specialized fine-tuned financial models, and customer-hosted LLMs with zero data retention.',
        ],
      },
      { type: 'h1', text: '2. Data Flow & Security Boundary' },
      {
        type: 'p',
        text: 'When a user requests an RFP response, the agent queries Box via MCP. Box returns encrypted document chunks. Bob performs in-memory reasoning, validates evidence citations against the document hash, and renders the output deliverable. No document content is written to disk or used in background retraining.',
      },
    ],
  },
});

documents.push({
  dir: 'Product Documentation',
  file: 'FAQ.docx',
  kind: 'docx',
  spec: {
    title: 'IBM Bob Frequently Asked Questions (FAQ)',
    author: 'IBM Technical Sales & Solutions Enablement',
    subject: 'Technical, Security, Operational and Procurement FAQs',
    header: 'IBM Bob FAQ | Technical & Commercial Enablement',
    footer: 'IBM Corporation 2025 - Frequently Asked Questions',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: FREQUENTLY ASKED QUESTIONS (FAQ)',
        subtitle: 'Answers to Common Technical, Security, Architecture & Licensing Questions',
      },
      {
        type: 'h1',
        text: '1. General & Architecture Questions',
      },
      {
        type: 'p',
        text: '**Q: What makes IBM Bob different from general-purpose generative AI tools?**\n**A:** IBM Bob is built specifically for enterprise software engineering and document intelligence. It does not simply generate generic prose; it uses the Model Context Protocol (MCP) to read directly from your authorized Box repositories, verifies every factual claim against original source files, and produces verifiable, citation-backed deliverables with zero hallucination.',
      },
      {
        type: 'p',
        text: '**Q: How does Bob connect to our Box instance?**\n**A:** Bob connects via the Model Context Protocol (MCP) using standard OAuth 2.0 or Custom Box App Service Accounts. The connection respects all existing Box access permissions, folder hierarchies, and Box Shield security classifications.',
      },
      {
        type: 'h1',
        text: '2. Security & Data Privacy Questions',
      },
      {
        type: 'p',
        text: '**Q: Is our company data used to train AI models?**\n**A:** Absolutely not. IBM adheres to strict enterprise data protection principles. Your prompts, document contents, and generated responses are never used to train or fine-tune public or base foundation models.',
      },
      {
        type: 'p',
        text: '**Q: What compliance certifications does IBM Bob maintain?**\n**A:** IBM Bob is SOC 2 Type II certified (Security, Availability, Confidentiality, Privacy), ISO/IEC 27001:2022 certified, HIPAA BAA ready, and aligns with NIST SP 800-53 standards.',
      },
      {
        type: 'h1',
        text: '3. RFP Generation & Accuracy Questions',
      },
      {
        type: 'p',
        text: '**Q: How does Bob handle questions when the required information is missing from Box?**\n**A:** Bob enforces strict evidence guardrails. If a question cannot be answered from existing Box documentation, Bob does not invent an answer; it explicitly states: *"I could not find sufficient evidence in the available Box content to answer that question"* and flags the item for human review.',
      },
    ],
  },
});

// ============================================================================
// 4. CASE STUDIES & CUSTOMER SUCCESS STORIES
// ============================================================================

documents.push({
  dir: 'Case Studies & Customer Success Stories',
  file: 'Financial Services Case Study.pdf',
  kind: 'pdf',
  spec: {
    title: 'Customer Case Study - Top-5 Global Bank Accelerates Onboarding by 85%',
    author: 'IBM Customer Success & Financial Services Strategy Practice',
    subject: 'Tier-1 Bank Commercial Lending Automation with IBM Bob & Box',
    header: 'IBM Case Study | Financial Services Practice',
    footer: 'Confidential Customer Story - IBM Corporation',
    blocks: [
      {
        type: 'title',
        text: 'CASE STUDY: TOP-5 GLOBAL BANK ACCELERATES COMMERCIAL ONBOARDING & RFP RESPONSES BY 85%',
        subtitle: 'Transforming 12M+ Unstructured Documents into Real-Time Lending Intelligence with IBM Bob & Box',
      },
      {
        type: 'meta',
        rows: [
          ['Client Profile', 'Top-5 Global Commercial & Investment Bank ($2.8T Assets Under Management)'],
          ['Challenge', '48-hour document intake backlog, manual metadata re-entry into Salesforce, complex RFP turnaround delays'],
          ['Deployed Solution', 'IBM Bob Enterprise + Box Content Cloud MCP Ingestion'],
          ['Deployment Scale', '4,500 Underwriters, Credit Analysts & RFP Proposal Managers'],
          ['Key Outcome', 'Turnaround reduced from 48 hours to 15 minutes; $4.2M annual operational savings; 100% audit accuracy'],
        ],
      },
      { type: 'h1', text: '1. The Business Challenge' },
      {
        type: 'p',
        text: 'The client’s commercial lending division received over 15,000 onboarding packages monthly—each consisting of 50 to 200 pages of W-9s, Articles of Incorporation, audited balance sheets, and regulatory disclosures stored on legacy file shares. Analysts spent up to **48 hours per package** manually reviewing files, extracting financial metrics, and re-keying data into Salesforce.',
      },
      { type: 'h1', text: '2. The Solution: IBM Bob + Box Content Cloud' },
      {
        type: 'p',
        text: 'The bank deployed **IBM Bob** integrated with **Box Content Cloud** via MCP. Bob autonomously monitors incoming customer folders, automatically classifies documents, extracts required loan covenants, cross-checks borrower financials against credit policies, and generates complete, citation-backed RFP responses and underwriting memos.',
      },
      { type: 'h1', text: '3. Measurable Business Results' },
      {
        type: 'table',
        head: ['Operational Metric', 'Before IBM Bob', 'With IBM Bob + Box', 'Improvement'],
        rows: [
          ['Average Onboarding Cycle', '48 to 72 hours', '12 to 15 minutes', '85% Faster'],
          ['RFP Response Generation', '14 business days', '2 business days', '86% Faster'],
          ['Data Extraction Accuracy', '91.2% (manual entry errors)', '99.4% (deterministic ground)', '+8.2% Accuracy'],
          ['Regulatory Audit Prep Time', '3 weeks per quarter', 'Instant 1-click audit trail', '95% Reduction'],
          ['Annual Cost Savings', 'Baseline operations', '$4.2 Million saved', 'ROI in 4.5 months'],
        ],
        widths: [28, 22, 25, 25],
      },
    ],
  },
});

documents.push({
  dir: 'Case Studies & Customer Success Stories',
  file: 'Retail Deployment Success Story.pdf',
  kind: 'pdf',
  spec: {
    title: 'Customer Success Story - Global Omni-Channel Retailer Automates Supplier Contracts',
    author: 'IBM Retail & Consumer Goods Industry Practice',
    subject: 'Supplier Agreement Analysis & Procurement Acceleration',
    header: 'IBM Case Study | Retail & Consumer Goods',
    footer: 'Confidential Customer Story - IBM Corporation',
    blocks: [
      {
        type: 'title',
        text: 'SUCCESS STORY: OMNI-CHANNEL RETAILER STREAMLINES 8,000+ SUPPLIER CONTRACTS',
        subtitle: 'Automated Vendor SLA Auditing and RFP Procurement with IBM Bob & Box',
      },
      {
        type: 'meta',
        rows: [
          ['Client Profile', 'Fortune 100 Omni-Channel Retailer (2,200 stores, $45B annual revenue)'],
          ['Challenge', 'Managing 8,000+ disparate supplier MSAs, inconsistent SLA penalties, and manual vendor procurement RFPs'],
          ['Deployed Solution', 'IBM Bob Enterprise + Box Shield DLP integration'],
          ['Impact', '70% faster vendor onboarding, $1.8M in recovered vendor SLA credits, 100% contract compliance'],
        ],
      },
      { type: 'h1', text: '1. Background & Pain Points' },
      {
        type: 'p',
        text: 'The retailer managed over 8,000 active vendor contracts across multiple regions. Because supplier agreements were stored in unstructured PDF formats across different Box folders, procurement officers struggled to enforce rebate tiers, freight terms, and delivery SLA penalties.',
      },
      { type: 'h1', text: '2. Solution & Impact' },
      {
        type: 'p',
        text: 'With IBM Bob connected to Box, the retailer ran automated cross-contract audits. Bob synthesized terms across all master agreements, identified rebate thresholds, and flagged non-compliant shipping chargebacks, recovering $1.8M in the first 90 days.',
      },
    ],
  },
});

documents.push({
  dir: 'Case Studies & Customer Success Stories',
  file: 'Manufacturing Transformation.docx',
  kind: 'docx',
  spec: {
    title: 'Manufacturing Transformation - Industrial Engineering Proposal Automation',
    author: 'IBM Industrial & Manufacturing Solutions Group',
    subject: 'Technical Specification Ingestion & Bid Proposal Automation',
    header: 'IBM Case Study | Industrial Manufacturing',
    footer: 'Confidential Customer Story - IBM Corporation',
    blocks: [
      {
        type: 'title',
        text: 'MANUFACTURING TRANSFORMATION: INDUSTRIAL EQUIPMENT PROPOSAL ACCELERATION',
        subtitle: 'Synthesizing 500-Page Engineering Specifications into Winning Bids with IBM Bob',
      },
      {
        type: 'meta',
        rows: [
          ['Client Profile', 'Global Heavy Machinery & Aerospace Component Manufacturer'],
          ['Challenge', 'Engineering RFPs with 500+ page technical specs requiring 6 weeks of cross-team coordination'],
          ['Solution', 'IBM Bob Multi-Agent Document Intelligence + Box CAD/Spec Repositories'],
          ['Result', '60% faster proposal cycle; zero missed technical specifications; $18M in new contract wins'],
        ],
      },
      { type: 'h1', text: '1. Executive Summary' },
      {
        type: 'p',
        text: 'Responding to defense and commercial aerospace tenders requires parsing thousands of engineering tolerances, material certifications, and environmental standards. IBM Bob automated the technical compliance matrix generation, reducing tender response time from 6 weeks to 10 days.',
      },
    ],
  },
});

// ============================================================================
// 5. PRICING & LICENSING
// ============================================================================

documents.push({
  dir: 'Pricing & Licensing',
  file: 'Pricing Sheets.xlsx',
  kind: 'xlsx',
  spec: {
    sheets: [
      {
        name: 'Enterprise Pricing',
        title: 'IBM Bob Enterprise Edition - Commercial Pricing & Subscription Schedule',
        subtitle: 'Annual Subscription Pricing, User Tiers, and Platform Ingestion Capacity',
        head: ['Tier Code', 'Edition Name', 'Licensed User Count', 'Annual Platform Fee', 'Box MCP Connector', 'Dedicated Support', 'List Price (USD)'],
        widths: [12, 22, 18, 20, 18, 18, 16],
        boldFirstCol: true,
        rows: [
          { section: 'Standard Enterprise User Tiers' },
          ['BOB-ENT-050', 'Team Starter', 'Up to 50 Users', '$45,000 / yr', 'Included', 'Standard (8x5)', '$45,000'],
          ['BOB-ENT-250', 'Business Growth', 'Up to 250 Users', '$145,000 / yr', 'Included', 'Premier (24x7)', '$145,000'],
          ['BOB-ENT-1000', 'Enterprise Scale', 'Up to 1,000 Users', '$380,000 / yr', 'Included (Multi-Tenant)', 'Mission Critical', '$380,000'],
          ['BOB-ENT-UNL', 'Global Enterprise', 'Unlimited Users', 'Custom / Contact IBM', 'Dedicated VPC / GovCloud', 'Designated TAM', 'Contact Sales'],
          { section: 'Add-On Modules & Extensions' },
          ['BOB-MOD-OCR', 'Advanced High-Res OCR', 'Unmetered Pages', '$25,000 / yr', 'N/A', 'Included', '$25,000'],
          ['BOB-MOD-GOV', 'watsonx Model Governance', 'Full Audit Module', '$40,000 / yr', 'N/A', 'Included', '$40,000'],
          ['BOB-MOD-SFDC', 'Salesforce Canvas Integration', 'Enterprise Sync', '$18,000 / yr', 'Included', 'Included', '$18,000'],
        ],
      },
      {
        name: 'Professional Services',
        title: 'IBM Bob Implementation & Deployment Services Packages',
        subtitle: 'Fixed-Price Implementation Packages and Training Programs',
        head: ['Package SKU', 'Service Package Name', 'Duration', 'Included Scope', 'Target Customer', 'Fixed Price (USD)'],
        widths: [15, 25, 12, 38, 20, 16],
        boldFirstCol: true,
        rows: [
          ['PS-QUICK-04', '4-Week QuickStart', '4 Weeks', 'Box MCP setup, IAM integration, 2 custom agent prompt pipelines, user training', 'Departmental Launch', '$35,000'],
          ['PS-ENT-08', '8-Week Enterprise Launch', '8 Weeks', 'Dedicated VPC setup, full Box taxonomy mapping, 6 custom workflows, UAT & security sign-off', 'Enterprise Rollout', '$85,000'],
          ['PS-TRANS-16', '16-Week Full Transformation', '16 Weeks', 'Legacy content migration, ERP/CRM integration, custom LLM fine-tuning, global enablement', 'Global Bank / Gov Agency', '$195,000'],
        ],
      },
    ],
  },
});

documents.push({
  dir: 'Pricing & Licensing',
  file: 'SKU Catalog.xlsx',
  kind: 'xlsx',
  spec: {
    sheets: [
      {
        name: 'Product SKUs',
        title: 'IBM Bob Product SKU Catalog & Ordering Information',
        subtitle: 'Master Part Numbers, Descriptions, and Ordering Units',
        head: ['Part Number', 'Product Description', 'Unit of Measure', 'Contract Type', 'UNSPSC Code'],
        widths: [16, 42, 18, 16, 14],
        boldFirstCol: true,
        rows: [
          { section: 'Core Platform Software' },
          ['D0ZB1LL', 'IBM Bob Enterprise User License per Authorized User', 'Per User / Year', 'SaaS Subscription', '43231500'],
          ['D0ZB2LL', 'IBM Bob Dedicated Sovereign Platform Instance', 'Per Instance / Year', 'Dedicated SaaS', '43231500'],
          ['D0ZB3LL', 'IBM Bob Box MCP Deep Intelligence Connector Pack', 'Per Connector / Year', 'SaaS Add-on', '43231500'],
          { section: 'Support & Education' },
          ['D0ZB4LL', 'IBM Premier 24/7/365 Mission Critical Support Upgrade', 'Per Contract / Year', 'Support Upgrade', '81112200'],
          ['D0ZB5LL', 'IBM Bob System Administrator & Developer Certification', 'Per Student', 'Training Voucher', '86101700'],
        ],
      },
    ],
  },
});

documents.push({
  dir: 'Pricing & Licensing',
  file: 'Licensing Guide.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Enterprise Licensing, Packaging & Subscription Guide',
    author: 'IBM Software Licensing & Commercial Strategy',
    subject: 'Licensing Policies, User Definitions, and True-Up Rules',
    header: 'IBM Licensing Guide | IBM Bob Enterprise',
    footer: 'IBM Corporation 2025 - Licensing Guide',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: LICENSING & PACKAGING GUIDE',
        subtitle: 'Authorized User Definitions, Capacity Allotments, and Renewal Guidelines',
      },
      {
        type: 'meta',
        rows: [
          ['Licensing Model', 'Authorized User Annual Subscription / Enterprise Site Licensing'],
          ['Non-Production Usage', 'Included (2 non-production sandbox environments per enterprise contract)'],
          ['True-Up Frequency', 'Annual True-Up Review with pro-rated additions'],
        ],
      },
      { type: 'h1', text: '1. User License Types & Permissions' },
      {
        type: 'table',
        head: ['Role Type', 'Description', 'Capabilities & Access'],
        rows: [
          ['Authorized User', 'Standard business user, underwriter, or RFP writer.', 'Access IBM Bob agents, run Box searches, synthesize documents, export RFP drafts.'],
          ['Enterprise Administrator', 'IT operations, security, and team leads.', 'Manage team spending limits, configure Box MCP credentials, inspect audit logs.'],
          ['Read-Only Auditor', 'Compliance, internal audit, and risk officers.', 'Review evidence chains, inspect provenance logs, generate compliance reports.'],
        ],
        widths: [22, 33, 45],
      },
    ],
  },
});

// ============================================================================
// 6. IMPLEMENTATION METHODOLOGY
// ============================================================================

documents.push({
  dir: 'Implementation Methodology',
  file: 'Deployment Playbook.docx',
  kind: 'docx',
  spec: {
    title: 'IBM Bob Enterprise Deployment Playbook - Standard Operating Procedures',
    author: 'IBM Software Services & Delivery Engineering',
    subject: 'Deployment Best Practices, Box Connector Configuration & Testing',
    header: 'IBM Delivery Playbook | Deployment SOPs',
    footer: 'IBM Corporation 2025 - Deployment Playbook',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE DEPLOYMENT PLAYBOOK',
        subtitle: 'Standard Operating Procedures (SOP) for Box MCP Connector & Agent Configuration',
      },
      {
        type: 'meta',
        rows: [
          ['Document ID', 'SOP-BOB-DEP-2025-1'],
          ['Target Role', 'Lead Implementation Engineers, Cloud Architects, Box Admins'],
          ['Standard Timeline', '8 Weeks from Kickoff to Production Go-Live'],
        ],
      },
      { type: 'h1', text: 'Phase 1: Environment Provisioning & Box Authorization' },
      {
        type: 'ul',
        items: [
          '**Step 1.1:** Provision dedicated customer tenant with regional VPC pinning.',
          '**Step 1.2:** In Box Developer Console, register Custom App with OAuth 2.0 / Server Authentication.',
          '**Step 1.3:** Configure Box Application Scopes: `Read all files and folders`, `Manage Webhooks`, and `Manage Box Shield alerts`.',
          '**Step 1.4:** Generate and inject client credentials into secure vault (IBM Key Protect / AWS Secrets Manager).',
        ],
      },
      { type: 'h1', text: 'Phase 2: Repository Taxonomy & Content Indexing' },
      {
        type: 'p',
        text: 'Structure customer Box folders into designated knowledge domains: Past RFPs, Security & Compliance, Product Docs, Case Studies, Pricing, and Legal. Bob automatically indexes folder structures and creates embeddings.',
      },
      { type: 'h1', text: 'Phase 3: Agent Grounding, Guardrails & UAT' },
      {
        type: 'p',
        text: 'Conduct test RFP runs against historical proposals. Verify that evidence citations link accurately to source documents with zero hallucinated facts.',
      },
    ],
  },
});

documents.push({
  dir: 'Implementation Methodology',
  file: 'Project Delivery Framework.pdf',
  kind: 'pdf',
  spec: {
    title: 'IBM Bob Project Delivery Framework (PDF) - Milestone Roadmap',
    author: 'IBM Global Delivery Practice',
    subject: 'RACI Matrix, Governance, and Milestone Sign-Off Protocols',
    header: 'IBM Project Delivery Framework | Enterprise Delivery',
    footer: 'IBM Corporation 2025 - Project Delivery Framework',
    blocks: [
      {
        type: 'title',
        text: 'PROJECT DELIVERY FRAMEWORK (PDF): MILESTONE ROADMAP',
        subtitle: 'Governance, RACI Responsibilities & Acceptance Criteria for Enterprise Deployments',
      },
      {
        type: 'meta',
        rows: [
          ['Project Model', 'IBM Agile Delivery Framework (ADF)'],
          ['Delivery Lead', 'Designated IBM Project Delivery Manager'],
          ['Total Project Duration', '8 Weeks (4 Two-Week Sprints)'],
        ],
      },
      { type: 'h1', text: '1. Governance & RACI Responsibility Matrix' },
      {
        type: 'table',
        head: ['Project Task / Deliverable', 'IBM Lead', 'Customer Lead', 'Box Admin', 'CISO / Security'],
        rows: [
          ['Architecture & Security Review', 'Accountable', 'Consulted', 'Informed', 'Responsible'],
          ['Box MCP Connector Auth & Scopes', 'Responsible', 'Consulted', 'Accountable', 'Consulted'],
          ['Folder Taxonomy & Indexing', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
          ['RFP Agent Prompt Tuning', 'Responsible', 'Accountable', 'Informed', 'Informed'],
          ['User Acceptance Testing (UAT)', 'Consulted', 'Accountable', 'Informed', 'Consulted'],
          ['Final Production Cutover & Sign-Off', 'Accountable', 'Accountable', 'Responsible', 'Responsible'],
        ],
        widths: [32, 17, 17, 17, 17],
      },
      { type: 'h1', text: '2. Milestone Gates & Acceptance Criteria' },
      {
        type: 'ul',
        items: [
          '**Gate 1 (Day 14):** IAM SSO verified; Box MCP connected and authenticated.',
          '**Gate 2 (Day 28):** Ingestion complete across 100% of target customer folders with metadata preserved.',
          '**Gate 3 (Day 42):** 10 benchmark RFPs generated with >98% accuracy score during UAT.',
          '**Gate 4 (Day 56):** Full production cutover, admin dashboard live, 250 users enabled.',
        ],
      },
    ],
  },
});

documents.push({
  dir: 'Implementation Methodology',
  file: 'Onboarding Templates.docx',
  kind: 'docx',
  spec: {
    title: 'IBM Bob Customer Onboarding & Training Toolkit',
    author: 'IBM Enablement & Customer Success',
    subject: 'Training Curriculum, Prompt Playbooks, and User Worksheets',
    header: 'IBM Enablement | User Onboarding Toolkit',
    footer: 'IBM Corporation 2025 - Onboarding Toolkit',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: CUSTOMER ONBOARDING TOOLKIT',
        subtitle: 'User Training Curriculum, Standard Prompt Playbooks & Folder Templates',
      },
      { type: 'h1', text: '1. User Role Enablement Curriculum' },
      {
        type: 'ul',
        items: [
          '**Module 1: Getting Started with Bob & Box:** Navigating folders, understanding agent search, viewing evidence citations.',
          '**Module 2: Generating First-Draft RFP Responses:** Selecting target RFPs, configuring response tone, cross-referencing past wins.',
          '**Module 3: Reviewing & Verifying Evidence:** Inspecting source excerpts, verifying compliance answers, refining generated drafts.',
          '**Module 4: Administering Teams & Spending Limits:** User provisioning, token budgets, audit log export.',
        ],
      },
      { type: 'h1', text: '2. Recommended Box Folder Hierarchy' },
      {
        type: 'p',
        text: 'To maximize AI response quality, organize your Box corporate workspace into dedicated knowledge repositories: Past RFP Responses, Security & Compliance, Product Documentation, Case Studies, Pricing & Licensing, Implementation Methodology, and Legal.',
      },
    ],
  },
});

// ============================================================================
// 7. LEGAL & CONTRACT LANGUAGE
// ============================================================================

documents.push({
  dir: 'Legal & Contract Language',
  file: 'Standard MSA.docx',
  kind: 'docx',
  spec: {
    title: 'Master Services Agreement (MSA) - Enterprise Cloud Software Services',
    author: 'IBM Legal & Global Contracting',
    subject: 'Standard Master Services Agreement Terms for IBM Software & SaaS',
    header: 'IBM Legal | Master Services Agreement',
    footer: 'Standard Enterprise MSA - IBM Corporation',
    blocks: [
      {
        type: 'title',
        text: 'MASTER SERVICES AGREEMENT (MSA) FOR ENTERPRISE CLOUD SERVICES',
        subtitle: 'Standard Commercial Terms, Intellectual Property, and Data Protection Provisions',
      },
      {
        type: 'meta',
        rows: [
          ['Agreement Ref', 'MSA-IBM-ENT-2025-V1'],
          ['Governing Law', 'State of New York, USA'],
          ['Applicability', 'IBM Bob Enterprise Platform & Cloud Connectors'],
        ],
      },
      { type: 'h1', text: 'Section 1: Definitions & Scope of Services' },
      {
        type: 'p',
        text: 'This Master Services Agreement ("Agreement") governs the provision of IBM Bob cloud services, software subscriptions, and professional implementation services provided to Customer. Customer may access the services via authorized web interfaces, IDE extensions, and Model Context Protocol (MCP) integrations.',
      },
      { type: 'h1', text: 'Section 2: Intellectual Property & Customer Data Ownership' },
      {
        type: 'callout',
        label: 'Customer Data Ownership:',
        text: 'Customer retains sole and exclusive ownership of all right, title, and interest in and to all Customer Data, input documents, prompts, and all generated outputs (including RFP responses, summaries, and reports). IBM acquires no rights in Customer Data.',
      },
      { type: 'h1', text: 'Section 3: Confidentiality & Data Security' },
      {
        type: 'p',
        text: 'Each party agrees to protect the Confidential Information of the other with the same degree of care it uses for its own confidential information, but in no event less than reasonable care. IBM shall maintain administrative, physical, and technical safeguards in accordance with SOC 2 Type II and ISO 27001 standards.',
      },
      { type: 'h1', text: 'Section 4: Warranties & Limitation of Liability' },
      {
        type: 'p',
        text: 'IBM warrants that the services will perform substantially in conformance with applicable product documentation and service level agreements. Neither party shall be liable for indirect, incidental, special, or consequential damages.',
      },
    ],
  },
});

documents.push({
  dir: 'Legal & Contract Language',
  file: 'SLA Documents.pdf',
  kind: 'pdf',
  spec: {
    title: 'Service Level Agreement (SLA) & High Availability Commitments',
    author: 'IBM Cloud Operations & Service Management',
    subject: 'Uptime Commitments, Severity Incident Levels, and Service Credits',
    header: 'IBM Service Level Agreement | Cloud Availability',
    footer: 'IBM Corporation 2025 - Service Level Agreement',
    blocks: [
      {
        type: 'title',
        text: 'SERVICE LEVEL AGREEMENT (SLA): UPTIME COMMITMENTS & INCIDENT RESPONSE',
        subtitle: 'Enterprise Cloud Service Availability, Severity Tier Definitions & Service Credits',
      },
      {
        type: 'meta',
        rows: [
          ['Service Availability SLA', '99.95% Monthly Uptime Commitment'],
          ['Maintenance Window', 'Sundays 02:00 - 04:00 AM UTC (Pre-notified 7 business days in advance)'],
          ['Support Coverage', '24x7x365 Global Level-1, Level-2 and Level-3 Engineering'],
        ],
      },
      { type: 'h1', text: '1. Incident Severity Levels & Response Times' },
      {
        type: 'table',
        head: ['Severity Level', 'Definition & Impact', 'Initial Response SLA', 'Target Resolution SLA'],
        rows: [
          ['Severity 1 (Critical)', 'Complete service outage; platform unavailable to all users.', '< 15 Minutes (24/7)', '< 2 Hours'],
          ['Severity 2 (High)', 'Major feature impairment (e.g. Box MCP sync failure with no workaround).', '< 1 Hour (24/7)', '< 6 Hours'],
          ['Severity 3 (Medium)', 'Minor feature degradation; business workaround available.', '< 4 Hours (Business hrs)', '< 24 Hours'],
          ['Severity 4 (Low)', 'General inquiry, configuration question, cosmetic issue.', '< 8 Hours (Business hrs)', 'Next maintenance cycle'],
        ],
        widths: [20, 42, 18, 20],
      },
      { type: 'h1', text: '2. Service Credit Schedule' },
      {
        type: 'table',
        head: ['Monthly Uptime Percentage', 'Service Credit Percentage of Monthly Fee'],
        rows: [
          ['< 99.95% but >= 99.00%', '10% Service Credit'],
          ['< 99.00% but >= 98.00%', '25% Service Credit'],
          ['< 98.00%', '50% Service Credit'],
        ],
        widths: [50, 50],
      },
    ],
  },
});

documents.push({
  dir: 'Legal & Contract Language',
  file: 'Terms & Conditions.docx',
  kind: 'docx',
  spec: {
    title: 'IBM Bob Cloud Services Terms & Conditions',
    author: 'IBM Legal & Regulatory Counsel',
    subject: 'End User Terms of Service, Acceptable Use, and Compliance Requirements',
    header: 'IBM Terms & Conditions | Cloud Software',
    footer: 'Standard Terms & Conditions - IBM Corporation',
    blocks: [
      {
        type: 'title',
        text: 'IBM BOB ENTERPRISE: CLOUD SERVICE TERMS & CONDITIONS',
        subtitle: 'Acceptable Use Policy, Third-Party Integrations, and Compliance Requirements',
      },
      { type: 'h1', text: '1. Acceptable Use Policy (AUP)' },
      {
        type: 'p',
        text: 'Customer and its Authorized Users shall use the IBM Bob cloud service solely for legitimate internal business purposes. Customer shall not: (a) reverse engineer, decompile, or disassemble the service; (b) use the service to generate malicious code, malware, or unlawful materials; or (c) attempt unauthorized access to other tenant enclaves.',
      },
      { type: 'h1', text: '2. Third-Party Integrations & Box APIs' },
      {
        type: 'p',
        text: 'The service interacts with Box Content Cloud via official APIs and the Model Context Protocol. Customer is responsible for maintaining valid Box subscriptions and granting necessary API permissions to enable document synchronization.',
      },
    ],
  },
});

// ============================================================================
// 8. INCOMING RFPS (DEMO INPUT)
// ============================================================================

documents.push({
  dir: 'Incoming RFPs',
  file: 'Acme Bank - RFP for AI-Powered Document Intelligence Platform.pdf',
  kind: 'pdf',
  spec: {
    title: 'Request for Proposal (RFP-2025-DOCAI-04) - Acme Bank Commercial Content Intelligence',
    author: 'Acme Bank Strategic Sourcing & IT Procurement',
    subject: 'RFP-2025-DOCAI-04: AI-Powered Document Intelligence Platform',
    header: 'Acme Bank | RFP-2025-DOCAI-04 | Commercial Confidential',
    footer: 'Commercial Confidential - Acme Bank Sourcing Committee',
    blocks: [
      {
        type: 'title',
        text: 'REQUEST FOR PROPOSAL (RFP) - ACME BANK COMMERCIAL CONTENT INTELLIGENCE PLATFORM',
        subtitle: 'Solicitation Reference: RFP-2025-DOCAI-04 | Due Date: November 15, 2025',
      },
      {
        type: 'meta',
        rows: [
          ['Issuing Organization', 'Acme Bank National Association (Commercial Lending Division)'],
          ['RFP Reference', 'RFP-2025-DOCAI-04'],
          ['Contact Officer', 'Eleanor Vance, VP Strategic Sourcing & Technology Procurement'],
          ['Target Platform', 'AI-Powered Document Intelligence & Automated Proposal Platform'],
          ['Required Repositories', 'Box Content Cloud (Enterprise Plus Tier)'],
        ],
      },
      { type: 'h1', text: '1. Objective & Context' },
      {
        type: 'p',
        text: 'Acme Bank is seeking an enterprise-grade AI-powered document intelligence and knowledge synthesis platform. Acme Bank currently stores millions of commercial loan agreements, customer due diligence packages, past RFP responses, compliance guidelines, and security policies in **Box**. Acme Bank seeks a vendor platform capable of connecting directly to Box to analyze contracts, answer complex questionnaires, generate RFP response drafts, and maintain strict banking security standards.',
      },
      { type: 'h1', text: '2. Mandatory Questionnaire Requirements' },
      {
        type: 'p',
        text: 'Bidders must provide complete, evidence-backed answers to the following 5 core evaluation sections:',
      },
      {
        type: 'ol',
        items: [
          '**Section 1: Executive Summary & Vision:** Describe your platform and how it transforms unstructured Box repositories into high-value intelligence.',
          '**Section 2: Technical Architecture & Box Integration:** Detail your integration architecture with Box Content Cloud, MCP protocol support, and evidence grounding engine.',
          '**Section 3: Security, Privacy & Compliance:** Detail your encryption standards (at rest and in transit), SOC 2 Type II / ISO 27001 certifications, and zero-model-training policy.',
          '**Section 4: Relevant Banking Case Study:** Provide a concrete example of a Tier-1 financial institution utilizing your platform with measurable results.',
          '**Section 5: Implementation Plan & Pricing:** Provide an 8-week implementation roadmap, RACI framework, and commercial enterprise pricing breakdown.',
        ],
      },
    ],
  },
});

// ============================================================================
// 9. GENERATED RFP RESPONSES (DEMO OUTPUT)
// ============================================================================

const rfpResponseSpec = {
  title: 'Acme Bank RFP Response - IBM Bob Document Intelligence Platform',
  author: 'IBM Bob Autonomous Proposal Agent (Grounded in Box Content Cloud)',
  subject: 'Formal Response to Acme Bank RFP-2025-DOCAI-04',
  header: 'IBM Bob / Acme Bank | AI-Generated RFP Response | Grounded in Box',
  footer: 'First-Draft RFP Response Generated by IBM Bob from Box Content',
  blocks: [
    {
      type: 'title',
      text: 'ACME BANK RFP RESPONSE: AI-POWERED DOCUMENT INTELLIGENCE PLATFORM',
      subtitle: 'Formal Bid Response to RFP-2025-DOCAI-04 | Generated by IBM Bob from Box Historical Content',
    },
    {
      type: 'meta',
      rows: [
        ['Client Name', 'Acme Bank National Association'],
        ['RFP Reference', 'RFP-2025-DOCAI-04 (Commercial Content Intelligence Platform)'],
        ['Vendor Response', 'IBM Corporation (IBM Bob Enterprise Edition)'],
        ['Grounded Sources', 'Box Corporate Knowledge Base (Past RFPs, Security Docs, Product Guide, Case Studies, Pricing)'],
        ['Generation Engine', 'IBM Bob Agentic Reasoner + Box MCP Connector'],
        ['Status', 'First-Draft Complete - 100% Evidence Grounded [Approved for Submission]'],
      ],
    },

    { type: 'h1', text: 'Section 1: Executive Summary [COMPLETE]' },
    {
      type: 'p',
      text: 'IBM is pleased to propose **IBM Bob Enterprise** to Acme Bank as the premier AI-powered document intelligence and RFP response automation platform. By connecting directly to Acme Bank’s existing **Box Content Cloud** via the open **Model Context Protocol (MCP)**, IBM Bob transforms static repository folders into an active, autonomous reasoning engine.',
    },
    {
      type: 'p',
      text: 'Rather than treating document search as isolated keyword queries, IBM Bob reads, synthesizes, and cross-references historical RFP responses, security whitepapers, product guides, and case studies stored in Box. This delivers comprehensive, first-draft RFP responses and underwriting analyses with **deterministic citation provenance** and **zero data retention for model training**.',
    },
    {
      type: 'callout',
      label: 'Acme Bank Value Summary:',
      text: 'Accelerates proposal generation and commercial loan reviews by **85%**, ensures 100% compliance with SOC 2 / ISO 27001 standards, and eliminates manual data entry across Salesforce and legacy shares.',
    },

    { type: 'h1', text: 'Section 2: Technical Architecture & Box Integration [COMPLETE]' },
    {
      type: 'p',
      text: 'IBM Bob features an enterprise-grade agentic architecture built specifically around Box Content Cloud:',
    },
    {
      type: 'ul',
      items: [
        '**Model Context Protocol (MCP) Connector:** Establishes a secure, real-time in-memory bridge to Box repositories, reading files on demand without persistent local caching.',
        '**watsonx Granite Foundation Layer:** Leverages enterprise models optimized for financial parsing, tabular reconstruction, and complex multi-column document reasoning.',
        '**Deterministic Evidence Grounding:** Every generated answer is anchored to exact Box document IDs, page coordinates, and excerpt hashes, eliminating hallucinations.',
        '**Active Directory & SAML SSO Integration:** Automatically mirrors existing Box user permissions, IAM roles, and Box Shield classification labels.',
      ],
    },

    { type: 'h1', text: 'Section 3: Security, Privacy & Compliance Answers [COMPLETE]' },
    {
      type: 'table',
      head: ['RFP Security Question', 'IBM Bob Specification', 'Source Document in Box', 'Status'],
      rows: [
        ['Describe your encryption controls.', 'AES-256 for data at rest (with customer CMEK support); strict TLS 1.3 for data in transit.', 'Security Whitepaper.pdf (p. 2)', 'Verified'],
        ['How do you handle customer PII?', 'Automated real-time tokenization & masking of SSNs/TINs; ephemeral in-memory processing only.', 'Data Privacy Documentation.pdf (p. 3)', 'Verified'],
        ['Is customer data used for AI training?', 'Zero customer data is ever retained or used to train or fine-tune public or base AI models.', 'Standard MSA.docx (Sec. 2)', 'Verified'],
        ['What certifications do you maintain?', 'SOC 2 Type II (Clean PwC Opinion, all 5 TSCs), ISO/IEC 27001:2022, ISO 27701, HIPAA BAA ready.', 'SOC 2 Report.pdf & ISO 27001.pdf', 'Verified'],
        ['What is your service uptime SLA?', '99.95% monthly uptime commitment with financial service credits and 24/7/365 tier-1 support.', 'SLA Documents.pdf (Sec. 1)', 'Verified'],
      ],
      widths: [28, 38, 24, 10],
    },

    { type: 'h1', text: 'Section 4: Relevant Banking Case Study [COMPLETE]' },
    {
      type: 'p',
      text: 'As detailed in our official **Financial Services Case Study** (*JPMorgan Chase & Tier-1 Global Commercial Bank*), deploying IBM Bob on top of Box Content Cloud produced transformative outcomes:',
    },
    {
      type: 'ul',
      items: [
        '**85% Faster Intake & Review:** Commercial onboarding package turnaround dropped from 48 hours to under 15 minutes.',
        '**86% Faster RFP Drafting:** Full 50-page formal RFP response generation reduced from 14 business days to 2 business days.',
        '**99.4% Extraction Accuracy:** Deterministic grounding eliminated manual transcription errors across loan covenants.',
        '**$4.2M Annual Cost Savings:** Immediate positive ROI achieved within 4.5 months of enterprise rollout.',
      ],
    },

    { type: 'h1', text: 'Section 5: Implementation Plan & Pricing Breakdown [COMPLETE]' },
    {
      type: 'p',
      text: 'Based on our **Project Delivery Framework** and **Pricing Schedule**, IBM recommends the **8-Week Enterprise Launch Package** for Acme Bank:',
    },
    {
      type: 'table',
      head: ['Sprint / Phase', 'Timeline', 'Deliverables & Milestones', 'RACI Lead'],
      rows: [
        ['Sprint 1: IAM & Auth', 'Weeks 1 - 2', 'Provision dedicated VPC, configure Box MCP OAuth 2.0 app, bind PingFederate SAML SSO.', 'IBM Architect & Box Admin'],
        ['Sprint 2: Box Grounding', 'Weeks 3 - 4', 'Map Acme Bank Box folder taxonomy, index past RFPs, compliance docs, and credit policies.', 'IBM Delivery Lead & Acme Sourcing'],
        ['Sprint 3: Agent Tuning & UAT', 'Weeks 5 - 6', 'Deploy customized proposal generation pipelines, execute 10 test benchmark RFPs during UAT.', 'Acme Evaluation Team'],
        ['Sprint 4: Production Cutover', 'Weeks 7 - 8', 'Final security sign-off, SOC monitoring integration, and user training for 250 specialists.', 'Joint Project Leads'],
      ],
      widths: [20, 15, 45, 20],
    },
    {
      type: 'p',
      text: '**Recommended Commercial Package:** IBM Bob Enterprise 250-User Tier (`BOB-ENT-250`) at **$145,000 / year**, including full Box MCP Connector, 24x7 Premier Support, and the 8-Week Professional Services Launch Package (`PS-ENT-08`) at **$85,000 fixed fee**.',
    },
  ],
};

documents.push({
  dir: 'Generated RFP Responses',
  file: 'Acme Bank - First-Draft RFP Response (IBM Bob).docx',
  kind: 'docx',
  spec: rfpResponseSpec,
});

documents.push({
  dir: 'Generated RFP Responses',
  file: 'Acme Bank - First-Draft RFP Response (IBM Bob).pdf',
  kind: 'pdf',
  spec: rfpResponseSpec,
});

// ============================================================================
// BUILD ALL ASSETS
// ============================================================================

async function buildAll() {
  console.log(`Generating ${documents.length} demo assets for Box upload...\n`);

  for (const doc of documents) {
    const outDir = path.join(boxRoot, doc.dir);
    fs.mkdirSync(outDir, { recursive: true });

    const buffer = await RENDER[doc.kind](doc.spec);
    const filePath = path.join(outDir, doc.file);
    fs.writeFileSync(filePath, buffer);

    console.log(`✓ [${doc.kind.toUpperCase()}] ${path.join(doc.dir, doc.file).padEnd(65)} (${(buffer.length / 1024).toFixed(1)} KB)`);

    // If it is the generated response, also output a clean plain-text version for quick viewing
    if (doc.file.includes('First-Draft RFP Response') && doc.kind === 'docx') {
      const text = renderText(doc.spec);
      const txtPath = path.join(outDir, 'Acme Bank - First-Draft RFP Response (IBM Bob).txt');
      fs.writeFileSync(txtPath, text);
      console.log(`✓ [TXT]  ${path.join(doc.dir, 'Acme Bank - First-Draft RFP Response (IBM Bob).txt').padEnd(65)} (${(text.length / 1024).toFixed(1)} KB)`);
    }
  }

  console.log(`\nSuccessfully created all folders and assets in Box_Upload_Folder/!`);
}

buildAll().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
