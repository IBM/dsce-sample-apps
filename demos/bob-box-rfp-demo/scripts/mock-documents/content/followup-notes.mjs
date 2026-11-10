export default {
  file: 'September_Follow_Up_Notes.docx',
  dir: 'Customers/Acme Corp/Discovery Notes',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'Acme Corp - September Follow-Up Alignment Call',
    author: 'Sarah Jenkins',
    subject: 'Follow-up call notes, September 30, 2024',
    header: 'Acme Corp | September Follow-Up Alignment Call | September 30, 2024',
    footer: 'Internal / Confidential - Sales',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP - SEPTEMBER FOLLOW-UP ALIGNMENT CALL',
        subtitle: 'Notes from the follow-up call after the architecture workshop',
      },
      {
        type: 'meta',
        rows: [
          ['Date', 'September 30, 2024'],
          ['Attendees', 'Sarah Jenkins, Marcus Vance, Rachel Green'],
          ['Duration', '30 minutes'],
          ['Prepared by', 'Sarah Jenkins, Enterprise Account Executive'],
          ['Classification', 'Internal / Confidential'],
        ],
      },

      { type: 'h1', text: 'Purpose of the Call' },
      {
        type: 'p',
        text: 'A short alignment call after the September 28 architecture workshop to confirm priorities, check progress on open items, and agree what the demonstration should concentrate on. David Chen was unable to attend; Rachel Green represented Acme.',
      },

      { type: 'h1', text: 'Discussion Highlights' },
      {
        type: 'ol',
        items: [
          {
            text: 'Automated Classification: Rachel emphasized that automating classification of onboarding packages is their highest immediate operational goal.',
            sub: [
              'She said that if only one capability could be shown, it should be classification followed by routing, because the 48-hour backlog sits at the front of the process and delays everything after it.',
              'She asked that the demonstration use realistic documents rather than clean samples, including at least one that is hard to classify, so the team can see how exceptions are handled.',
            ],
          },
          {
            text: 'External Collaboration: Rachel mentioned that Acme occasionally invites external legal counsel to review high-value contracts, but the exact number of external collaborators is currently unknown and undergoing audit.',
            sub: [
              'Today these reviews happen by emailing documents, which Acme\'s security team would like to stop.',
              'Rachel expects the audit to finish in several weeks. Until then Acme cannot say how many external users the platform would need to support.',
              'Marcus noted that external access will need to be limited by document and time period and fully logged.',
            ],
          },
          {
            text: 'Identity Provider: Still unresolved whether corporate SSO will standardize on Okta or Microsoft Azure AD.',
            sub: [
              'Rachel said the decision is with the CISO office and no date has been set.',
              'The demonstration should avoid assuming one provider and should explain that SAML 2.0 and OpenID Connect are supported with either.',
            ],
          },
        ],
      },

      { type: 'h1', text: 'Status of Open Items' },
      {
        type: 'table',
        head: ['Item', 'Owner', 'Status after this call'],
        widths: [46, 22, 32],
        firstColBold: true,
        rows: [
          ['Identity provider selection', 'CISO office', 'Unresolved'],
          ['System of record for document metadata', 'Architecture team', 'Unresolved'],
          ['Records retention period', 'Legal / Compliance', 'Under review'],
          ['Count of external collaborators', 'Rachel Green', 'Audit in progress'],
          ['Monthly ingestion volume', 'David Chen', 'Not measured'],
        ],
      },

      { type: 'h1', text: 'Agreed Focus for the Demonstration' },
      {
        type: 'ul',
        items: [
          'Automated classification of a realistic onboarding package, with exception handling.',
          'Automatic routing to the next reviewer and visible status.',
          'The Salesforce hand-off from upload to Account record.',
          'Role-specific views for intake, approval and audit.',
          'Reserve time at the end for questions from IT and security.',
        ],
      },

      { type: 'h1', text: 'Action Items' },
      {
        type: 'table',
        head: ['#', 'Action', 'Owner', 'Due'],
        widths: [5, 58, 20, 17],
        rows: [
          ['1', 'Send the proposed demo outline to Rachel and David', 'Sarah Jenkins', 'Oct 1'],
          ['2', 'Prepare a hard-to-classify sample document for the demonstration', 'Marcus Vance', 'Oct 4'],
          ['3', 'Confirm timing for the external collaborator audit', 'Rachel Green', 'Oct 4'],
          ['4', 'Ask the CISO office for an expected date for the identity provider decision', 'Rachel Green', 'Oct 7'],
        ],
      },
    ],
  },
};
