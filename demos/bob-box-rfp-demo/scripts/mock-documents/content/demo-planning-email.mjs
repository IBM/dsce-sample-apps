export default {
  file: 'Demo_Planning_Email_Summary.docx',
  dir: 'Customers/Acme Corp/Workshop & Alignment',
  kind: 'docx',
  inApp: true,
  spec: {
    title: 'Pre-Demo Alignment Email Summary - Acme Corp',
    author: 'Sarah Jenkins',
    subject: 'Summary of pre-demo email thread, October 8-9, 2024',
    header: 'Acme Corp | Pre-Demo Alignment Email Summary | October 8-9, 2024',
    footer: 'Internal Sales Alignment',
    blocks: [
      {
        type: 'title',
        text: 'PRE-DEMO ALIGNMENT EMAIL SUMMARY - ACME CORP',
        subtitle: 'Synopsis of the email exchange confirming agenda, pacing and Q&A time',
      },
      {
        type: 'meta',
        rows: [
          ['Compiled by', 'Sarah Jenkins, Account Executive'],
          ['Thread dates', 'October 8-9, 2024'],
          ['Participants', 'David Chen (Acme IT Lead), Sarah Jenkins (AE), Marcus Vance (SE), Rachel Green (cc)'],
          ['Subject line', 'RE: Tomorrow\'s demonstration - agenda and timing'],
          ['Classification', 'Internal Sales Alignment'],
        ],
      },

      { type: 'h1', text: 'Email Thread Synopsis (Oct 8-9, 2024)' },
      {
        type: 'p',
        text: 'The message below is the main request from Acme. It is reproduced in full because it sets the priorities for the session.',
      },
      {
        type: 'table',
        head: null,
        widths: [14, 86],
        firstColBold: true,
        rows: [
          ['From', 'David Chen (Acme IT Lead)'],
          ['To', 'Sarah Jenkins (AE), Marcus Vance (SE)'],
          ['Cc', 'Rachel Green (Acme IT Director)'],
          ['Sent', 'October 8, 2024, 4:42 PM'],
        ],
      },
      {
        type: 'quote',
        paras: [
          '"Hi Sarah and team,',
          'For tomorrow\'s demonstration, our leadership team wants to ensure we cover the Salesforce integration thoroughly. We\'d like to see how an onboarding document uploaded by our intake team is indexed, searched, and seamlessly surfaced in Salesforce without manual intervention.',
          'Please keep the presentation crisp (under 20 minutes) and make sure we have at least 15 minutes left for our security architect and IT leads to ask questions on RBAC and encryption."',
        ],
      },

      { type: 'h1', text: 'Replies and Confirmations' },
      {
        type: 'table',
        head: ['Date', 'From', 'Summary'],
        widths: [14, 20, 66],
        firstColBold: true,
        rows: [
          ['Oct 8', 'Sarah Jenkins', 'Confirmed that the Salesforce flow will be the centerpiece and that the presentation will finish in under 20 minutes. Asked who from security will attend.'],
          ['Oct 8', 'David Chen', 'Confirmed that Acme\'s security architect and two IT leads will attend for the question portion. Asked for the agenda in advance.'],
          ['Oct 9', 'Marcus Vance', 'Sent a proposed agenda: classification and routing, Salesforce hand-off, role views, then open questions.'],
          ['Oct 9', 'Rachel Green', 'Approved the agenda. Asked that RBAC and encryption be covered in the question time with specifics rather than slides.'],
        ],
      },

      { type: 'h1', text: 'Confirmed Agenda' },
      {
        type: 'table',
        head: ['Segment', 'Approx. duration', 'Notes'],
        widths: [44, 22, 34],
        firstColBold: true,
        rows: [
          ['Introduction and recap of Acme\'s goals', '2 min', 'Sarah'],
          ['Upload, indexing and search of an onboarding document', '5 min', 'Show search finding the new document'],
          ['Document surfaced in Salesforce without manual entry', '5 min', 'Centerpiece per David Chen'],
          ['Role-specific views and approval routing', '5 min', 'Intake, approver, auditor'],
          ['Questions: RBAC, encryption, SSO, architecture', '15+ min', 'Protected time'],
        ],
      },

      { type: 'h1', text: 'Points to Prepare' },
      {
        type: 'ul',
        items: [
          'Show search as part of the flow: the document must be findable by content after upload, not only listed.',
          'Be ready to answer questions on RBAC and encryption in detail. Reference the requirements in Security_Requirements.pdf rather than generic statements.',
          'If asked about the identity provider, state that Acme has not yet chosen between Okta and Azure AD and that either can be supported through SAML 2.0 or OpenID Connect.',
          'If asked about retention or volume, note that Acme has not finalized these and ask what is known.',
        ],
      },

      { type: 'h1', text: 'Follow-ups After the Session' },
      {
        type: 'ul',
        items: [
          'Send the recording and a written summary to David Chen and Rachel Green.',
          'Capture every question that could not be answered and assign an owner.',
          'Share the control-by-control response to the security mandate within a week.',
        ],
      },
    ],
  },
};
