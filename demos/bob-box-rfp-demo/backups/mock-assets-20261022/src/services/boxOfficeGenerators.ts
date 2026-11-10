import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import { DEMO_SCRIPT_CONTENT, TECHNICAL_VALIDATION_CHECKLIST } from '../data/syntheticDemoAssets';

// The PPTX is rendered from the website's slide deck (see slideDeckExport.tsx)
export { createDeckPptxBlob as createPresentationBlob } from './slideDeckExport';

// Helper to create the DOCX Executive Brief
export async function createExecutiveBriefDocxBlob(): Promise<Blob> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'ACME CORP — DEMO READINESS EXECUTIVE BRIEF',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Account: ', bold: true }),
            new TextRun('Acme Corp (Commercial Onboarding Modernization)\n'),
            new TextRun({ text: 'Target Demo: ', bold: true }),
            new TextRun('Tomorrow, 10:00 AM EST\n'),
            new TextRun({ text: 'Audience: ', bold: true }),
            new TextRun('David Chen (IT Lead), Rachel Green (IT Director), Marcus Vance (CISO Office)\n'),
          ]
        }),
        new Paragraph({ text: 'CORE CONTEXT & GROUNDING', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [
            new TextRun({ text: '• Primary Pain Point: ', bold: true }),
            new TextRun('48-hour classification backlog across network shares & 2–3 hrs daily manual Salesforce re-entry\n'),
            new TextRun({ text: '• Solution Focus: ', bold: true }),
            new TextRun('Box AI automated classification & W-9 extraction with live Salesforce Sales Cloud canvas handoff\n'),
            new TextRun({ text: '• Technical Mandates: ', bold: true }),
            new TextRun('SAML 2.0 / OpenID SSO, REST API, AES-256 / TLS 1.2+, Strict US Data Residency, 365-day Audit Logs\n'),
            new TextRun({ text: '• Key Q&A Confirmation: ', bold: true }),
            new TextRun('Identity Provider standard (Okta vs Azure AD) & Retention schedule (3 vs 7 yrs)\n'),
          ]
        }),
        new Paragraph({ text: 'RECOMMENDED 8-STEP PRESENTATION SEQUENCE', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [
            new TextRun('1. Frame Onboarding Friction & Legacy File Share Backlog (2 min)\n'),
            new TextRun('2. Ingest Raw Customer Tax Package (2 min)\n'),
            new TextRun('3. Automated Classification & W-9 Metadata Extraction (3 min)\n'),
            new TextRun('4. Underwriting Task Assignment & Routing (2.5 min)\n'),
            new TextRun('5. Salesforce Sales Cloud Canvas Handoff (3.5 min)\n'),
            new TextRun('6. Tiered Role-Based Access Controls & Watermarking (2 min)\n'),
            new TextRun('7. Unified Metadata Search & Ingestion Tracking (2 min)\n'),
            new TextRun('8. Architecture Workshop & Security Q&A (15 min)\n'),
          ]
        }),
        new Paragraph({ text: 'KEY Q&A PREPARATION', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({
          children: [
            new TextRun('• Identity Provider Standard: Okta vs. Azure AD (Entra ID)\n'),
            new TextRun('• Retention Policy: 3-Year vs. 7-Year automated destruction schedule\n'),
            new TextRun('• Metadata Authority: Box vs. Salesforce Master Record\n'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: '\nPrepared with IBM Bob for Box • 100% Grounded in Customer Box Records', italics: true })
          ]
        })
      ]
    }]
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}

// Helper to create the DOCX Demo Script
export async function createDemoScriptDocxBlob(): Promise<Blob> {
  const paragraphs = DEMO_SCRIPT_CONTENT.split('\n').map(line => {
    if (line.startsWith('PART ') || line.startsWith('=====')) {
      return new Paragraph({ text: line, heading: HeadingLevel.HEADING_2 });
    }
    if (line.startsWith('PRESENTER:') || line.startsWith('[')) {
      return new Paragraph({ children: [new TextRun({ text: line, bold: true, color: '0043CE' })] });
    }
    return new Paragraph({ text: line });
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: 'ACME CORP — CUSTOMER DEMONSTRATION SCRIPT', heading: HeadingLevel.HEADING_1 }),
        ...paragraphs
      ]
    }]
  });

  return await Packer.toBlob(doc);
}

// Helper to create the DOCX Validation Matrix
export async function createValidationMatrixDocxBlob(): Promise<Blob> {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Requirement', heading: HeadingLevel.HEADING_3 })], width: { size: 3000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Status', heading: HeadingLevel.HEADING_3 })], width: { size: 2000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Category', heading: HeadingLevel.HEADING_3 })], width: { size: 2000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Validation Notes', heading: HeadingLevel.HEADING_3 })], width: { size: 4000, type: WidthType.DXA } }),
      ]
    }),
    ...TECHNICAL_VALIDATION_CHECKLIST.map(item => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: item.requirement })] }),
        new TableCell({ children: [new Paragraph({ text: item.status === 'documented' ? 'Pre-Validated' : 'Confirm in Q&A' })] }),
        new TableCell({ children: [new Paragraph({ text: item.category })] }),
        new TableCell({ children: [new Paragraph({ text: item.notes })] }),
      ]
    }))
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: 'ACME CORP — TECHNICAL VALIDATION & DISCOVERY MATRIX', heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });

  return await Packer.toBlob(doc);
}
