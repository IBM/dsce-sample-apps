/**
 * Builds the Acme Bank RFP docx from scratch using OfficeCLI via the Bob office tools.
 * Run indirectly — this file is read and the ops arrays are used by the office_edit tool.
 *
 * Since we can't call office_edit programmatically, this script instead uses the
 * officecli npm package directly to create the document.
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST = path.resolve(__dirname, '../IBM Enterprise Content/Incoming RFPs/Acme Bank - RFP for AI-Powered Document Intelligence Platform.docx');

// Build using officecli programmatic API if available, otherwise fall back to docx npm package
try {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle } = await import('docx');

  const BLUE = '003087';
  const GOLD = 'B8860B';
  const WHITE = 'FFFFFF';
  const LIGHT_GRAY = 'F5F5F5';

  const coverPara = (text, opts = {}) => new Paragraph({
    children: [new TextRun({ text, ...opts, color: opts.color || WHITE, font: 'Calibri' })],
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color: BLUE },
    spacing: { before: opts.before || 0, after: opts.after || 0 },
  });

  const heading1 = (text) => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: BLUE, size: 28, font: 'Calibri' })],
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
  });

  const heading2 = (text) => new Paragraph({
    children: [new TextRun({ text, bold: true, color: BLUE, size: 24, font: 'Calibri' })],
    spacing: { before: 200, after: 80 },
  });

  const body = (text) => new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
    spacing: { before: 0, after: 120 },
  });

  const bullet = (text) => new Paragraph({
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { before: 0, after: 80 },
  });

  const metaRow = (label, value) => new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri', color: '555555' })] })],
        shading: { type: ShadingType.SOLID, color: LIGHT_GRAY },
        width: { size: 3000, type: WidthType.DXA },
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: 'Calibri' })] })],
        width: { size: 6500, type: WidthType.DXA },
      }),
    ],
  });

  const secRow = (req, standard, evidence) => new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: req, bold: true, size: 18, font: 'Calibri' })] })], width: { size: 3200, type: WidthType.DXA } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: standard, size: 18, font: 'Calibri' })] })], width: { size: 2500, type: WidthType.DXA } }),
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: evidence, size: 18, font: 'Calibri' })] })], width: { size: 2800, type: WidthType.DXA } }),
    ],
  });

  const headerRow = (c1, c2, c3) => new TableRow({
    tableHeader: true,
    children: [c1, c2, c3].map(t => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18, color: WHITE, font: 'Calibri' })] })],
      shading: { type: ShadingType.SOLID, color: BLUE },
    })),
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
    },
    sections: [{
      children: [
        // ── Cover block ──
        new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })], shading: { type: ShadingType.SOLID, color: BLUE } }),
        coverPara('ACME BANK NATIONAL ASSOCIATION', { bold: true, size: 22, before: 0, after: 0 }),
        coverPara('Commercial Lending Division', { size: 20, after: 0 }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 8 })], shading: { type: ShadingType.SOLID, color: BLUE } }),
        coverPara('REQUEST FOR PROPOSAL', { bold: true, size: 52, before: 200, after: 80 }),
        coverPara('AI-Powered Document Intelligence', { bold: true, size: 36, after: 0 }),
        coverPara('and Automated Proposal Platform', { bold: true, size: 36, after: 160 }),
        new Paragraph({
          children: [new TextRun({ text: 'Solicitation Reference: RFP-2025-DOCAI-04    |    Deadline: November 15, 2025 at 5:00 PM ET', bold: true, size: 20, color: GOLD, font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          shading: { type: ShadingType.SOLID, color: BLUE },
          spacing: { before: 0, after: 80 },
        }),
        coverPara('Issuing Organization: Acme Bank National Association — Commercial Lending Division', { size: 18, color: 'DDDDDD', after: 200 }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 12 })], shading: { type: ShadingType.SOLID, color: BLUE } }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 6 })] }),

        // ── Document metadata table ──
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            metaRow('Issuing Organization', 'Acme Bank National Association — Commercial Lending Division'),
            metaRow('RFP Reference', 'RFP-2025-DOCAI-04'),
            metaRow('Contact Officer', 'Eleanor Vance, VP Strategic Sourcing & Technology Procurement'),
            metaRow('Submission Deadline', 'November 15, 2025 at 5:00 PM Eastern Time'),
            metaRow('Questions Deadline', 'October 31, 2025 (written only, to e.vance@acmebank.com)'),
            metaRow('Required Repository', 'Box Content Cloud (Enterprise Plus Tier)'),
          ],
        }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 6 })] }),

        // ── Part 1 ──
        heading1('PART 1 — OVERVIEW & BACKGROUND'),
        heading2('1.1  About Acme Bank'),
        body('Acme Bank National Association is a Tier-1 commercial bank headquartered in New York, NY, with $280 billion in assets under management and operations across 42 states. The Commercial Lending Division processes over 14,000 commercial loan packages annually across corporate banking, commercial real estate, and middle-market lending verticals.'),
        body('Acme Bank currently stores all loan documentation, compliance records, customer due diligence packages, and internal policy documents in Box Content Cloud (Enterprise Plus Tier). The bank\'s operational infrastructure is deeply integrated with Box, making native Box connectivity a mandatory — not preferred — requirement for any proposed platform.'),
        heading2('1.2  Business Problem'),
        body('The Commercial Lending Division faces three critical operational challenges this RFP is designed to address:'),
        bullet('Document Intake Bottleneck. Commercial operations staff manually classify inbound PDF and DOCX tax records, COIs, financial statements, and executed contracts. This creates a 48-hour average intake backlog per loan package and requires headcount that scales linearly with loan volume.'),
        bullet('Fragmented Search and Knowledge Retrieval. Relevant context is distributed across Box folder hierarchies with no unified semantic search layer. Analysts spend 30–40% of research time locating precedent documents, prior RFP responses, and product documentation.'),
        bullet('Salesforce Integration Gap. Loan document metadata is re-entered manually into Salesforce Sales Cloud, creating data inconsistencies, audit risk, and an estimated 12 FTE hours per week of avoidable administrative overhead.'),
        heading2('1.3  Objective'),
        body('Acme Bank is seeking an enterprise-grade AI-powered document intelligence and knowledge synthesis platform that connects natively to Box Content Cloud, automates commercial loan document classification upon intake, enables semantic search across the full content repository, and synchronizes document metadata bi-directionally with Salesforce Sales Cloud — while strictly complying with banking security, privacy, and audit requirements.'),

        // ── Part 2 ──
        heading1('PART 2 — SCOPE OF WORK'),
        heading2('2.1  Mandatory Platform Capabilities'),
        body('The selected vendor must deliver all of the following capabilities at General Availability at time of contract execution. No roadmap commitments will be accepted as substitutes for production-ready functionality.'),
        bullet('Box Content Cloud Integration via Model Context Protocol (MCP). The platform must connect directly to Acme Bank\'s Box environment via the open Model Context Protocol. Real-time, in-memory document access is required. Persistent local caching or bulk export of Box content to third-party infrastructure is expressly prohibited.'),
        bullet('Automated Document Classification. The platform must automatically classify commercial loan package documents (financial statements, tax returns, COIs, executed agreements, appraisals) upon intake to Box, without requiring manual tagging by operations staff.'),
        bullet('AI-Powered Semantic Search and Synthesis. Users must pose natural-language questions against the full Box repository and receive synthesized, evidence-backed answers with deterministic citations — including exact file, page, and excerpt references.'),
        bullet('RFP Response Automation. The platform must generate structured, citation-grounded first-draft RFP responses from Box-stored past responses, product documentation, and customer context — reducing drafting time from the current 14-day average to under 2 business days.'),
        bullet('Bi-directional Salesforce Sales Cloud Integration. The platform must synchronize document metadata, classification outputs, and workflow events bi-directionally with Salesforce via REST API and configurable webhooks — eliminating manual re-entry.'),

        // ── Part 3 ──
        heading1('PART 3 — TECHNICAL AND INTEGRATION REQUIREMENTS'),
        heading2('3.1  Box MCP Architecture'),
        body('Vendors must provide a detailed technical architecture diagram and written description of their Box Content Cloud integration, addressing: (a) the MCP connector implementation and handshake protocol, (b) how Box IAM permissions and Box Shield classification labels are inherited at runtime, (c) the ephemeral processing model confirming no persistent local document cache, and (d) latency benchmarks for query response across a repository of 10,000+ documents.'),
        heading2('3.2  Identity and Access Management'),
        body('The platform must support SAML 2.0 and OpenID Connect (OIDC) Single Sign-On. Acme Bank\'s primary identity provider is under final CISO review (Okta vs. Microsoft Azure AD). Vendors must confirm out-of-the-box support for both providers and supply reference documentation for each configuration. Granular RBAC is required for distinct permission tiers across front-office commercial bankers, underwriting specialists, and compliance officers.'),
        heading2('3.3  Salesforce Integration Specification'),
        body('Vendors must provide a programmatic REST API supporting: authenticated file metadata reads and writes, asynchronous document event webhook notifications (upload, classification completion, version change), and batch metadata synchronization to Salesforce custom objects. The API must enforce OAuth 2.0 authentication on all endpoints.'),

        // ── Part 4 ──
        heading1('PART 4 — SECURITY, PRIVACY AND COMPLIANCE'),
        body('The following security and compliance requirements are mandatory. Failure to satisfy any single requirement will result in disqualification prior to commercial evaluation. Responses must include supporting evidence — audit reports, certifications, or executed agreement templates — for each requirement.'),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 4 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow('Requirement', 'Standard / Certification', 'Required Evidence'),
            secRow('Encryption at Rest', 'AES-256 (CMEK supported)', 'Architecture whitepaper'),
            secRow('Encryption in Transit', 'TLS 1.3 (minimum TLS 1.2)', 'Security whitepaper'),
            secRow('SOC 2 Type II Audit', 'All 5 Trust Services Criteria', 'Current audit report (NDA)'),
            secRow('ISO/IEC 27001:2022', 'Annual third-party renewal', 'Active certification copy'),
            secRow('HIPAA Business Associate Agreement', 'Covers all AI ingestion pipelines', 'Executed BAA template'),
            secRow('Zero AI Model Training Retention', 'Contractual + audited', 'MSA clause + SOC 2 evidence'),
            secRow('99.95% Monthly Uptime SLA', 'Tiered financial service credits', 'SLA documentation'),
          ],
        }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 4 })] }),
        heading2('4.1  Data Residency and Zero Retention'),
        body('Zero customer data retention for AI model training is a non-negotiable requirement. No Acme Bank document content, metadata, or user query text may be retained, used, or shared for the purpose of training, fine-tuning, or improving any AI model — including the vendor\'s own foundation models. This requirement must be contractually enforced in the standard Enterprise MSA and independently audited under SOC 2 Type II (all five Trust Services Criteria).'),

        // ── Part 5 ──
        heading1('PART 5 — IMPLEMENTATION AND COMMERCIAL REQUIREMENTS'),
        heading2('5.1  Implementation Timeline'),
        body('Acme Bank requires an 8-week fast-track enterprise deployment for an initial cohort of 250 commercial lending specialists. Vendors must provide a milestone-based implementation roadmap with a fixed RACI framework. Change orders for in-scope integrations (Box MCP connector, Salesforce sync, SSO configuration) will not be accepted. Vendors must demonstrate at least two prior enterprise deployments completed within the proposed timeline.'),
        heading2('5.2  Pricing Structure'),
        body('Proposals must include fully itemized pricing for: (a) a fixed-fee professional services implementation package, (b) an annual per-seat or enterprise subscription covering 250 users, (c) premier 24x7 support and a dedicated Customer Success Manager for Year 1, and (d) optional multi-year commitment pricing with any applicable volume discounts. All pricing must be fixed and inclusive of in-scope integrations.'),
        heading2('5.3  Service Level Agreement'),
        body('The platform must commit to a minimum 99.95% monthly uptime SLA with tiered financial service credits for any breach. Vendors must also commit to 7-year audit data retention in compliance with Acme Bank\'s internal data governance policy (Acme Bank Data Retention Schedule v2.4, Section 3).'),

        // ── Part 6 ──
        heading1('PART 6 — MANDATORY QUESTIONNAIRE'),
        body('Bidders must provide complete, evidence-backed responses to all five evaluation sections below. Incomplete submissions will be disqualified without review.'),
        bullet('Section 1 — Executive Summary and Vision (20 points). Describe your platform and how it transforms unstructured Box repositories into high-value intelligence. Include a reference architecture diagram. Maximum 2 pages.'),
        bullet('Section 2 — Technical Architecture and Box Integration (25 points). Detail your Box Content Cloud integration via MCP, your AI reasoning engine, and your evidence grounding methodology. Provide latency benchmarks.'),
        bullet('Section 3 — Security, Privacy and Compliance (25 points). Provide written responses to every requirement in Part 4, with supporting evidence for each certification and contractual commitment.'),
        bullet('Section 4 — Relevant Banking Case Study (15 points). Provide a concrete, verifiable case study from a Tier-1 financial institution demonstrating measurable intake acceleration, RFP drafting improvement, or cost savings.'),
        bullet('Section 5 — Implementation Plan and Pricing (15 points). Provide a fully itemized commercial proposal, milestone-based 8-week implementation roadmap, and RACI framework as specified in Part 5.'),

        // ── Part 7 ──
        heading1('PART 7 — SUBMISSION INSTRUCTIONS'),
        body('All proposals must be submitted in PDF format via Box secure upload to the designated RFP submission folder by November 15, 2025 at 5:00 PM ET. Questions must be submitted in writing to Eleanor Vance (e.vance@acmebank.com) no later than October 31, 2025. Responses to all questions will be posted to the RFP portal by November 7, 2025.'),
        body('Acme Bank reserves the right to reject any or all proposals, to waive informalities, and to accept the proposal deemed most advantageous to the bank. This RFP does not constitute a commitment to award a contract.'),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 48 })] }),
        new Paragraph({
          children: [new TextRun({ text: 'Commercial Confidential — Acme Bank Sourcing Committee    |    RFP-2025-DOCAI-04', size: 16, color: '999999', font: 'Calibri' })],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 8 } },
        }),
      ],
    }],
  });

  const buf = await Packer.toBuffer(doc);
  import('fs').then(({ writeFileSync }) => {
    writeFileSync(DEST, buf);
    console.log('Written:', DEST);
  });

} catch (e) {
  console.error('docx package error:', e.message);
  process.exit(1);
}
