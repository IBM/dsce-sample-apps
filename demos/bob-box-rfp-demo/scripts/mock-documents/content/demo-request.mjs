export default {
  file: 'Demo_Request.docx',
  dir: 'Customers/Acme Corp/RFPs & Proposals',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'SE Demo Briefing - Acme Corp Demonstration',
    author: 'Sarah Jenkins',
    subject: 'Sales engineering briefing for the Acme Corp demonstration',
    header: 'Acme Corp | SE Demo Briefing',
    footer: 'Internal / AE-SE - Do not forward to customer',
    blocks: [
      {
        type: 'title',
        text: 'SE DEMO BRIEFING - ACME CORP DEMONSTRATION',
        subtitle: 'Briefing from the account executive to the sales engineering team',
      },
      {
        type: 'meta',
        rows: [
          ['Date of Demo', 'Tomorrow, 10:00 AM EST'],
          ['Audience', 'David Chen (IT Lead), Rachel Green (IT Director), Ops Team Leads'],
          ['Also expected', 'Marcus Vance and members of the security architecture team for the Q&A portion'],
          ['Format', 'Video conference with screen sharing'],
          ['Owner', 'Sarah Jenkins (AE)'],
          ['Prepared for', 'Solutions engineering'],
        ],
      },

      { type: 'h1', text: 'Background' },
      {
        type: 'p',
        text: 'Acme issued RFP-2024-CONTENT-09 for a cloud content platform to replace the file shares used for commercial onboarding. We have held a discovery session, an architecture workshop and a follow-up alignment call. Tomorrow\'s session is the first time Acme\'s operations leads will see the solution. The request below comes directly from Acme.',
      },
      {
        type: 'p',
        text: 'Acme\'s problems are practical: a 48-hour classification backlog, searches that take more than 15 minutes, re-typing of metadata into Salesforce, and approvals that run through email. The demonstration should show those problems going away, in that order of emphasis, not tour the product.',
      },

      { type: 'h1', text: 'Recent Customer Requests for Tomorrow\'s Session' },
      {
        type: 'ol',
        items: [
          {
            text: '**Show the Salesforce Handoff:** The team wants to see a live demonstration of how an uploaded customer document automatically populates Salesforce and provides seamless access.',
            sub: ['Start from an upload by an intake user and end on the Salesforce Account record showing the preview and metadata.', 'Do not copy or re-type anything on screen; that is exactly what Acme wants to eliminate.'],
          },
          {
            text: '**Demonstrate Role-Specific Permissions:** Explicitly show how the interface changes when logged in as an Intake Clerk vs. Underwriting Approver vs. Auditor.',
            sub: ['Use the same document in all three views so the difference is obvious.', 'Show that the Auditor can review but not export.'],
          },
          {
            text: '**Live Classification & Approval Routing:** Walk through an actual document being classified and automatically routed to the next reviewer.',
            sub: ['Use a realistic onboarding file such as a W-9 or certificate of insurance.', 'Show what happens to a document that cannot be classified with confidence.'],
          },
          {
            text: '**Leave Adequate Time for Technical Q&A:** Reserve at least 15 minutes at the end for architecture, security, and SSO questions.',
            sub: ['Acme was firm on this; treat it as a hard boundary.'],
          },
        ],
      },

      { type: 'h1', text: 'Proposed Run of Show' },
      {
        type: 'table',
        head: ['Segment', 'Minutes', 'Content', 'Lead'],
        widths: [24, 10, 50, 16],
        firstColBold: true,
        rows: [
          ['Opening', '2', 'Restate the three problems Acme described and what will be shown', 'Sarah'],
          ['Classification and routing', '5', 'Upload, automatic classification, routing to approver', 'SE'],
          ['Salesforce handoff', '5', 'Account record with embedded preview and synchronized metadata', 'SE'],
          ['Roles and permissions', '4', 'Intake Clerk, Underwriting Approver and Auditor on the same document', 'SE'],
          ['Wrap-up', '2', 'Summary against Acme\'s stated goals', 'Sarah'],
          ['Technical Q&A', '15+', 'Architecture, security, SSO, retention', 'SE and Sarah'],
        ],
      },
      {
        type: 'callout',
        label: 'Timing:',
        text: 'Acme asked for a presentation under 20 minutes with at least 15 minutes left for questions. The segments above total 18 minutes before Q&A; trim classification or roles if the session starts late.',
      },

      { type: 'h1', text: 'Open Questions to Confirm in the Session' },
      {
        type: 'ul',
        items: [
          'Which identity provider will be used (Okta or Azure AD)? No decision is documented.',
          'Which system will be the master record for document metadata, Salesforce or the content platform?',
          'What retention period will apply to onboarding files after account closure? Legal is reviewing 3 years against 7 years.',
          'How many external collaborators (for example outside legal counsel) need access? Acme is auditing this.',
          'What is the expected monthly document volume? Acme has not measured it.',
        ],
      },

      { type: 'h1', text: 'Preparation Checklist' },
      {
        type: 'table',
        head: ['Item', 'Owner', 'Status'],
        widths: [64, 18, 18],
        rows: [
          ['Demo environment loaded with Acme-style sample documents (no real customer data)', 'SE', 'Ready'],
          ['Salesforce sandbox connected and Account record prepared', 'SE', 'Ready'],
          ['Three user personas created and tested', 'SE', 'Ready'],
          ['Backup recording of the full flow available', 'SE', 'In progress'],
          ['Run of show confirmed with Acme by email', 'Sarah', 'Done'],
        ],
      },

      { type: 'h1', text: 'What Not to Do' },
      {
        type: 'ul',
        items: [
          'Do not demonstrate capabilities Acme has not asked for. There is no evidence in the customer documents for them.',
          'Do not quote performance or accuracy figures that have not been tested on Acme-like documents.',
          'Do not describe Acme\'s likelihood to buy or give an opinion on the competitive position in the customer-facing session.',
        ],
      },
    ],
  },
};
