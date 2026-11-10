// Builds the one-slide architecture diagram.
//   node docs/architecture/build-slide.mjs          -> Bob_Box_Architecture.pptx          (what runs today)
//   node docs/architecture/build-slide.mjs target   -> Bob_Box_Target_Architecture.pptx  (planned live-MCP design)
// Requires bob.png and box.png (rendered from bob.html / box.html) in this folder.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.argv[2] === 'target';
const OUT = path.join(dir, TARGET ? 'Bob_Box_Target_Architecture.pptx' : 'Bob_Box_Architecture.pptx');

const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
const bobPng = path.join(dir, 'bob.png');
const boxPng = path.join(dir, 'box.png');
const boxDim = pngSize(boxPng);

const C = {
  box: '0061D5', ibm: '0F62FE', ink: '161616', grey: '525252',
  card: 'F4F4F4', line: 'E0E0E0', white: 'FFFFFF', green: '198038',
};
const FONT = 'Calibri';

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.title = 'Bob + Box Architecture';
const s = pres.addSlide();
s.background = { color: C.white };

// ---- Title ----
s.addText('From Customer Context to Customer Demo', {
  x: 0.46, y: 0.3, w: TARGET ? 9.0 : 12.4, h: 0.6, fontFace: FONT, fontSize: 30, bold: true, color: C.ink, margin: 0,
});
if (TARGET) {
  s.addShape(pres.ShapeType.roundRect, {
    x: 9.9, y: 0.36, w: 2.96, h: 0.46, rectRadius: 0.23, fill: { color: C.ibm }, line: { color: C.ibm, width: 0 },
  });
  s.addText('TARGET ARCHITECTURE', {
    x: 9.9, y: 0.36, w: 2.96, h: 0.46, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 13, bold: true, color: C.white, margin: 0,
  });
}
s.addText('Box provides the customer context. Bob turns that context into a tailored, evidence-backed demo.', {
  x: 0.46, y: 0.92, w: 12.4, h: 0.4, fontFace: FONT, fontSize: 16, color: C.grey, margin: 0,
});

// ---- Cards ----
const Y = 1.6, H = 3.6;
const todayCards = [
  {
    x: 0.46, w: 2.6, accent: C.box, step: '1',
    logo: { path: boxPng, h: 0.62, w: 0.62 * boxDim.w / boxDim.h },
    title: 'Box Content Cloud', sub: 'Acme Corp workspace',
    bullets: ['Target home for the 12 Acme files (discovery, RFP, tech, security)', 'Files staged locally in Box_Upload_Folder/', 'Receives Bob\'s 4 deliverables today'],
  },
  {
    x: 3.76, w: 2.1, accent: C.grey, step: '2',
    title: 'Box MCP Server', sub: 'Model Context Protocol',
    bullets: ['Lets Bob search and read Box files', 'Registered for Bob in .bob/mcp.json', 'Not called by the web app at runtime yet'],
  },
  {
    x: 6.56, w: 2.8, accent: C.ibm, step: '3',
    logo: { path: bobPng, h: 0.78, w: 0.78 },
    title: 'IBM Bob', sub: 'Reasons over Box content',
    bullets: ['Extracts needs, pain points, requirements', 'Every finding cites its Box source', 'Says "not found" instead of guessing'],
  },
  {
    x: 10.06, w: 2.8, accent: C.ink, step: '4',
    title: 'Demo Web App', sub: 'React + Vite',
    bullets: ['Runs on a bundled snapshot of the 12 files (no live Box read)', 'Demo brief with evidence trail', 'Demo plan and grounded Ask Bob Q&A', 'Generates deck, brief, script, checklist'],
  },
];
const targetCards = [
  {
    x: 0.46, w: 2.6, accent: C.box, step: '1',
    logo: { path: boxPng, h: 0.62, w: 0.62 * boxDim.w / boxDim.h },
    title: 'Box Content Cloud', sub: 'Acme Corp workspace',
    bullets: ['Source of truth for Acme\'s customer files', 'Discovery notes, RFP, tech and security specs', 'Permissions and audit stay in Box'],
  },
  {
    x: 3.76, w: 2.1, accent: C.grey, step: '2',
    title: 'Box MCP Server', sub: 'Model Context Protocol',
    bullets: ['search: find Acme files', 'read: extract PDF and Word text', 'Standard tool interface for Bob'],
  },
  {
    x: 6.56, w: 2.8, accent: C.ibm, step: '3',
    logo: { path: bobPng, h: 0.78, w: 0.78 },
    title: 'IBM Bob', sub: 'Reasons over Box content',
    bullets: ['Extracts needs, pain points, requirements', 'Every finding cites its Box source', 'Says "not found" instead of guessing'],
  },
  {
    x: 10.06, w: 2.8, accent: C.ink, step: '4',
    title: 'Demo Web App', sub: 'React + Vite',
    bullets: ['Demo brief with evidence trail', 'Demo plan and grounded Ask Bob Q&A', 'Generates deck, brief, script, checklist', 'Falls back to cached copy if Box is unreachable'],
  },
];
const cards = TARGET ? targetCards : todayCards;

for (const c of cards) {
  s.addShape(pres.ShapeType.rect, {
    x: c.x, y: Y, w: c.w, h: H, fill: { color: C.card }, line: { color: C.line, width: 1 },
  });
  s.addShape(pres.ShapeType.rect, { x: c.x, y: Y, w: c.w, h: 0.09, fill: { color: c.accent }, line: { color: c.accent, width: 0 } });
  // step badge
  s.addShape(pres.ShapeType.ellipse, { x: c.x + 0.14, y: Y + 0.22, w: 0.34, h: 0.34, fill: { color: c.accent }, line: { color: c.accent, width: 0 } });
  s.addText(c.step, { x: c.x + 0.14, y: Y + 0.22, w: 0.34, h: 0.34, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 13, bold: true, color: C.white, margin: 0 });

  if (c.logo) {
    s.addImage({ path: c.logo.path, x: c.x + c.w - c.logo.w - 0.15, y: Y + 0.18, w: c.logo.w, h: c.logo.h });
  }
  // Same vertical rhythm on every card so titles and bullets line up across the row
  const titleY = Y + 1.1;
  s.addText(c.title, { x: c.x + 0.14, y: titleY, w: c.w - 0.28, h: 0.36, fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0 });
  s.addText(c.sub, { x: c.x + 0.14, y: titleY + 0.38, w: c.w - 0.28, h: 0.3, fontFace: FONT, fontSize: 12, color: c.accent === C.ink ? C.grey : c.accent, bold: true, valign: 'top', margin: 0 });
  s.addText(
    c.bullets.map((t) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: true } })),
    { x: c.x + 0.14, y: titleY + 0.8, w: c.w - 0.28, h: Y + H - (titleY + 0.8) - 0.12, fontFace: FONT, fontSize: 12, color: C.ink, valign: 'top', paraSpaceAfter: 4, margin: 0 }
  );
}

// ---- Forward arrows with labels ----
const arrows = TARGET
  ? [
      { x1: 3.06, x2: 3.76, label: 'files', dash: 'solid' },
      { x1: 5.86, x2: 6.56, label: 'context', dash: 'solid' },
      { x1: 9.36, x2: 10.06, label: 'findings', dash: 'solid' },
    ]
  : [
      { x1: 3.06, x2: 3.76, label: 'files', dash: 'dash' },
      { x1: 5.86, x2: 6.56, label: 'context', dash: 'dash' },
      { x1: 9.36, x2: 10.06, label: 'snapshot', dash: 'solid' },
    ];
const midY = Y + H / 2;
for (const a of arrows) {
  s.addShape(pres.ShapeType.line, {
    x: a.x1 + 0.04, y: midY, w: a.x2 - a.x1 - 0.08, h: 0,
    line: { color: C.ink, width: 2.25, endArrowType: 'triangle', dashType: a.dash },
  });
  s.addText(a.label, { x: a.x1, y: midY - 0.34, w: a.x2 - a.x1, h: 0.28, align: 'center', fontFace: FONT, fontSize: 11, bold: true, color: C.grey, margin: 0 });
}

// ---- Write-back loop (App/Bob deliverables -> Box) ----
const loopY = 6.0, xBox = 0.46 + 1.3, xApp = 10.06 + 1.4;
s.addShape(pres.ShapeType.line, { x: xBox, y: Y + H, w: 0, h: loopY - (Y + H), line: { color: C.green, width: 2.25, beginArrowType: 'triangle' } });
s.addShape(pres.ShapeType.line, { x: xBox, y: loopY, w: xApp - xBox, h: 0, line: { color: C.green, width: 2.25 } });
s.addShape(pres.ShapeType.line, { x: xApp, y: Y + H, w: 0, h: loopY - (Y + H), line: { color: C.green, width: 2.25 } });

s.addShape(pres.ShapeType.roundRect, {
  x: 2.9, y: loopY - 0.46, w: 7.55, h: 0.92, rectRadius: 0.08,
  fill: { color: C.white }, line: { color: C.green, width: 1.5 },
});
s.addText(
  [
    { text: 'Export back to Box via Box REST API', options: { bold: true, fontSize: 15, color: C.green, breakLine: true } },
    { text: '4 deliverables: slide deck (.pptx), executive brief, demo script, validation checklist (.docx)', options: { fontSize: 12, color: C.ink, breakLine: true } },
    { text: 'Customers / Acme Corp / Bob Prepared Deliverables', options: { fontSize: 11, color: C.grey } },
  ],
  { x: 2.9, y: loopY - 0.46, w: 7.55, h: 0.92, align: 'center', valign: 'middle', fontFace: FONT, margin: 0 }
);

// ---- Footnote ----
s.addText(
  TARGET
    ? 'Target state: the web app reads Acme\'s files from Box through the Box MCP server (search + read). Export back to Box continues to use the Box REST API, since the MCP server has no upload tool.'
    : 'Solid = runs today. Dashed = available to Bob through MCP, not used by the web app at runtime. Only Export writes to live Box (REST API, developer token).',
  { x: 0.46, y: 6.95, w: 12.4, h: 0.3, fontFace: FONT, fontSize: 10, color: C.grey, margin: 0 }
);

s.addNotes(TARGET ?
  'Target architecture. (1) Acme\'s customer files live in Box, the source of truth. (2) The Box MCP server exposes search and read tools; Bob uses them to find and read the files, including PDF and Word extraction. ' +
  '(3) Bob extracts needs, pain points and requirements, cites the Box source for every finding, and says "not found" rather than guessing. ' +
  '(4) The web app presents the brief, evidence trail, demo plan and Ask Bob, with a cached copy as a fallback if Box is unreachable. ' +
  'The deliverables are exported back to the customer\'s Box folder through the Box REST API, because the Box MCP server is read-only today. ' +
  'Today the web app runs on a bundled snapshot; the provider interface is already in place for this swap.'
:
  'Walkthrough: (1) Acme\'s customer files live in Box. (2) The Box MCP server gives Bob a standard way to search and read them (configured in .bob/mcp.json). ' +
  '(3) Bob extracts needs, pain points and requirements, and cites the Box source for every finding; it says "not found" rather than guessing. ' +
  '(4) The web app presents the brief, evidence trail, demo plan and Ask Bob from a bundled snapshot of the 12 files, so it is deterministic and works offline. ' +
  'It does not read Box live yet (the provider interface is ready for a live MCP implementation). The one live Box call is Export, which uploads the four deliverables to the customer\'s Box folder via the Box REST API.'
);

await pres.writeFile({ fileName: OUT });

// pptxgenjs emits <p:notesMasterIdLst> after <p:sldIdLst>; the OpenXML schema requires it before.
const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
let xml = await zip.file('ppt/presentation.xml').async('string');
const notes = xml.match(/<p:notesMasterIdLst>.*?<\/p:notesMasterIdLst>/s)?.[0];
if (notes) {
  xml = xml.replace(notes, '').replace('<p:sldIdLst>', notes + '<p:sldIdLst>');
  zip.file('ppt/presentation.xml', xml);
  fs.writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
console.log('Wrote', OUT);
