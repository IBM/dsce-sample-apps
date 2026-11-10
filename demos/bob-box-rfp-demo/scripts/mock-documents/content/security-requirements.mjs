export default {
  file: 'Security_Requirements.pdf',
  dir: 'Customers/Acme Corp/Security & Compliance',
  kind: 'pdf',
  inApp: true,
  spec: {
    title: 'Acme Corp - Information Security & Compliance Mandate',
    author: 'Marcus Vance, CISO',
    subject: 'SEC-POL-2024-89 Information Security and Compliance Mandate',
    header: 'Acme Corp | SEC-POL-2024-89 | Restricted',
    footer: 'Restricted - Acme Corp Information Security',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP - INFORMATION SECURITY & COMPLIANCE MANDATE',
        subtitle: 'Security requirements for third-party content platforms handling customer onboarding data',
      },
      {
        type: 'meta',
        rows: [
          ['Document ID', 'SEC-POL-2024-89'],
          ['Approved by', 'Marcus Vance, CISO'],
          ['Owner', 'Information Security'],
          ['Classification', 'Restricted'],
          ['Effective date', 'September 25, 2024'],
          ['Applies to', 'Any platform, service or vendor that stores, processes or transmits Acme customer onboarding content'],
        ],
      },

      { type: 'h1', text: '1. Purpose and Scope' },
      {
        type: 'p',
        text: 'This mandate sets the minimum security controls that Acme requires of any system that holds commercial customer onboarding content, including tax records, certificates of insurance, contracts, and identity and corporate formation documents. It applies to the proposed replacement of Acme\'s file-share-based onboarding repositories and to every service that platform relies on, including indexing, preview generation, search, and any machine learning or AI processing of content.',
      },
      {
        type: 'p',
        text: 'The controls below are requirements, not preferences. A vendor that cannot meet a requirement must say so in its response and describe the compensating control, if any. Exceptions are granted only through the process in section 9.',
      },

      { type: 'h1', text: '2. Security Requirements' },
      { type: 'h2', text: '2.1 Encryption Standards' },
      {
        type: 'ul',
        items: [
          'Data at Rest: All files, blobs, and metadata indices must be encrypted using AES-256.',
          'Data in Transit: Mandatory TLS 1.2 or higher for all client-to-server and server-to-server API endpoints.',
        ],
      },
      {
        type: 'p',
        text: 'TLS 1.3 is preferred where supported. Connections that negotiate older protocol versions must be refused rather than downgraded. Encryption keys must be managed by the vendor in a hardware-backed key management service, with documented key rotation. Customer-managed keys are desirable and should be described in the vendor response.',
      },
      { type: 'h2', text: '2.2 Audit Logging and Traceability' },
      {
        type: 'ul',
        items: [
          'Comprehensive immutable audit logging is mandatory. System must log document creation, view, metadata modification, permission changes, and download events with timestamp and user ID.',
        ],
      },
      {
        type: 'p',
        text: 'Audit records must not be editable or deletable by any administrator. Records must be available for export to Acme\'s security information and event management (SIEM) platform in a structured format. The minimum retention period for audit logs is defined in the Acme Data Governance and Compliance Framework.',
      },
      { type: 'h2', text: '2.3 Role-Based Permissions and Isolation' },
      {
        type: 'ul',
        items: [
          'Security reviewers require clear, granular role-based access control (RBAC). Document reviewers must only access files within their assigned territory and clearance tier.',
        ],
      },
      {
        type: 'p',
        text: 'Roles must be assignable by group membership from the corporate identity provider. A role must never grant access beyond what the user\'s territory and clearance tier allow. Auditor roles must be able to review documents and activity without the ability to alter or export content.',
      },
      { type: 'h2', text: '2.4 Data Sovereignty' },
      {
        type: 'ul',
        items: [
          'Zero international data egress. All tenant storage and ingestion services must reside in US-based cloud infrastructure.',
        ],
      },
      {
        type: 'p',
        text: 'This covers primary storage, replicas, backups, search indices, document previews, and any region in which content is processed by AI or machine learning services. Support personnel outside the United States must not have access to customer content.',
      },

      { type: 'h1', text: '3. Identity and Session Management' },
      {
        type: 'ul',
        items: [
          'Authentication must be federated to Acme\'s corporate identity provider using SAML 2.0 or OpenID Connect.',
          'Multi-factor authentication must be enforced by the identity provider for all users who can approve, administer or audit content.',
          'Sessions must time out after a period of inactivity set by Acme and must be revocable by an administrator.',
          'Service-to-service access must use short-lived tokens. Long-lived static credentials are not acceptable.',
        ],
      },

      { type: 'h1', text: '4. Vulnerability and Incident Management' },
      {
        type: 'table',
        head: ['Control', 'Requirement'],
        widths: [30, 70],
        firstColBold: true,
        rows: [
          ['Penetration testing', 'Independent penetration test of the production service at least annually. Summary of findings and remediation status available to Acme on request.'],
          ['Vulnerability remediation', 'Critical and high-severity vulnerabilities remediated according to a documented, published schedule.'],
          ['Incident notification', 'Vendor must notify Acme\'s security operations team promptly after confirming an incident that affects Acme content. The notification window will be set in the contract.'],
          ['Security attestations', 'Current SOC 2 Type II report and ISO/IEC 27001 certificate, or equivalent, provided during evaluation.'],
          ['Sub-processors', 'Vendor must list all sub-processors with access to Acme content and notify Acme before adding new ones.'],
        ],
      },

      { type: 'h1', text: '5. Control Summary for Vendor Response' },
      {
        type: 'p',
        text: 'Vendors should answer each row below as Meets, Partially meets, or Does not meet, and point to supporting documentation.',
      },
      {
        type: 'table',
        head: ['Ref', 'Control', 'Standard required', 'Evidence expected'],
        widths: [8, 26, 36, 30],
        rows: [
          ['S-01', 'Encryption at rest', 'AES-256 for files, blobs and metadata indices', 'Architecture or security whitepaper'],
          ['S-02', 'Encryption in transit', 'TLS 1.2 or higher; TLS 1.3 preferred', 'Supported cipher and protocol list'],
          ['S-03', 'Audit logging', 'Immutable; creation, view, modification, permission change, download', 'Sample log export'],
          ['S-04', 'Access control', 'Granular RBAC with territory and clearance tier', 'Role and permission documentation'],
          ['S-05', 'Data sovereignty', 'US-only storage, processing and support access', 'Region list and data flow description'],
          ['S-06', 'Federated identity', 'SAML 2.0 or OpenID Connect; MFA via IdP', 'Integration guide'],
        ],
      },

      { type: 'h1', text: '6. Third-Party and AI Processing' },
      {
        type: 'p',
        text: 'Where a platform uses AI or machine learning to classify, extract from or summarize Acme content, the vendor must confirm that Acme content is not used to train models available to other customers, that processing stays inside the US boundary described in section 2.4, and that AI-derived metadata is subject to the same access controls and audit logging as the underlying document.',
      },

      { type: 'h1', text: '7. Compliance Mapping' },
      {
        type: 'table',
        head: ['Acme requirement', 'Framework alignment'],
        widths: [40, 60],
        firstColBold: true,
        rows: [
          ['Encryption standards', 'NIST SP 800-53 SC-8, SC-28; ISO/IEC 27001 Annex A.8.24'],
          ['Audit logging', 'NIST SP 800-53 AU family; SOC 2 CC7.2'],
          ['Role-based access', 'NIST SP 800-53 AC-2, AC-3, AC-6; SOC 2 CC6.1'],
          ['Data sovereignty', 'Acme internal policy; customer contractual commitments'],
        ],
      },

      { type: 'h1', text: '8. Responsibilities' },
      {
        type: 'ul',
        items: [
          '**Information Security (CISO office)** owns this mandate, reviews vendor responses against it, and approves exceptions.',
          '**Enterprise Architecture** confirms that the proposed design implements the mandate and documents the data flows.',
          '**Procurement** ensures that these requirements are included in the evaluation and carried into the contract.',
          '**Business owners** (Operations) accept residual risk for any approved exception.',
        ],
      },

      { type: 'h1', text: '9. Exceptions and Review' },
      {
        type: 'p',
        text: 'Requests for exception must be submitted in writing to the CISO office with a description of the control gap, the business reason, the compensating controls, and a proposed end date. Exceptions are time-limited. This mandate is reviewed annually or when Acme\'s regulatory obligations change.',
      },

      { type: 'h1', text: 'Approval and Revision History' },
      {
        type: 'table',
        head: ['Version', 'Date', 'Author', 'Change'],
        widths: [12, 20, 28, 40],
        rows: [
          ['1.0', 'September 12, 2024', 'Information Security', 'Initial draft for review by Enterprise Architecture and Legal'],
          ['1.1', 'September 20, 2024', 'Information Security', 'Added section 6 (AI processing) and section 7 (compliance mapping)'],
          ['2024-89', 'September 25, 2024', 'Marcus Vance, CISO', 'Approved for distribution to shortlisted vendors'],
        ],
      },
    ],
  },
};
