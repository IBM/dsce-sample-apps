export default {
  file: 'Data_Governance_Requirements.pdf',
  dir: 'Customers/Acme Corp/Security & Compliance',
  kind: 'pdf',
  inApp: true,
  spec: {
    title: 'Acme Corp Data Governance & Compliance Framework',
    author: 'Marcus Vance',
    subject: 'Data Governance and Compliance Framework v2.1',
    header: 'Acme Corp | Data Governance & Compliance Framework v2.1 | Corporate Policy',
    footer: 'Corporate Policy - Information Security & Legal',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP DATA GOVERNANCE & COMPLIANCE FRAMEWORK',
        subtitle: 'Corporate policy for the governance of customer onboarding data',
      },
      {
        type: 'meta',
        rows: [
          ['Approved', 'October 4, 2024'],
          ['Version', '2.1'],
          ['Owner', 'Marcus Vance (CISO)'],
          ['Co-owner', 'Legal and Compliance'],
          ['Classification', 'Corporate Policy'],
          ['Next scheduled review', 'October 2025'],
        ],
      },

      { type: 'h1', text: '1. Purpose and Scope' },
      {
        type: 'p',
        text: 'This framework establishes how Acme governs the data it holds about commercial customers, from the moment a document is received to its disposal. It applies to all repositories, applications and service providers that handle customer onboarding content, and to all employees and contractors with access to it. It complements the Information Security and Compliance Mandate (SEC-POL-2024-89), which defines the technical controls.',
      },

      { type: 'h1', text: '2. Governance Mandates' },
      {
        type: 'ol',
        items: [
          'Audit Logs: Mandatory retention of administrative and access audit logs for a minimum of 365 days.',
          'US Data Residency: Strict restriction that data must never leave US regional borders.',
          'Open Policy Questions: see section 5.',
        ],
      },

      { type: 'h1', text: '3. Data Classification' },
      {
        type: 'table',
        head: ['Class', 'Description', 'Examples in onboarding', 'Handling'],
        widths: [14, 28, 30, 28],
        firstColBold: true,
        rows: [
          ['Restricted', 'Data whose exposure would cause serious harm or regulatory breach', 'Tax identification numbers, KYC identity documents', 'Encrypted; least-privilege access; all access logged'],
          ['Confidential', 'Business-sensitive data', 'Contracts, certificates of insurance, formation documents', 'Encrypted; access by role and territory'],
          ['Internal', 'Operational data not intended for public release', 'Workflow status, internal notes', 'Standard access controls'],
          ['Public', 'Data approved for release', 'Published marketing material', 'No special handling'],
        ],
      },

      { type: 'h1', text: '4. Policy Requirements' },
      { type: 'h2', text: '4.1 Audit logs' },
      {
        type: 'p',
        text: 'Administrative and access audit logs must be kept for a minimum of 365 days and must be protected from alteration. Logs must be retrievable for investigation and audit within a reasonable time and exportable to Acme\'s SIEM. Longer retention may be required by Legal for specific matters.',
      },
      { type: 'h2', text: '4.2 Data residency' },
      {
        type: 'p',
        text: 'Customer onboarding data, including replicas, backups, indices and derived content, must not leave the United States. Service providers must document the locations in which data is stored and processed and may not change them without Acme\'s consent.',
      },
      { type: 'h2', text: '4.3 Access and sharing' },
      {
        type: 'ul',
        items: [
          'Access is granted by role, territory and clearance tier, and reviewed at least annually.',
          'External sharing of Confidential or Restricted data requires business-owner approval, a defined end date and full logging.',
          'Documents must not be sent by email attachment to external parties where a controlled sharing mechanism exists.',
        ],
      },
      { type: 'h2', text: '4.4 Retention and disposal' },
      {
        type: 'p',
        text: 'Customer records are retained for a period set by the Corporate Records Retention Schedule and disposed of securely at the end of that period unless a legal hold applies. The schedule for onboarding files is under review (see section 5).',
      },

      { type: 'h1', text: '5. Open Policy Questions' },
      {
        type: 'ul',
        items: [
          'Corporate Records Retention Schedule: Legal and Compliance teams are evaluating whether onboarding files should be retained for 3 years or 7 years post-account closure.',
          'Monthly Ingestion Document Volume: Total monthly ingestion volume across all branches is currently unmetered and pending operational audit.',
        ],
      },
      {
        type: 'table',
        head: ['Question', 'Decision owner', 'Impact on platform selection'],
        widths: [32, 22, 46],
        firstColBold: true,
        rows: [
          ['Retention period: 3 years or 7 years after account closure', 'Legal and Compliance', 'Platform must support either period and allow it to change without re-ingesting content'],
          ['Monthly ingestion volume', 'Operations', 'Needed for capacity, performance testing and pricing; no figure available'],
        ],
      },

      { type: 'h1', text: '6. Roles and Responsibilities' },
      {
        type: 'table',
        head: ['Role', 'Responsibility'],
        widths: [28, 72],
        firstColBold: true,
        rows: [
          ['CISO', 'Owns this framework; approves exceptions; oversees logging and monitoring'],
          ['Legal and Compliance', 'Owns the retention schedule and legal holds'],
          ['Data owners (Operations)', 'Classify data, approve access and external sharing'],
          ['IT', 'Implements and operates controls'],
          ['Internal Audit', 'Periodically tests compliance with this framework'],
        ],
      },

      { type: 'h1', text: '7. Compliance and Review' },
      {
        type: 'p',
        text: 'Compliance with this framework is tested through internal audit and, where relevant, through vendor assessments. Exceptions must be requested in writing and approved by the CISO. This framework is reviewed annually or when regulatory requirements change.',
      },

      { type: 'h1', text: 'Revision History' },
      {
        type: 'table',
        head: ['Version', 'Date', 'Summary'],
        widths: [12, 22, 66],
        rows: [
          ['1.0', 'January 2023', 'Initial framework'],
          ['2.0', 'March 2024', 'Added data residency and external sharing rules'],
          ['2.1', 'October 4, 2024', 'Clarified audit log retention minimum; recorded open questions on retention and ingestion volume'],
        ],
      },
    ],
  },
};
