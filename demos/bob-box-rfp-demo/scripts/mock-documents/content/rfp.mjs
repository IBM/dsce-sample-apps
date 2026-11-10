export default {
  file: 'Acme_RFP.pdf',
  dir: 'Customers/Acme Corp/RFPs & Proposals',
  kind: 'pdf',
  inApp: true,
  spec: {
    title: 'Request for Proposal - Acme Corp Cloud Content Platform',
    author: 'Rachel Green',
    subject: 'RFP-2024-CONTENT-09',
    header: 'Acme Corp | RFP-2024-CONTENT-09 | Commercial Confidential',
    footer: 'Commercial Confidential - Acme Corp Procurement',
    blocks: [
      {
        type: 'title',
        text: 'REQUEST FOR PROPOSAL (RFP) - ACME CORP CLOUD CONTENT PLATFORM',
        subtitle: 'Replacement of file-share-based commercial onboarding repositories',
      },
      {
        type: 'meta',
        rows: [
          ['RFP Reference', 'RFP-2024-CONTENT-09'],
          ['Issued by', 'Acme Corp Procurement'],
          ['Owner', 'Rachel Green, Director of Procurement & IT'],
          ['Issue date', 'October 2, 2024'],
          ['Questions due', 'October 11, 2024'],
          ['Response due', 'October 25, 2024, 5:00 PM Eastern'],
          ['Classification', 'Commercial Confidential'],
        ],
      },

      { type: 'h1', text: 'Section 1: Introduction and Background' },
      {
        type: 'p',
        text: 'Acme Corp onboards hundreds of new commercial accounts every month. Onboarding packages are received through the customer portal and stored on legacy on-premise file shares, where operations staff classify, search and review them manually. Account metadata is then re-entered by hand into Salesforce Sales Cloud. Acme seeks a cloud content platform that removes these manual steps, provides auditable approval workflows, and meets Acme\'s security and data governance requirements.',
      },
      {
        type: 'p',
        text: 'This RFP invites qualified vendors to propose a solution. Acme intends to select a shortlist, hold demonstrations with its operations and IT teams, and make an award decision following technical and security review.',
      },

      { type: 'h1', text: 'Section 2: Scope of Work' },
      {
        type: 'ul',
        items: [
          'Ingest and store commercial onboarding documents, including tax records, certificates of insurance, formation documents, KYC filings and contracts.',
          'Classify documents automatically and associate them with the correct customer account.',
          'Integrate with Salesforce Sales Cloud for metadata exchange and embedded document preview.',
          'Provide configurable approval workflows with status tracking and escalation.',
          'Provide enterprise search across all indexed onboarding documentation.',
          'Support migration of existing content from legacy file shares.',
          'Meet the security, audit and data governance requirements in Section 4 and the referenced Acme policies.',
        ],
      },

      { type: 'h1', text: 'Section 3: Mandatory Functional Requirements' },
      {
        type: 'ul',
        items: [
          '3.1 Automated Classification: The platform must automatically classify ingested onboarding collateral (W-9s, Certificate of Incorporation, KYC filings) without manual human labeling.',
          '3.2 Salesforce Integration: Seamless integration with Salesforce CRM, allowing account executives to trigger intake requests and view synchronized document records.',
          '3.3 Approval Workflows: Out-of-the-box streamlined approval workflows with configurable multi-stage escalation and status tracking.',
          '3.4 Role-Based Access Controls: Tiered permissions for Admins, Reviewers, and Viewers.',
          '3.5 Search: Comprehensive full-text search across all indexed customer documents.',
        ],
      },
      { type: 'h2', text: 'Response guidance for Section 3' },
      {
        type: 'table',
        head: ['Ref', 'Vendor must describe', 'Acme will evaluate'],
        widths: [8, 52, 40],
        rows: [
          ['3.1', 'Supported document types, how classification works, how confidence is reported, and what happens to low-confidence results', 'Accuracy on a sample set; ability to route exceptions to people'],
          ['3.2', 'Integration method, authentication, supported objects, and whether preview is embedded in the Account page', 'Absence of manual copying; setup effort'],
          ['3.3', 'Workflow designer, routing rules, escalation, notifications and status visibility', 'Ability to replace email-based approvals'],
          ['3.4', 'Role model, how roles map to identity provider groups, and territory restrictions', 'Granularity and administrative effort'],
          ['3.5', 'Indexing scope, search performance, and handling of scanned documents', 'Time to find prior documentation for an account'],
        ],
      },

      { type: 'h1', text: 'Section 4: Compliance & Legal' },
      {
        type: 'ul',
        items: [
          '4.1 Audit Logs: Tamper-evident logging of all user activities.',
          '4.2 Records Retention: Vendor must provide automated document lifecycle and retention scheduling. Note: Acme legal team is currently reviewing corporate records-retention schedules (3 years vs. 7 years).',
        ],
      },
      {
        type: 'p',
        text: 'Vendors must configure retention by document class and by account closure date, and must be able to change the retention period without re-ingesting content. Acme will supply the final schedule after Legal completes its review; the proposal should show that either period can be supported.',
      },

      { type: 'h1', text: 'Section 5: Technical and Security Requirements' },
      {
        type: 'table',
        head: ['Ref', 'Requirement', 'Reference document'],
        widths: [8, 62, 30],
        rows: [
          ['5.1', 'Single sign-on using SAML 2.0 or OpenID Connect', 'Technical Requirements Matrix, REQ-01'],
          ['5.2', 'REST API and webhooks for upload, metadata and workflow status', 'Technical Requirements Matrix, REQ-02'],
          ['5.3', 'Encryption in transit (TLS 1.2 or higher) and at rest (AES-256)', 'Security Mandate SEC-POL-2024-89'],
          ['5.4', 'US data residency for storage and processing', 'Security Mandate SEC-POL-2024-89'],
          ['5.5', 'Audit log retention and export', 'Data Governance Framework v2.1'],
        ],
      },

      { type: 'h1', text: 'Section 6: Vendor Response Instructions' },
      {
        type: 'ol',
        items: [
          'Submit the response as a single PDF plus a completed requirements spreadsheet.',
          'Answer each numbered requirement as Meets, Partially meets, Roadmap, or Does not meet.',
          'Provide two customer references of similar scale in a regulated industry.',
          'Provide pricing in the template supplied with this RFP.',
          'Identify all sub-processors and the locations in which content is stored and processed.',
        ],
      },

      { type: 'h1', text: 'Section 7: Evaluation Criteria' },
      {
        type: 'table',
        head: ['Criterion', 'Weight'],
        widths: [70, 30],
        firstColBold: true,
        rows: [
          ['Functional fit (Section 3)', '35%'],
          ['Security, compliance and data governance (Sections 4 and 5)', '25%'],
          ['Integration with Salesforce and existing systems', '15%'],
          ['Implementation approach and migration plan', '10%'],
          ['Commercial terms and total cost', '10%'],
          ['Vendor viability and references', '5%'],
        ],
      },

      { type: 'h1', text: 'Section 8: Timeline' },
      {
        type: 'table',
        head: ['Milestone', 'Date'],
        widths: [70, 30],
        rows: [
          ['RFP issued', 'October 2, 2024'],
          ['Vendor questions due', 'October 11, 2024'],
          ['Acme responses to questions', 'October 15, 2024'],
          ['Proposals due', 'October 25, 2024'],
          ['Shortlist demonstrations', 'Week of October 28, 2024'],
          ['Award decision', 'Mid-November 2024'],
        ],
      },

      { type: 'h1', text: 'Section 9: Terms' },
      {
        type: 'p',
        text: 'This RFP does not commit Acme to award a contract. All information provided by Acme is confidential and may be used only to prepare a response. Acme may amend the RFP, extend deadlines or cancel the process at its discretion. Responses become the property of Acme.',
      },
    ],
  },
};
