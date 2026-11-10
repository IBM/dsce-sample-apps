// Renderers for the Acme Corp mock documents.
//
// One content model (see ./content/*.mjs) is rendered four ways so the files in Box, the plain-text
// exports and the in-app preview text can never drift apart:
//   renderDocx / renderPdf / renderXlsx  -> real Office / PDF files (uploaded to Box)
//   renderText                           -> plain-text export (synthetic_demo_content + in-app preview)
//
// Block types (docx / pdf):
//   { type: 'title', text, subtitle? }          { type: 'meta', rows: [[label, value], ...] }
//   { type: 'h1' | 'h2' | 'h3', text }          { type: 'p', text }
//   { type: 'ul' | 'ol', items: [string | { text, sub: [string] }] }
//   { type: 'table', head, rows, widths, firstColBold? }
//   { type: 'quote', paras: [string] }          { type: 'callout', label, text }
//   { type: 'pagebreak' }
// Inline **bold** is supported in paragraph, list, callout and quote text.
//
// Spreadsheet spec: { sheets: [{ name, title?, subtitle?, head, rows, widths, boldFirstCol?, textMode?: 'matrix' }] }
// where a row is an array of cells, or { section: 'Heading' } for a full-width divider row.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, Header, Footer, PageNumber, AlignmentType, LevelFormat, PageBreak,
  TableLayoutType,
} from 'docx';
import PDFDocument from 'pdfkit';
import writeExcelFile from 'write-excel-file/node';

const NAVY = '1F3A5F';
const GRAY = '57606A';
const LINE = 'C9CED6';
const SHADE = 'EEF1F5';
const INK = '1F2328';

export function parseInline(s) {
  return String(s)
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((p) => p.text.length);
}
export const stripInline = (s) => String(s).replace(/\*\*/g, '');
const asItem = (it) => (typeof it === 'string' ? { text: it, sub: [] } : { text: it.text, sub: it.sub ?? [] });

// ───────────────────────────── DOCX ─────────────────────────────
const CONTENT_W = 9360; // Letter, 1" margins, in DXA

function docxRuns(text, base = {}) {
  return parseInline(text).map(
    (s) => new TextRun({ text: s.text, bold: s.bold || base.bold, italics: base.italics, size: base.size, color: base.color }),
  );
}

function docxTable({ head, rows, widths, firstColBold }) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const cw = widths.map((w) => Math.round((w / sum) * CONTENT_W));
  const edge = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: edge, bottom: edge, left: edge, right: edge };

  const cell = (value, i, isHead) =>
    new TableCell({
      width: { size: cw[i], type: WidthType.DXA },
      borders,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      shading: isHead
        ? { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' }
        : firstColBold && i === 0
          ? { type: ShadingType.CLEAR, fill: SHADE, color: 'auto' }
          : undefined,
      children: String(value).split('\n').map(
        (line) =>
          new Paragraph({
            spacing: { after: 40 },
            children: parseInline(line).map(
              (s) =>
                new TextRun({
                  text: s.text,
                  size: 19,
                  bold: s.bold || isHead || (firstColBold && i === 0),
                  color: isHead ? 'FFFFFF' : undefined,
                }),
            ),
          }),
      ),
    });

  const trs = [];
  if (head) trs.push(new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, i, true)) }));
  rows.forEach((r) => trs.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: cw,
    layout: TableLayoutType.FIXED,
    rows: trs,
  });
}

const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] });

export async function renderDocx(spec) {
  let olInstance = 0;
  const out = [];

  for (const b of spec.blocks) {
    switch (b.type) {
      case 'title':
        out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: b.text })] }));
        if (b.subtitle) {
          out.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: b.subtitle, color: GRAY, size: 22 })] }));
        }
        break;
      case 'meta':
        out.push(docxTable({ head: null, rows: b.rows, widths: [26, 74], firstColBold: true }), spacer(160));
        break;
      case 'h1':
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: b.text })] }));
        break;
      case 'h2':
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: b.text })] }));
        break;
      case 'h3':
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun({ text: b.text })] }));
        break;
      case 'p':
        out.push(new Paragraph({ spacing: { after: 120, line: 276 }, children: docxRuns(b.text) }));
        break;
      case 'ul':
      case 'ol': {
        const inst = b.type === 'ol' ? ++olInstance : 0;
        for (const raw of b.items) {
          const it = asItem(raw);
          out.push(
            new Paragraph({
              spacing: { after: 60, line: 276 },
              ...(b.type === 'ul'
                ? { bullet: { level: 0 } }
                : { numbering: { reference: 'ol', level: 0, instance: inst } }),
              children: docxRuns(it.text),
            }),
          );
          for (const sub of it.sub) {
            out.push(new Paragraph({ spacing: { after: 40, line: 276 }, bullet: { level: 1 }, children: docxRuns(sub) }));
          }
        }
        out.push(spacer(80));
        break;
      }
      case 'table':
        out.push(docxTable(b), spacer(160));
        break;
      case 'quote': {
        const bar = { style: BorderStyle.SINGLE, size: 18, color: LINE, space: 10 };
        b.paras.forEach((t, i) =>
          out.push(
            new Paragraph({
              border: { left: bar },
              indent: { left: 360 },
              spacing: { after: i === b.paras.length - 1 ? 200 : 100, line: 276 },
              children: docxRuns(t, { color: '3D444D' }),
            }),
          ),
        );
        break;
      }
      case 'callout': {
        const edge = { style: BorderStyle.SINGLE, size: 4, color: LINE };
        out.push(
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            columnWidths: [CONTENT_W],
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: CONTENT_W, type: WidthType.DXA },
                    shading: { type: ShadingType.CLEAR, fill: SHADE, color: 'auto' },
                    margins: { top: 100, bottom: 100, left: 160, right: 160 },
                    borders: {
                      top: edge, bottom: edge, right: edge,
                      left: { style: BorderStyle.SINGLE, size: 24, color: '3B82D4' },
                    },
                    children: [
                      new Paragraph({
                        spacing: { after: 0, line: 264 },
                        children: [new TextRun({ text: `${b.label}  `, bold: true, size: 20 }), ...docxRuns(b.text, { size: 20 })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          spacer(160),
        );
        break;
      }
      case 'pagebreak':
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      default:
        throw new Error(`Unknown block type: ${b.type}`);
    }
  }

  const doc = new Document({
    creator: spec.author,
    title: spec.title,
    description: spec.subject,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22, color: INK } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 0, after: 80 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, color: NAVY }, paragraph: { spacing: { before: 320, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, color: INK }, paragraph: { spacing: { before: 180, after: 80 } } },
      ],
    },
    numbering: {
      config: [
        { reference: 'ol', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: spec.header, size: 16, color: GRAY })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${spec.footer}   |   Page `, size: 16, color: GRAY }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY }),
                  new TextRun({ text: ' of ', size: 16, color: GRAY }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRAY }),
                ],
              }),
            ],
          }),
        },
        children: out,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// ───────────────────────────── PDF ─────────────────────────────
export function renderPdf(spec) {
  return new Promise((resolve, reject) => {
    const M = 64;
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 72, bottom: 72, left: M, right: M },
      bufferPages: true,
      info: { Title: spec.title, Author: spec.author, Subject: spec.subject ?? '' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 2 * M;
    const bottom = () => doc.page.height - doc.page.margins.bottom;
    const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };

    // Writes text with inline **bold**; first segment is positioned at (x, y).
    const rich = (text, x, y, size, color, opts = {}) => {
      const segs = parseInline(text);
      if (!segs.length) return;
      doc.fontSize(size).fillColor(color);
      segs.forEach((s, i) => {
        doc.font(s.bold ? 'Helvetica-Bold' : 'Helvetica');
        const o = { ...opts, continued: i < segs.length - 1 };
        if (i === 0) doc.text(s.text, x, y, o);
        else doc.text(s.text, o);
      });
    };
    const richHeight = (text, width, size, lineGap = 2) => {
      doc.font('Helvetica').fontSize(size);
      return doc.heightOfString(stripInline(text), { width, lineGap });
    };

    const table = ({ head, rows, widths, firstColBold }) => {
      const sum = widths.reduce((a, b) => a + b, 0);
      const cw = widths.map((w) => (w / sum) * W);
      const pad = 5;
      const fs = 8.5;
      const rowHeight = (cells, isHead) =>
        Math.max(
          ...cells.map((c, i) => {
            doc.font(isHead || (firstColBold && i === 0) ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
            return doc.heightOfString(stripInline(c), { width: cw[i] - 2 * pad, lineGap: 1 }) + 2 * pad;
          }),
        );
      const paint = (cells, isHead) => {
        const h = rowHeight(cells, isHead);
        if (doc.y + h > bottom()) {
          doc.addPage();
          if (head && !isHead) paint(head, true);
        }
        const y = doc.y;
        let x = M;
        cells.forEach((c, i) => {
          const bold = isHead || (firstColBold && i === 0);
          doc.save();
          doc.rect(x, y, cw[i], h).fillAndStroke(isHead ? `#${NAVY}` : bold ? `#${SHADE}` : '#FFFFFF', `#${LINE}`);
          doc.restore();
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs).fillColor(isHead ? '#FFFFFF' : `#${INK}`);
          doc.text(stripInline(c), x + pad, y + pad, { width: cw[i] - 2 * pad, lineGap: 1 });
          x += cw[i];
        });
        doc.x = M;
        doc.y = y + h;
      };
      if (head) paint(head, true);
      rows.forEach((r) => paint(r, false));
      doc.x = M;
      doc.y += 10;
    };

    for (const b of spec.blocks) {
      switch (b.type) {
        case 'title':
          doc.font('Helvetica-Bold').fontSize(19).fillColor(`#${NAVY}`).text(b.text, M, doc.y, { width: W });
          if (b.subtitle) doc.font('Helvetica').fontSize(10.5).fillColor(`#${GRAY}`).text(b.subtitle, { width: W });
          doc.moveDown(0.4);
          doc.moveTo(M, doc.y).lineTo(M + W, doc.y).lineWidth(1.5).strokeColor(`#${NAVY}`).stroke();
          doc.moveDown(0.8);
          break;
        case 'meta':
          table({ head: null, rows: b.rows, widths: [26, 74], firstColBold: true });
          break;
        case 'h1':
          ensure(70);
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fontSize(13).fillColor(`#${NAVY}`).text(b.text, M, doc.y, { width: W });
          doc.moveTo(M, doc.y + 2).lineTo(M + W, doc.y + 2).lineWidth(0.5).strokeColor(`#${LINE}`).stroke();
          doc.moveDown(0.6);
          break;
        case 'h2':
          ensure(55);
          doc.moveDown(0.3);
          doc.font('Helvetica-Bold').fontSize(11).fillColor(`#${NAVY}`).text(b.text, M, doc.y, { width: W });
          doc.moveDown(0.3);
          break;
        case 'h3':
          ensure(45);
          doc.moveDown(0.2);
          doc.font('Helvetica-Bold').fontSize(10).fillColor(`#${INK}`).text(b.text, M, doc.y, { width: W });
          doc.moveDown(0.2);
          break;
        case 'p':
          ensure(richHeight(b.text, W, 10) + 4);
          rich(b.text, M, doc.y, 10, `#${INK}`, { width: W, lineGap: 2 });
          doc.moveDown(0.6);
          break;
        case 'ul':
        case 'ol': {
          b.items.forEach((raw, idx) => {
            const it = asItem(raw);
            const label = b.type === 'ol' ? `${idx + 1}.` : '\u2022';
            ensure(richHeight(it.text, W - 22, 10) + 3);
            const y = doc.y;
            doc.font('Helvetica').fontSize(10).fillColor(`#${INK}`).text(label, M + 4, y, { width: 18, lineBreak: false });
            rich(it.text, M + 22, y, 10, `#${INK}`, { width: W - 22, lineGap: 2 });
            doc.moveDown(0.25);
            it.sub.forEach((s) => {
              ensure(richHeight(s, W - 40, 9.5) + 3);
              const sy = doc.y;
              doc.font('Helvetica').fontSize(9.5).fillColor(`#${INK}`).text('\u2013', M + 24, sy, { width: 12, lineBreak: false });
              rich(s, M + 40, sy, 9.5, `#${INK}`, { width: W - 40, lineGap: 2 });
              doc.moveDown(0.15);
            });
          });
          doc.moveDown(0.4);
          break;
        }
        case 'table':
          table(b);
          break;
        case 'quote': {
          const h = b.paras.reduce((a, t) => a + richHeight(t, W - 24, 9.5) + 6, 0);
          ensure(Math.min(h, 160));
          const y0 = doc.y;
          b.paras.forEach((t) => {
            const needed = richHeight(t, W - 24, 9.5) + 6;
            if (doc.y + needed > bottom()) doc.addPage();
            rich(t, M + 16, doc.y, 9.5, '#3D444D', { width: W - 24, lineGap: 2 });
            doc.moveDown(0.5);
          });
          if (doc.y > y0) doc.rect(M + 4, y0, 2.5, doc.y - y0 - 6).fill(`#${LINE}`);
          doc.moveDown(0.5);
          break;
        }
        case 'callout': {
          const text = `${b.label}  ${b.text}`;
          const h = richHeight(text, W - 28, 9.5) + 16;
          ensure(h + 6);
          const y = doc.y;
          doc.rect(M, y, W, h).fillAndStroke(`#${SHADE}`, `#${LINE}`);
          doc.rect(M, y, 3.5, h).fill('#3B82D4');
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor(`#${INK}`).text(`${b.label}  `, M + 14, y + 8, { width: W - 28, continued: true, lineGap: 2 });
          rich(b.text, undefined, undefined, 9.5, `#${INK}`, { width: W - 28, lineGap: 2 });
          doc.x = M;
          doc.y = y + h + 10;
          break;
        }
        case 'pagebreak':
          doc.addPage();
          break;
        default:
          throw new Error(`Unknown block type: ${b.type}`);
      }
    }

    // Running header (pages 2+) and footer with page numbers.
    const { count } = doc.bufferedPageRange();
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      const saved = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      if (i > 0) {
        doc.font('Helvetica').fontSize(8).fillColor(`#${GRAY}`)
          .text(spec.header, M, 36, { width: W, align: 'right', lineBreak: false });
      }
      doc.font('Helvetica').fontSize(8).fillColor(`#${GRAY}`)
        .text(`${spec.footer}   |   Page ${i + 1} of ${count}`, M, doc.page.height - 42, { width: W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = saved;
    }
    doc.end();
  });
}

// ───────────────────────────── XLSX ─────────────────────────────
export async function renderXlsx(spec) {
  const sheets = spec.sheets.map((s) => {
    const n = s.head.length;
    const nulls = (k) => Array(Math.max(0, k)).fill(null);
    const data = [];
    const estLines = (cells) =>
      Math.max(1, ...cells.map((c, i) => String(c ?? '').split('\n').reduce((a, line) => a + Math.max(1, Math.ceil(line.length / (s.widths[i] * 1.05))), 0)));

    if (s.title) data.push([{ value: s.title, fontWeight: 'bold', fontSize: 14, textColor: `#${NAVY}`, columnSpan: n }, ...nulls(n - 1)]);
    if (s.subtitle) {
      const totalW = s.widths.reduce((a, b) => a + b, 0);
      const h = 15 * Math.max(1, Math.ceil(s.subtitle.length / (totalW * 1.05))) + 4;
      data.push([{ value: s.subtitle, textColor: `#${GRAY}`, wrap: true, alignVertical: 'top', columnSpan: n, height: h }, ...nulls(n - 1)]);
    }
    if (s.title || s.subtitle) data.push(nulls(n));

    const headerIdx = data.length;
    data.push(
      s.head.map((h) => ({
        value: h, fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: `#${NAVY}`,
        wrap: true, alignVertical: 'center', borderColor: `#${LINE}`,
      })),
    );

    s.rows.forEach((r) => {
      if (!Array.isArray(r)) {
        data.push([
          { value: r.section, fontWeight: 'bold', backgroundColor: `#${SHADE}`, textColor: `#${NAVY}`, columnSpan: n, borderColor: `#${LINE}` },
          ...nulls(n - 1),
        ]);
        return;
      }
      const h = 15 * estLines(r) + 4;
      data.push(
        r.map((v, i) => ({
          value: v === '' ? null : v,
          wrap: true,
          alignVertical: 'top',
          borderColor: `#${LINE}`,
          fontWeight: s.boldFirstCol && i === 0 ? 'bold' : undefined,
          height: h,
        })),
      );
    });

    return {
      data,
      sheet: s.name,
      columns: s.widths.map((width) => ({ width })),
      stickyRowsCount: headerIdx + 1,
      orientation: 'landscape',
    };
  });
  return writeExcelFile(sheets).toBuffer();
}

// ───────────────────────────── Plain text ─────────────────────────────
export function renderText(spec) {
  const L = [];
  const cell = (c) => stripInline(c ?? '').replace(/\s*\n\s*/g, ' ');

  if (spec.sheets) {
    // One line per field (not per row) so each statement stays a short, self-contained sentence.
    spec.sheets.forEach((s, idx) => {
      if (idx) L.push('');
      L.push(`${s.name.toUpperCase()}`);
      if (s.title) L.push(s.title);
      if (s.subtitle) L.push(s.subtitle);
      s.rows.forEach((r) => {
        if (!Array.isArray(r)) {
          L.push('', `${r.section.toUpperCase()}:`);
          return;
        }
        if (s.textMode === 'matrix') {
          L.push(`- ${cell(r[0])}: ${r.slice(1).map((v, i) => `${s.head[i + 1]} = ${cell(v)}`).join('; ')}`);
          return;
        }
        L.push('', `[${cell(r[0])}] ${cell(r[1])}:`);
        for (let i = 2; i < r.length; i++) {
          const v = String(r[i] ?? '');
          if (!v.trim()) continue;
          v.split('\n').forEach((line, j) => L.push(`- ${j === 0 ? `${s.head[i]}: ` : ''}${stripInline(line)}`));
        }
      });
    });
    return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  }

  for (const b of spec.blocks) {
    switch (b.type) {
      case 'title':
        L.push(b.text.toUpperCase());
        if (b.subtitle) L.push(b.subtitle);
        break;
      case 'meta':
        b.rows.forEach(([k, v]) => L.push(`${k}: ${cell(v)}`));
        break;
      case 'h1':
        L.push('', `${b.text.toUpperCase()}:`);
        break;
      case 'h2':
        L.push('', `${b.text}:`);
        break;
      case 'h3':
        L.push(`${b.text}:`);
        break;
      case 'p':
        L.push(stripInline(b.text), '');
        break;
      case 'ul':
      case 'ol':
        b.items.forEach((raw, i) => {
          const it = asItem(raw);
          L.push(`${b.type === 'ol' ? `${i + 1}.` : '-'} ${stripInline(it.text)}`);
          it.sub.forEach((s) => L.push(`   - ${stripInline(s)}`));
        });
        L.push('');
        break;
      case 'table':
        if (b.head) L.push(b.head.join(' | '));
        b.rows.forEach((r) => L.push(r.map(cell).join(' | ')));
        L.push('');
        break;
      case 'quote':
        b.paras.forEach((t) => L.push(`> ${stripInline(t)}`, '>'));
        L.pop();
        L.push('');
        break;
      case 'callout':
        L.push(`${b.label} ${stripInline(b.text)}`, '');
        break;
      case 'pagebreak':
        break;
      default:
        throw new Error(`Unknown block type: ${b.type}`);
    }
  }
  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
