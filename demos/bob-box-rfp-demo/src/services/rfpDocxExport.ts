import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx'
import type { RfpOutput, RfpTable } from '@/lib/rfp-schema'

const FONT = 'Arial'
const BLUE = '0F62FE'
const INK = '161616'
const MUTED = '525252'
const RULE = 'C6C6C6'

// US Letter with 0.75" margins -> 10080 twips of usable width
const CONTENT_WIDTH = 10080

const STATUS_STYLE = {
  meets: { label: 'Meets', fill: 'DEFBE6', color: '0E6027' },
  partial: { label: 'Partial', fill: 'FCF4D6', color: '684E00' },
  clarify: { label: 'Clarify', fill: 'E8E8E8', color: MUTED },
} as const

// The model occasionally returns a status outside the schema enum (e.g. "open"); treat it as "clarify".
const statusStyle = (status: string) => STATUS_STYLE[status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.clarify

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: RULE }
const CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER }

const paragraphsOf = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

/** Renders "OPEN ITEM:" markers in bold so unresolved items stand out. */
function runsWithOpenItems(text: string, size: number, color = INK): ParagraphChild[] {
  return text
    .split(/(OPEN ITEM:)/)
    .filter(Boolean)
    .map((part) => new TextRun({ text: part, size, color, bold: part === 'OPEN ITEM:' }))
}

function bodyParagraph(text: string) {
  return new Paragraph({
    spacing: { after: 140, line: 300 },
    children: runsWithOpenItems(text, 21),
  })
}

function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80, line: 280 },
    children: runsWithOpenItems(text, 21),
  })
}

function metadataTable(rows: Array<[string, string]>) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2200, CONTENT_WIDTH - 2200],
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              borders: NO_BORDERS,
              width: { size: 2200, type: WidthType.DXA },
              margins: { top: 40, bottom: 40, left: 0, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: label.toUpperCase(), size: 16, bold: true, color: MUTED })] })],
            }),
            new TableCell({
              borders: NO_BORDERS,
              width: { size: CONTENT_WIDTH - 2200, type: WidthType.DXA },
              margins: { top: 40, bottom: 40, left: 0, right: 0 },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 21, color: INK })] })],
            }),
          ],
        }),
    ),
  })
}

const STATUS_WORDS: Record<string, { fill: string; color: string }> = {
  compliant: { fill: 'DEFBE6', color: '0E6027' },
  partial: { fill: 'FCF4D6', color: '684E00' },
  'not compliant': { fill: 'FFD7D9', color: '8E0B1B' },
}

/** Table with a dark header row; first column bold; status words (Compliant/Partial) get a coloured cell. */
function genericTable(t: RfpTable) {
  const n = Math.max(t.columns.length, 1)
  const widths = Array.from({ length: n }, (_, i) =>
    i === n - 1 ? CONTENT_WIDTH - Math.floor(CONTENT_WIDTH / n) * (n - 1) : Math.floor(CONTENT_WIDTH / n),
  )
  const run = (value: string, opts: { bold?: boolean; color?: string } = {}) =>
    new Paragraph({ children: [new TextRun({ text: value, size: 18, bold: opts.bold, color: opts.color ?? INK })] })
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: t.columns.map(
          (h, i) =>
            new TableCell({
              borders: CELL_BORDERS,
              width: { size: widths[i], type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: '161616', color: 'auto' },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: h, size: 16, bold: true, color: 'FFFFFF' })] })],
            }),
        ),
      }),
      ...t.rows.map(
        (row) =>
          new TableRow({
            cantSplit: true,
            children: t.columns.map((_, i) => {
              const value = row[i] ?? ''
              const status = STATUS_WORDS[value.trim().toLowerCase()]
              return new TableCell({
                borders: CELL_BORDERS,
                width: { size: widths[i], type: WidthType.DXA },
                shading: status ? { type: ShadingType.CLEAR, fill: status.fill, color: 'auto' } : undefined,
                margins: { top: 70, bottom: 70, left: 100, right: 100 },
                children: [run(value, { bold: i === 0 || Boolean(status), color: status?.color })],
              })
            }),
          }),
      ),
    ],
  })
}

const spacer = () => new Paragraph({ spacing: { after: 160 }, children: [] })

function matrixTable(doc: RfpOutput) {
  const widths = [480, 2150, 1050, 4150, 900, 1350]
  const headerCell = (text: string, width: number) =>
    new TableCell({
      borders: CELL_BORDERS,
      width: { size: width, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: '161616', color: 'auto' },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text, size: 16, bold: true, color: 'FFFFFF' })] })],
    })
  const cell = (children: Paragraph[], width: number, fill?: string) =>
    new TableCell({
      borders: CELL_BORDERS,
      width: { size: width, type: WidthType.DXA },
      shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
      margins: { top: 70, bottom: 70, left: 100, right: 100 },
      children,
    })
  const text = (value: string, opts: { bold?: boolean; color?: string } = {}) =>
    new Paragraph({ children: [new TextRun({ text: value, size: 17, bold: opts.bold, color: opts.color ?? INK })] })

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['#', 'Requirement', 'RFP Ref', 'Response', 'Status', 'Source'].map((h, i) => headerCell(h, widths[i])),
      }),
      ...doc.complianceMatrix.map((r, i) => {
        const s = statusStyle(r.status)
        return new TableRow({
          cantSplit: true,
          children: [
            cell([text(String(i + 1), { color: MUTED })], widths[0]),
            cell([text(r.requirement, { bold: true })], widths[1]),
            cell([text(r.rfpRef ?? '—', { color: MUTED })], widths[2]),
            cell([new Paragraph({ children: runsWithOpenItems(r.response, 17) })], widths[3]),
            cell([text(s.label, { bold: true, color: s.color })], widths[4], s.fill),
            cell([text(r.sourceRef ?? '—', { color: MUTED })], widths[5]),
          ],
        })
      }),
    ],
  })
}

/** Builds a formatted Word document of the RFP response, suitable for preview in Box. */
export async function createRfpDocxBlob(doc: RfpOutput, vendorName: string): Promise<Blob> {
  const meets = doc.complianceMatrix.filter((r) => r.status === 'meets').length
  const partial = doc.complianceMatrix.filter((r) => r.status === 'partial').length
  const clarify = doc.complianceMatrix.length - meets - partial

  const vendor = doc.submittedBy ?? vendorName
  const metadata: Array<[string, string]> = [
    ['Prepared for', [doc.clientName, doc.submittedTo].filter(Boolean).join(', ')],
  ]
  if (doc.rfpReference) metadata.push(['In response to', doc.rfpReference])
  if (doc.proposalNumber) metadata.push(['Proposal number', doc.proposalNumber])
  if (doc.date) metadata.push(['Date', doc.date])
  if (doc.contact) {
    metadata.push([
      'IBM contact',
      [`${doc.contact.name}, ${doc.contact.title}`, [doc.contact.email, doc.contact.phone].filter(Boolean).join('  |  ')]
        .filter(Boolean)
        .join(' - '),
    ])
  }
  if (doc.complianceMatrix.length > 0) {
    metadata.push(['Compliance', `${meets} Meets · ${partial} Partial · ${clarify} Clarify`])
  }

  const plain = (text: string, opts: { bold?: boolean; after?: number } = {}) =>
    new Paragraph({ spacing: { after: opts.after ?? 0 }, children: [new TextRun({ text, size: 21, bold: opts.bold })] })

  const coverLetterChildren = doc.coverLetter
    ? [
        new Paragraph({ pageBreakBefore: true, spacing: { after: 240 }, children: [new TextRun({ text: doc.date ?? '', size: 21 })] }),
        ...doc.coverLetter.addressee.map((l) => plain(l)),
        new Paragraph({
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: `Re: ${doc.coverLetter.subject}`, size: 21, bold: true })],
        }),
        plain(doc.coverLetter.salutation, { after: 160 }),
        ...doc.coverLetter.paragraphs.map(bodyParagraph),
        ...(doc.contact
          ? [
              plain('Sincerely,', { after: 360 }),
              plain(doc.contact.name, { bold: true }),
              plain(doc.contact.title),
              plain(vendor),
            ]
          : []),
      ]
    : []

  const sectionChildren = doc.sections.flatMap((s, i) => [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      children: [new TextRun({ text: `${i + 2}. ${s.heading}` })],
    }),
    ...paragraphsOf(s.body).map(bodyParagraph),
    ...(s.subsections ?? []).flatMap((sub) => [
      new Paragraph({
        keepNext: true,
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: [sub.number, sub.title].filter(Boolean).join('  '), size: 23, bold: true })],
      }),
      ...(sub.requirement
        ? [
            new Paragraph({
              keepNext: true,
              spacing: { after: 80 },
              children: [new TextRun({ text: `Acme requirement: ${sub.requirement}`, size: 19, italics: true, color: MUTED })],
            }),
          ]
        : []),
      ...paragraphsOf(sub.body).map(bodyParagraph),
    ]),
    ...(s.tables ?? []).flatMap((t) => [
      ...(t.caption
        ? [new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t.caption, size: 22, bold: true })] })]
        : []),
      genericTable(t),
      spacer(),
    ]),
    ...(s.notes ?? []).map(bulletParagraph),
    ...(s.bullets ?? []).map(bulletParagraph),
    ...(s.keyMetric
      ? [
          new Paragraph({
            spacing: { before: 160, after: 200 },
            shading: { type: ShadingType.CLEAR, fill: 'EDF5FF', color: 'auto' },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: BLUE, space: 10 } },
            indent: { left: 200 },
            children: [
              new TextRun({ text: s.keyMetric.value, size: 32, bold: true, color: BLUE }),
              new TextRun({ text: `   ${s.keyMetric.label}`, size: 20, bold: true, color: INK }),
              ...(s.keyMetric.source ? [new TextRun({ text: `  (${s.keyMetric.source})`, size: 17, color: MUTED })] : []),
            ],
          }),
        ]
      : []),
  ])

  const exhibitChildren =
    doc.exhibits && doc.exhibits.length > 0
      ? [
          new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: 'Exhibits' })] }),
          ...doc.exhibits.map((e) => plain(e, { after: 60 })),
        ]
      : []

  const document = new Document({
    creator: 'IBM Bob',
    title: doc.title,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 30, bold: true, color: INK },
          paragraph: {
            spacing: { before: 360, after: 120 },
            outlineLevel: 0,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 4 } },
          },
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: [`IBM Response to ${doc.clientName}`, doc.rfpReference, doc.date].filter(Boolean).join(' · '), size: 16, color: MUTED })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${vendor} Confidential – Prepared for ${doc.clientName}  |  Page `, size: 16, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED }),
                  new TextRun({ text: ' of ', size: 16, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { before: 200, after: 80 },
            children: [
              new TextRun({
                text: `PROPOSAL RESPONSE${doc.rfpReference ? ` · ${doc.rfpReference}` : ''}`,
                size: 18,
                bold: true,
                color: BLUE,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240, line: 276 },
            children: [new TextRun({ text: doc.title, size: 44, bold: true, color: INK })],
          }),
          metadataTable(metadata),
          ...(doc.confidentialityNotice
            ? [new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: doc.confidentialityNotice, size: 17, color: MUTED })] })]
            : []),
          ...coverLetterChildren,
          new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, keepNext: true, children: [new TextRun({ text: '1. Executive Summary' })] }),
          ...paragraphsOf(doc.executiveSummary).map(bodyParagraph),
          ...sectionChildren,
          ...(doc.complianceMatrix.length > 0
            ? [
                new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: 'Compliance Matrix' })] }),
                matrixTable(doc),
              ]
            : []),
          ...exhibitChildren,
        ],
      },
    ],
  })

  return Packer.toBlob(document)
}
