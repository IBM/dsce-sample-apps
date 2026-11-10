export default {
  file: 'Acme_Discovery_Notes.docx',
  dir: 'Customers/Acme Corp/Discovery Notes',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'Acme Corp - Customer Onboarding Discovery Session',
    author: 'Sarah Jenkins',
    subject: 'Discovery session notes - Acme Corp commercial customer onboarding',
    header: 'Acme Corp | Customer Onboarding Discovery Session | September 18, 2024',
    footer: 'Internal / Confidential - Account team distribution only',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP - CUSTOMER ONBOARDING DISCOVERY SESSION',
        subtitle: 'Discovery meeting notes  |  Prepared by Sarah Jenkins, Enterprise Account Executive',
      },
      {
        type: 'meta',
        rows: [
          ['Date', 'September 18, 2024'],
          ['Participants', 'Sarah Jenkins (AE), Marcus Vance (SE), David Chen (Acme VP Ops), Rachel Green (Acme IT Director)'],
          ['Format', 'Video conference, 90 minutes'],
          ['Prepared by', 'Sarah Jenkins, Enterprise Account Executive'],
          ['Status', 'Final - circulated to attendees for corrections'],
        ],
      },

      { type: 'h1', text: 'Executive Summary' },
      {
        type: 'p',
        text: 'Acme Corp processes hundreds of new commercial accounts every month. The current onboarding workflow suffers from acute friction due to fragmented content repositories and manual document handling.',
      },
      {
        type: 'p',
        text: 'David Chen and Rachel Green walked the account team through the full onboarding journey, from the moment a new commercial customer submits its package to the point the account is activated in Salesforce. Every stage of that journey currently depends on people opening files, deciding what they are, deciding where they belong, and re-typing what they find. Four themes came up repeatedly: manual classification, disconnected repositories, re-keying of data into Salesforce, and approvals that run through email.',
      },
      {
        type: 'callout',
        label: 'Headline:',
        text: 'Automated classification at intake and a direct Salesforce hand-off were the two outcomes both stakeholders returned to most often. Neither stakeholder asked for new features for their own sake; both framed every request as removing a manual step that exists today.',
      },

      { type: 'h1', text: 'Meeting Context and Attendees' },
      {
        type: 'p',
        text: 'This was the first working session after the initial introductory call. The goal was to understand how commercial account onboarding actually runs day to day, where time and accuracy are lost, and what Acme would consider a successful replacement. No solution was presented; the account team listened and asked questions.',
      },
      {
        type: 'table',
        head: ['Attendee', 'Organization / Role', 'Primary interest in the session'],
        widths: [22, 30, 48],
        rows: [
          ['Sarah Jenkins', 'Account Executive', 'Commercial relationship, alignment with Acme procurement timeline'],
          ['Marcus Vance', 'Solutions Engineering (SE)', 'Technical discovery, integration and security questions'],
          ['David Chen', 'Acme - VP Operations', 'Operational throughput, intake backlog, Salesforce data quality'],
          ['Rachel Green', 'Acme - IT Director', 'Repository consolidation, workflow tooling, integration with existing systems'],
        ],
      },

      { type: 'h1', text: 'Current-State Onboarding Workflow' },
      {
        type: 'p',
        text: 'The following sequence was reconstructed from the discussion. Acme confirmed that it reflects how most commercial accounts are onboarded today, although individual branches add their own variations.',
      },
      {
        type: 'ol',
        items: [
          'A new commercial customer (or its broker) submits an onboarding package through the Acme customer portal. Packages typically include tax records such as W-9s, certificates of insurance, contracts, and corporate formation documents.',
          'Uploaded files are written to legacy on-premise file shares. The only notification is an email to a shared intake mailbox.',
          'An onboarding specialist opens each file, decides what type of document it is and which account it belongs to, and renames or tags it by hand.',
          'If the account has a history, the specialist searches the file shares and network drives for earlier documentation to compare against.',
          'Once the files are reviewed, the specialist re-types key client metadata and validation timestamps into the Salesforce account record.',
          'An approval request is sent to the underwriting approver by email. Follow-ups happen by email or by phone.',
          'After approval, the account is activated and the customer is notified. There is no single place that shows where a given package currently sits.',
        ],
      },

      { type: 'h1', text: 'Key Pain Points Discussed' },
      {
        type: 'ol',
        items: [
          {
            text: '**Manual Document Classification:** Operations staff manually inspect uploaded PDF/DOCX tax records, certificates of insurance, and contracts to tag them by account and document type. This introduces human error and creates a 48-hour backlog.',
            sub: [
              'David noted that the backlog is felt most at month end, when account managers are waiting on packages that have been received but not yet touched.',
              'Mis-tagged documents are usually only discovered later, when an approver cannot find a required certificate and sends the package back.',
            ],
          },
          {
            text: '**Disconnected Content Repositories:** Onboarding specialists search across three legacy file shares and shared network drives, complaining that "finding historical customer documentation takes 15+ minutes per case."',
            sub: [
              'Rachel explained that the Windows search index does not work reliably across the shares, so specialists fall back on folder naming conventions that differ by branch.',
              'Institutional knowledge about where things live sits with a small number of long-tenured staff.',
            ],
          },
          {
            text: '**Manual Data Re-entry into Salesforce:** Once files are reviewed, ops personnel manually re-type client metadata and validation timestamps into Salesforce account records.',
            sub: [
              'Re-keyed values (account number, verification status, timestamps) occasionally disagree with the source document, which creates downstream reconciliation work.',
              'Salesforce is the system the sales and service teams trust, so errors there are visible to customers.',
            ],
          },
          {
            text: '**Slow Approvals:** Approval requests are circulated via email chains without standardized routing rules.',
            sub: [
              'There is no defined escalation path when an approver is unavailable.',
              'Account managers have to ask operations for status because they cannot see it themselves.',
            ],
          },
        ],
      },

      { type: 'h1', text: 'Stated Goals for New Solution' },
      {
        type: 'ul',
        items: [
          'Implement automated document classification upon intake.',
          'Enable direct synchronization with Salesforce Sales Cloud to eliminate manual data entry.',
          'Centralize search across all customer onboarding documentation.',
          'Provide real-time workflow status visibility.',
        ],
      },

      { type: 'h1', text: 'Additional Discussion' },
      { type: 'h2', text: 'Document types in scope' },
      {
        type: 'p',
        text: 'Acme listed the document types that make up a typical commercial onboarding package. These are the types any classification capability would need to recognize at intake.',
      },
      {
        type: 'table',
        head: ['Document type', 'Examples', 'Why it matters'],
        widths: [24, 36, 40],
        rows: [
          ['Tax records', 'W-9, other tax identification forms', 'Required to verify the legal entity and tax identity before activation'],
          ['Insurance', 'Certificates of insurance', 'Coverage must be verified and tracked for expiry'],
          ['Corporate formation', 'Certificate of Incorporation', 'Confirms legal existence and signing authority'],
          ['Know-your-customer', 'KYC filings and supporting identification', 'Compliance review before account approval'],
          ['Contracts', 'Master agreements, high-value contracts', 'Reviewed by operations and, for high-value items, by legal'],
        ],
      },
      { type: 'h2', text: 'Salesforce usage' },
      {
        type: 'p',
        text: 'Acme runs Salesforce Sales Cloud and stores onboarding status on account records and a small number of custom objects. David was clear that Salesforce stays the day-to-day CRM; the aim is to stop people re-typing information into it, not to change it.',
      },
      { type: 'h2', text: 'What good looks like' },
      {
        type: 'p',
        text: 'Neither stakeholder offered numeric targets. Rachel described success as a package being classified at the moment it is uploaded rather than hours later, and as an account manager being able to answer a customer\'s "where is my package" question without calling operations. David described success as ops staff spending their time on exceptions instead of routine sorting and typing.',
      },

      { type: 'h1', text: 'Information Not Yet Available' },
      {
        type: 'ul',
        items: [
          'Monthly document volume: Acme could not provide a figure during the session. David will check whether intake is measured at branch level anywhere.',
          'Records retention: Acme\'s legal team is reviewing the corporate retention schedule, so no retention period was confirmed.',
          'Identity provider: single sign-on is a requirement, but the choice of identity provider had not been settled.',
          'Security requirements: the CISO\'s office will share its written requirements separately.',
        ],
      },

      { type: 'h1', text: 'Action Items' },
      {
        type: 'table',
        head: ['#', 'Action', 'Owner', 'Target date'],
        widths: [5, 55, 20, 20],
        rows: [
          ['1', 'Share the enterprise content platform technical requirements matrix', 'David Chen', 'Sep 23'],
          ['2', 'Share the current-state architecture overview, including the file share inventory', 'Rachel Green', 'Sep 23'],
          ['3', 'Schedule an architecture workshop on Salesforce integration and metadata ownership', 'Sarah Jenkins', 'Sep 20'],
          ['4', 'Confirm whether branch-level intake measurements exist', 'David Chen', 'Sep 27'],
          ['5', 'Send meeting notes to all attendees for correction', 'Sarah Jenkins', 'Sep 19'],
        ],
      },
      { type: 'h1', text: 'Next Steps' },
      {
        type: 'p',
        text: 'An architecture workshop with Acme\'s solutions architect and the account team is planned for September 28, followed by a short alignment call on September 30. These notes will be updated if attendees send corrections.',
      },
    ],
  },
};
