export default {
  file: 'Customer_Workflow_Notes.docx',
  dir: 'Customers/Acme Corp/Workshop & Alignment',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'Customer Onboarding Workflow Analysis & Pain Points',
    author: 'Rachel Green',
    subject: 'Operational analysis of the commercial onboarding workflow',
    header: 'Acme Corp | Customer Onboarding Workflow Analysis',
    footer: 'Internal Notes - Business Operations',
    blocks: [
      {
        type: 'title',
        text: 'CUSTOMER ONBOARDING WORKFLOW ANALYSIS & PAIN POINTS',
        subtitle: 'Operational breakdown of approvals and status visibility',
      },
      {
        type: 'meta',
        rows: [
          ['Documented by', 'Rachel Green, IT Director'],
          ['Department', 'Business Operations / IT'],
          ['Date', 'September 20, 2024'],
          ['Method', 'Observation of two onboarding specialists and one approver; review of 20 recent cases in the intake mailbox'],
          ['Classification', 'Internal Notes'],
        ],
      },

      { type: 'h1', text: 'Summary' },
      {
        type: 'p',
        text: 'This note records how approvals actually move through the commercial onboarding process and where they stall. It is based on observation and a review of recent email threads, not on system metrics, because no system currently measures approval time. The findings are qualitative.',
      },

      { type: 'h1', text: 'Operational Workflow Bottlenecks' },
      {
        type: 'ol',
        items: [
          'Approval Inconsistencies: Document approvals are sent through ad-hoc Outlook email threads. If a reviewer is out of office, onboarding applications stall for days with zero automated escalation.',
          'Lack of Status Visibility: Business users and account managers have no centralized dashboard to check whether a customer\'s compliance package is pending review, approved, or rejected.',
          'Stated Need: A streamlined, automated approval workflow with clear status indicators at every stage of the document lifecycle.',
        ],
      },

      { type: 'h1', text: 'How Approvals Work Today' },
      {
        type: 'table',
        head: ['Stage', 'What happens', 'Who', 'Tool', 'Typical problem'],
        widths: [14, 32, 16, 12, 26],
        firstColBold: true,
        rows: [
          ['Review', 'Specialist checks the package for completeness', 'Onboarding specialist', 'File share', 'Missing documents discovered late'],
          ['Request', 'Specialist emails the approver with a list of attached or linked files', 'Onboarding specialist', 'Outlook', 'Links point to shares the approver may not reach'],
          ['Decision', 'Approver replies approve, reject or request more information', 'Underwriting approver', 'Outlook', 'Reply buried among other messages'],
          ['Follow-up', 'Specialist chases if no reply', 'Onboarding specialist', 'Outlook / phone', 'No standard time before chasing'],
          ['Record', 'Outcome typed into Salesforce', 'Onboarding specialist', 'Salesforce', 'Outcome and email can disagree'],
        ],
      },

      { type: 'h1', text: 'Observations' },
      { type: 'h2', text: 'Out-of-office coverage' },
      {
        type: 'p',
        text: 'No delegate is defined for approvers. When an approver is away, the request stays in that person\'s mailbox. Specialists usually notice after a customer or account manager asks, and then forward the request manually to someone else, repeating the explanation. In the cases reviewed, stalls of several days were attributed to this pattern.',
      },
      { type: 'h2', text: 'Status questions' },
      {
        type: 'p',
        text: 'Account managers regularly email or call operations to ask where a customer\'s package stands. Operations answers by searching the intake mailbox and the file shares. This is both interruptive and error-prone, because the answer depends on whoever last touched the case.',
      },
      { type: 'h2', text: 'Rework' },
      {
        type: 'p',
        text: 'Several threads included a request for a missing document that was already on the share under a different name. This is a consequence of manual classification and inconsistent naming rather than a workflow issue in isolation.',
      },

      { type: 'h1', text: 'Requirements Derived from the Analysis' },
      {
        type: 'table',
        head: ['#', 'Requirement', 'Addresses'],
        widths: [6, 62, 32],
        rows: [
          ['1', 'Routing rules that send a package to the correct approver based on attributes of the account', 'Ad-hoc routing'],
          ['2', 'Automatic escalation or reassignment when an approval is not actioned within a set period or the approver is unavailable', 'Out-of-office stalls'],
          ['3', 'A status view showing pending review, approved or rejected for each package', 'No visibility'],
          ['4', 'The approver sees the documents inside the approval task rather than via links to shares', 'Access and rework'],
          ['5', 'Decision and timestamp recorded once and shared with Salesforce', 'Duplicate entry'],
        ],
      },

      { type: 'h1', text: 'Limits of This Analysis' },
      {
        type: 'ul',
        items: [
          'Only 20 cases from one period were reviewed; the sample is not statistically representative.',
          'No measurement of approval time or case volume exists, so no baseline figure is given.',
          'Branch-level practices were not compared.',
        ],
      },
    ],
  },
};
