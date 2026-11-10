export default {
  file: 'Architecture_Workshop_Notes.docx',
  dir: 'Customers/Acme Corp/Workshop & Alignment',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'Acme Corp - Architecture Workshop Notes: Onboarding Content Integration',
    author: 'Elena Rostova',
    subject: 'Architecture workshop - onboarding content and Salesforce integration',
    header: 'Acme Corp | Architecture Workshop Notes | September 28, 2024',
    footer: 'Internal Working Draft',
    blocks: [
      {
        type: 'title',
        text: 'ACME CORP - ARCHITECTURE WORKSHOP NOTES: ONBOARDING CONTENT INTEGRATION',
        subtitle: 'Working session on system boundaries, Salesforce integration and open architectural decisions',
      },
      {
        type: 'meta',
        rows: [
          ['Date', 'September 28, 2024'],
          ['Lead', 'David Chen (Acme), Elena Rostova (Lead SE)'],
          ['Other attendees', 'Rachel Green (Acme IT Director), Marcus Vance (SE), Acme integration engineering lead'],
          ['Duration', '3 hours (two working blocks and a wrap-up)'],
          ['Status', 'Internal Working Draft - decisions marked Open are not agreed'],
        ],
      },

      { type: 'h1', text: 'Purpose' },
      {
        type: 'p',
        text: 'The workshop had three aims: agree the boundaries between the systems involved in commercial onboarding, define what "integrated with Salesforce" has to mean in practice, and surface the architectural decisions Acme has not yet made so they can be prepared for the upcoming demonstration and evaluation.',
      },

      { type: 'h1', text: 'System Boundaries & Integration Topology' },
      {
        type: 'ul',
        items: [
          'Core CRM: Salesforce Sales Cloud (Opportunity & Account records).',
          'Pain: Operations team currently copies customer onboarding files and manually types metadata fields into custom Salesforce objects.',
          'Integration Target: When a customer uploads onboarding documents, the content platform must auto-extract key metadata and link the document preview directly inside the Salesforce Account record.',
        ],
      },
      { type: 'h2', text: 'Systems in the landscape' },
      {
        type: 'table',
        head: ['System', 'Role in onboarding today', 'Role in target state', 'Owner'],
        widths: [20, 30, 34, 16],
        firstColBold: true,
        rows: [
          ['Customer portal', 'Receives uploaded onboarding packages from customers', 'Unchanged; hands uploads to the content platform instead of file shares', 'Digital channels'],
          ['Windows SMB file shares', 'Landing zone and long-term storage for all onboarding files', 'Retired after migration; read-only during transition', 'Infrastructure'],
          ['Salesforce Sales Cloud', 'CRM; account status and custom onboarding objects, re-keyed by hand', 'Remains the CRM; receives metadata and shows document previews', 'Sales operations'],
          ['Content platform (target)', 'Does not exist', 'Stores documents, classifies at intake, runs approvals, exposes API and webhooks', 'Enterprise Architecture'],
          ['Corporate identity provider', 'Separate logins per system', 'Single sign-on for all users and role mapping', 'IT / CISO'],
        ],
      },
      { type: 'h2', text: 'Target flow' },
      {
        type: 'ol',
        items: [
          'Customer or intake staff uploads onboarding documents.',
          'The content platform classifies each document and extracts key metadata (account number, document type, expiry date, tax identifier where present).',
          'A webhook notifies Salesforce that a document was classified; Salesforce links the record to the correct Account.',
          'The Account page shows an embedded preview of the document and the synchronized metadata values.',
          'An approval task is created for the underwriting approver with a due date and an escalation path.',
          'On approval or rejection, the status is written back to the Salesforce Account and visible to account managers.',
        ],
      },

      { type: 'h1', text: 'Salesforce Integration Discussion' },
      {
        type: 'p',
        text: 'Acme was explicit that the integration must remove typing, not move it. A solution that required operations staff to copy values between a content platform and Salesforce, even through a convenient screen, was described as "the same problem in a nicer wrapper."',
      },
      {
        type: 'table',
        head: ['Topic', 'Position stated by Acme', 'Implication'],
        widths: [22, 44, 34],
        firstColBold: true,
        rows: [
          ['Preview in Salesforce', 'Users must open the document without leaving the Account record', 'Embedded preview via Canvas or equivalent'],
          ['Metadata direction', 'Values extracted at intake should appear in Salesforce automatically; status changes in Salesforce should reach the content platform', 'Bidirectional synchronization with conflict rules'],
          ['Trigger', 'Event-driven rather than scheduled batch', 'Webhooks for classified, approved and flagged events'],
          ['Authentication', 'No shared service account passwords', 'OAuth 2.0 with JWT bearer tokens'],
          ['Permissions', 'A user who cannot see an Account in Salesforce must not see its documents', 'Permission mapping between Salesforce and the content platform'],
        ],
      },

      { type: 'h1', text: 'Open Architectural Questions' },
      {
        type: 'ol',
        items: [
          {
            text: 'System of Record for Metadata: Architecture team is debating whether Salesforce or Box should act as the master system of record for custom document metadata (e.g., Customer Tax ID, Verification Status, Expiration Date).',
            sub: [
              'Argument for Salesforce: sales and service teams already treat it as the source of truth, and reports are built on it.',
              'Argument for the content platform: values are extracted from the document itself, so the document store is closest to the evidence.',
              'No decision reached. The integration design depends on this answer, so it was marked as a blocker for the detailed design.',
            ],
          },
          {
            text: 'Identity Provider: Evaluating if single sign-on should originate from Okta enterprise directory or Azure AD.',
            sub: [
              'Either option is acceptable to the integration team as long as SAML 2.0 or OpenID Connect is used.',
              'The decision sits with the CISO office and is awaiting final review.',
            ],
          },
        ],
      },
      {
        type: 'callout',
        label: 'Note:',
        text: 'Acme would like to see the demo handle both outcomes of the metadata question. If time is short, the demonstration should state clearly which assumption it uses rather than silently picking one.',
      },

      { type: 'h1', text: 'Migration Considerations' },
      {
        type: 'ul',
        items: [
          'Existing files on the SMB shares will need to be migrated or made searchable; the number of files and total size were not known at the time of the workshop.',
          'A phased approach by branch was preferred to a single cutover.',
          'Folder naming conventions differ by branch, so migration will need rules for deriving account association.',
          'During transition, specialists will need one search that covers both the old shares and the new platform.',
        ],
      },

      { type: 'h1', text: 'Decisions and Actions' },
      {
        type: 'table',
        head: ['#', 'Item', 'Type', 'Owner', 'Status'],
        widths: [5, 52, 13, 18, 12],
        rows: [
          ['1', 'Salesforce remains the CRM; the content platform integrates with it', 'Decision', 'David Chen', 'Agreed'],
          ['2', 'Integration is event-driven using webhooks', 'Decision', 'David Chen', 'Agreed'],
          ['3', 'Decide system of record for document metadata', 'Decision', 'Architecture team', 'Open'],
          ['4', 'Decide identity provider (Okta vs. Azure AD)', 'Decision', 'CISO office', 'Open'],
          ['5', 'Provide the Salesforce custom object and field list', 'Action', 'David Chen', 'In progress'],
          ['6', 'Estimate file count and size on the SMB shares', 'Action', 'Rachel Green', 'Not started'],
          ['7', 'Prepare demo outline that shows upload to Salesforce preview', 'Action', 'Elena Rostova', 'In progress'],
        ],
      },
    ],
  },
};
