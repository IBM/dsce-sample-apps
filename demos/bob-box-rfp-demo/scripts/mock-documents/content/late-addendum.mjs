export default {
  file: 'Acme_Late_Addendum_BAA_Compliance.pdf',
  dir: '',
  kind: 'pdf',
  inApp: false, // local-only demo file; not part of the 12 Box documents
  spec: {
    title: 'Acme Corp - Late Addendum & Compliance Mandate',
    author: 'Marcus Vance, CISO Office',
    subject: 'ACME-ADDENDUM-2024-Q3-09',
    header: 'Acme Corp | ACME-ADDENDUM-2024-Q3-09 | Urgent / Executive Mandate',
    footer: 'Urgent / Executive Mandate - Acme Commercial Corp',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP - LATE ADDENDUM & COMPLIANCE MANDATE',
        subtitle: 'Addendum to the content platform security requirements for healthcare and life sciences onboarding',
      },
      {
        type: 'meta',
        rows: [
          ['Document ID', 'ACME-ADDENDUM-2024-Q3-09'],
          ['Date', 'September 29, 2024'],
          ['Author', 'Marcus Vance (CISO Office, Acme Commercial Corp)'],
          ['Classification', 'Urgent / Executive Mandate'],
          ['Supplements', 'SEC-POL-2024-89 Information Security & Compliance Mandate; RFP-2024-CONTENT-09'],
        ],
      },

      { type: 'h1', text: 'Critical New Requirement for Tomorrow\'s Demo' },
      {
        type: 'p',
        text: 'Due to Acme\'s expansion into commercial healthcare and life sciences client onboarding, the prospective solution MUST satisfy the following immediate compliance prerequisites:',
      },
      {
        type: 'ol',
        items: [
          {
            text: '**Business Associate Agreement (BAA) Support:** The content platform and AI agent pipeline must be fully HIPAA-compliant with formal BAA execution capabilities.',
            sub: [
              'The vendor must be willing to sign a BAA covering every service that touches Acme content, including AI-based processing.',
              'Sub-processors that handle protected health information must be covered by equivalent agreements.',
            ],
          },
          {
            text: '**PHI Automated Redaction / Masking:** Any ingested tax packets or identity documentation containing Protected Health Information (PHI) or patient identifiers must be flagged and masked before indexing into general workflow streams.',
            sub: [
              'Flagged documents must be separated from the general workflow until reviewed.',
              'Masking must apply to previews and to search indices, not only to the stored file.',
            ],
          },
          {
            text: '**Dedicated US-East Healthcare Vaulting:** All healthcare commercial onboarding assets must be cryptographically pinned to US-East data centers with customer-managed encryption keys (CMEK).',
            sub: [
              'Keys must be under Acme\'s control, with the ability to revoke access.',
              'This is in addition to the general US data residency requirement.',
            ],
          },
        ],
      },

      { type: 'h1', text: 'Action for Demo Team' },
      {
        type: 'callout',
        label: 'Request:',
        text: 'Please ensure tomorrow\'s demonstration includes a dedicated walkthrough of Box Governance classification tags for HIPAA/PHI and demonstrates automated BAA contract generation.',
      },

      { type: 'h1', text: 'Relationship to Existing Requirements' },
      {
        type: 'table',
        head: ['Area', 'Existing requirement', 'Addendum adds'],
        widths: [20, 38, 42],
        firstColBold: true,
        rows: [
          ['Encryption', 'AES-256 at rest; TLS 1.2 or higher in transit (SEC-POL-2024-89)', 'Customer-managed encryption keys for healthcare assets'],
          ['Data residency', 'Continental US only', 'Healthcare assets pinned to US-East'],
          ['Audit', 'Immutable logging; 365-day minimum', 'No change; PHI access must be included'],
          ['Classification', 'Automated classification of onboarding documents (RFP 3.1)', 'Detection and masking of PHI before indexing'],
          ['Contracts', 'None', 'BAA execution and generation'],
        ],
      },

      { type: 'h1', text: 'Open Points' },
      {
        type: 'ul',
        items: [
          'Scope of BAA coverage, including whether secondary staging environments are in scope, has not been defined.',
          'Whether all onboarding documents or only healthcare-related accounts require CMEK has not been confirmed.',
          'Acme has not stated what share of onboarding volume is expected to involve PHI.',
        ],
      },
      {
        type: 'p',
        text: 'Questions about this addendum should be directed to the CISO office. This addendum was issued after the RFP and supersedes any conflicting statement in earlier documents.',
      },
    ],
  },
};
