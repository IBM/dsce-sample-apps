import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';
import type { GeneratedDemoAssets, GeneratedDemoPlan, GeneratedExecBrief } from './assetGenerator';

// The PPTX is rendered from the website's slide deck (see slideDeckExport.tsx)
export { createDeckPptxBlob as createPresentationBlob } from './slideDeckExport';

/** Live content produced for the current customer (Headless Bob output or the grounded fallback). */
export interface ExportContent {
  brief: GeneratedExecBrief;
  plan: GeneratedDemoPlan;
  assets: GeneratedDemoAssets;
}

const bullet = (text: string) => new Paragraph({ text: `• ${text}` });

// Helper to create the DOCX Executive Brief
export async function createExecutiveBriefDocxBlob({ brief, plan }: ExportContent): Promise<Blob> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: `${brief.customerName.toUpperCase()} — DEMO READINESS EXECUTIVE BRIEF`,
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Account: ', bold: true }),
            new TextRun(brief.customerName),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Audience: ', bold: true }),
            new TextRun(brief.stakeholders.join(', ') || 'Customer stakeholders'),
          ]
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Grounded in: ', bold: true }),
            new TextRun(`${brief.sourceCount} Box workspace files`),
          ]
        }),
        new Paragraph({ text: 'CORE CONTEXT & GROUNDING', heading: HeadingLevel.HEADING_2 }),
        ...brief.corePainPoints.map(bullet),
        new Paragraph({ text: 'DEMONSTRATION FOCUS', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: brief.demoFocus }),
        new Paragraph({ text: 'VALIDATED TECHNICAL MANDATES', heading: HeadingLevel.HEADING_2 }),
        ...brief.validatedMandates.map(bullet),
        new Paragraph({ text: `RECOMMENDED ${plan.steps.length}-STEP PRESENTATION SEQUENCE`, heading: HeadingLevel.HEADING_2 }),
        ...plan.steps.map(step => new Paragraph({
          text: `${step.stepNumber}. ${step.title} (${step.durationMinutes} min)`
        })),
        new Paragraph({ text: 'OPEN Q&A ITEMS', heading: HeadingLevel.HEADING_2 }),
        ...brief.openQAItems.map(bullet),
        new Paragraph({
          children: [
            new TextRun({ text: '\nPrepared with IBM Bob • Grounded in Customer Box Records', italics: true })
          ]
        })
      ]
    }]
  });

  return Packer.toBlob(doc);
}

// Helper to create the DOCX Demo Script
export async function createDemoScriptDocxBlob({ assets }: ExportContent): Promise<Blob> {
  const paragraphs = assets.scriptContent.split('\n').map(line => {
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
        new Paragraph({ text: `${assets.customerName.toUpperCase()} — CUSTOMER DEMONSTRATION SCRIPT`, heading: HeadingLevel.HEADING_1 }),
        ...paragraphs
      ]
    }]
  });

  return Packer.toBlob(doc);
}

// Helper to create the DOCX Validation Matrix
export async function createValidationMatrixDocxBlob({ assets }: ExportContent): Promise<Blob> {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Requirement', heading: HeadingLevel.HEADING_3 })], width: { size: 3000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Status', heading: HeadingLevel.HEADING_3 })], width: { size: 2000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Category', heading: HeadingLevel.HEADING_3 })], width: { size: 2000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Validation Notes', heading: HeadingLevel.HEADING_3 })], width: { size: 4000, type: WidthType.DXA } }),
      ]
    }),
    ...assets.technicalValidationChecklist.map(item => new TableRow({
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
        new Paragraph({ text: `${assets.customerName.toUpperCase()} — TECHNICAL VALIDATION & DISCOVERY MATRIX`, heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });

  return Packer.toBlob(doc);
}
