export default {
  file: 'Acme_Current_Architecture.pdf',
  dir: 'Customers/Acme Corp/Technical Specs',
  kind: 'pdf',
  inApp: true,
  spec: {
    title: 'Current State Systems Topology - Acme Corp Onboarding',
    author: 'David Chen',
    subject: 'Current-state architecture for commercial onboarding',
    header: 'Acme Corp | Current State Systems Topology | Internal Architecture',
    footer: 'Internal Architecture - Enterprise Architecture',
    blocks: [
      {
        type: 'title',
        text: 'CURRENT STATE SYSTEMS TOPOLOGY - ACME CORP ONBOARDING',
        subtitle: 'Enterprise Architecture reference document',
      },
      {
        type: 'meta',
        rows: [
          ['Author', 'David Chen, Solutions Architect'],
          ['Department', 'Enterprise Architecture'],
          ['Version', '1.2'],
          ['Last updated', 'September 15, 2024'],
          ['Classification', 'Internal Architecture'],
          ['Audience', 'Enterprise Architecture, IT, Information Security, shortlisted vendors under NDA'],
        ],
      },

      { type: 'h1', text: '1. Purpose' },
      {
        type: 'p',
        text: 'This document describes how commercial customer onboarding is supported by Acme\'s systems today. It is intended to give Acme project teams and prospective vendors a shared picture of the starting point, including the constraints that a replacement solution has to work within.',
      },

      { type: 'h1', text: '2. Current Application Landscape' },
      {
        type: 'ol',
        items: [
          'Ingestion Point: Customer portal uploads land on legacy on-premise Windows SMB file shares.',
          'CRM: Salesforce Sales Cloud (Enterprise Edition) used for lead management and account records.',
          'Pain: No native bridge exists between SMB file storage and Salesforce; ops reps spend 2-3 hours daily manually locating files and retyping metadata.',
          'Search: Windows indexer fails across network shares, creating search friction across onboarding cases.',
          'SSO: Moving towards centralized federated authentication across all corporate cloud services.',
        ],
      },

      { type: 'h1', text: '3. System Inventory' },
      {
        type: 'table',
        head: ['Component', 'Description', 'Hosting', 'Integration with other systems'],
        widths: [20, 36, 16, 28],
        firstColBold: true,
        rows: [
          ['Customer portal', 'Web portal where commercial customers submit onboarding packages', 'Acme data center', 'Writes files to SMB shares; sends email to the intake mailbox'],
          ['SMB file shares (3)', 'Windows file servers holding onboarding files in branch-specific folder structures', 'Acme data center', 'None. No API; accessed through mapped network drives'],
          ['Intake mailbox', 'Shared Outlook mailbox that receives upload notifications', 'Corporate email', 'Manual triage by operations'],
          ['Salesforce Sales Cloud', 'Enterprise Edition. Accounts, opportunities and custom onboarding objects', 'Vendor cloud', 'Manual data entry by operations; no link to file storage'],
          ['Approval communication', 'Outlook email threads between specialists and approvers', 'Corporate email', 'None. No routing rules or status tracking'],
          ['Corporate directory', 'Existing directory used for on-premise systems', 'Acme data center', 'Moving toward federation with cloud services'],
        ],
      },

      { type: 'h1', text: '4. Data Flow Today' },
      {
        type: 'table',
        head: ['Step', 'Actor', 'Action', 'System'],
        widths: [8, 22, 48, 22],
        rows: [
          ['1', 'Customer', 'Uploads onboarding package', 'Customer portal'],
          ['2', 'Portal', 'Stores files and sends notification', 'SMB share; Intake mailbox'],
          ['3', 'Onboarding specialist', 'Locates files, identifies type and account, renames by convention', 'SMB share'],
          ['4', 'Onboarding specialist', 'Searches shares for historical documents', 'SMB share'],
          ['5', 'Onboarding specialist', 'Re-types metadata and timestamps into account record', 'Salesforce'],
          ['6', 'Specialist and approver', 'Exchange approval request and decision by email', 'Outlook'],
          ['7', 'Operations', 'Activates account and informs customer', 'Salesforce; email'],
        ],
      },

      { type: 'h1', text: '5. Constraints and Observations' },
      { type: 'h2', text: '5.1 Storage and search' },
      {
        type: 'ul',
        items: [
          'Folder structures and naming conventions differ by branch, so the same document type may live in different places.',
          'There is no common metadata. The only information about a file is its name and location.',
          'File servers are at the end of their planned life and are expensive to back up and secure.',
        ],
      },
      { type: 'h2', text: '5.2 Integration' },
      {
        type: 'ul',
        items: [
          'Salesforce has no knowledge of the files that relate to an account.',
          'There is no event when a file arrives, so detection relies on the shared mailbox.',
          'Any new integration must authenticate without shared passwords and must support Salesforce Enterprise Edition API limits.',
        ],
      },
      { type: 'h2', text: '5.3 Identity' },
      {
        type: 'ul',
        items: [
          'Cloud services are being moved to centralized federated authentication; the choice of identity provider is still open.',
          'On-premise file shares rely on directory groups and are not integrated with cloud role models.',
        ],
      },

      { type: 'h1', text: '6. Operational Impact' },
      {
        type: 'p',
        text: 'Operations staff estimate that each onboarding specialist spends two to three hours a day locating files and retyping metadata. Search for historical documentation is reported to take 15 minutes or more per case. These figures come from staff estimates in discovery conversations rather than from measured system data; Acme does not currently track time spent per task.',
      },

      { type: 'h1', text: '7. Target-State Requirements Summary' },
      {
        type: 'table',
        head: ['Area', 'Target state'],
        widths: [24, 76],
        firstColBold: true,
        rows: [
          ['Storage', 'Cloud content platform replaces file shares, with US-only data residency'],
          ['Classification', 'Documents classified automatically at upload'],
          ['Search', 'Single search across all onboarding documentation'],
          ['CRM', 'Salesforce receives metadata and shows document previews without manual entry'],
          ['Workflow', 'Approvals routed and tracked in the platform with escalation'],
          ['Identity', 'Single sign-on through the corporate identity provider'],
        ],
      },

      { type: 'h1', text: '8. Open Items' },
      {
        type: 'ul',
        items: [
          'Total volume and count of files on the three SMB shares has not been inventoried.',
          'Identity provider selection is pending.',
          'Master system of record for document metadata is undecided.',
        ],
      },
      {
        type: 'p',
        text: 'Related documents: Technical Requirements Matrix v1.4, Salesforce Integration Specification, Architecture Workshop Notes (September 28, 2024).',
      },
    ],
  },
};
