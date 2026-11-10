// Converts the plain-text "fake" .docx/.pdf/.xlsx demo sources into real Office/PDF files
// (so Box can open and preview them) and uploads them to Box as NEW VERSIONS of the existing
// files. File IDs are preserved, and Box keeps the previous version in version history.
//
// Usage:
//   node scripts/convert-box-sources.mjs            # convert local files + upload to Box
//   node scripts/convert-box-sources.mjs --local    # convert local files only
//
// Idempotent: files that are already real (ZIP "PK" / "%PDF" signature) are skipped.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import PDFDocument from 'pdfkit';
import writeExcelFile from 'write-excel-file/node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'Box_Upload_Folder');
const envPath = path.join(root, '.env');
const uploadToBox = !process.argv.includes('--local');

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

function getToken() {
  if (!fs.existsSync(envPath)) return process.env.BOX_DEV_TOKEN || '';
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      if (key.trim() === 'BOX_DEV_TOKEN') return vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return process.env.BOX_DEV_TOKEN || '';
}

function isRealFile(buf, ext) {
  if (ext === 'pdf') return buf.subarray(0, 4).toString() === '%PDF';
  return buf[0] === 0x50 && buf[1] === 0x4b; // "PK" zip signature (docx / xlsx)
}

const isHeadingLine = (l) => /^[A-Z0-9][A-Z0-9 &/'()\-–—:.,]+:?$/.test(l.trim()) && l.trim().length > 3;

async function buildDocx(lines) {
  const children = lines.map((line, i) => {
    const text = line.trimEnd();
    if (i === 0) return new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
    if (text && isHeadingLine(text)) return new Paragraph({ text, heading: HeadingLevel.HEADING_2 });
    if (/^\s*[-•]\s+/.test(text)) {
      return new Paragraph({ text: text.replace(/^\s*[-•]\s+/, ''), bullet: { level: 0 } });
    }
    return new Paragraph({ text });
  });
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

function buildPdf(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: 'LETTER' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    lines.forEach((line, i) => {
      const text = line.trimEnd();
      if (i === 0) {
        doc.font('Helvetica-Bold').fontSize(14).text(text).moveDown(0.5);
      } else if (!text) {
        doc.moveDown(0.5);
      } else if (isHeadingLine(text)) {
        doc.font('Helvetica-Bold').fontSize(11).text(text);
      } else {
        doc.font('Helvetica').fontSize(10.5).text(text);
      }
    });
    doc.end();
  });
}

async function buildXlsx(lines) {
  const header = (value) => ({ value, fontWeight: 'bold', backgroundColor: '#E5E7EB' });
  const rows = [[header('Section'), header('Detail')]];
  let section = 'Header';
  lines.forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    if (i === 0) {
      rows.push([{ value: 'Title', fontWeight: 'bold' }, { value: text, wrap: true }]);
      return;
    }
    const idHeading = text.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (idHeading) {
      section = `${idHeading[1]} ${idHeading[2]}`.replace(/:$/, '').trim();
      return;
    }
    if (isHeadingLine(text)) {
      section = text.replace(/:$/, '');
      return;
    }
    rows.push([{ value: section, fontWeight: 'bold' }, { value: text.replace(/^[-•]\s+/, ''), wrap: true }]);
  });
  return writeExcelFile(rows, { columns: [{ width: 42 }, { width: 110 }], sheet: 'Content' }).toBuffer();
}

const BUILDERS = { docx: buildDocx, pdf: buildPdf, xlsx: buildXlsx };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

// ---------- Box upload (new version of an existing file, or new file if missing) ----------
async function boxJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  if (res.status === 401) throw new Error('Box token expired or invalid. Paste a fresh BOX_DEV_TOKEN into .env.');
  if (!res.ok) throw new Error(`Box API HTTP ${res.status}`);
  return res.json();
}

async function listChildren(folderId, token) {
  const data = await boxJson(`https://api.box.com/2.0/folders/${folderId}/items?limit=1000&fields=id,name,type`, token);
  return data.entries;
}

async function resolveFolderId(segments, token) {
  let id = '0';
  for (const name of segments) {
    const child = (await listChildren(id, token)).find((e) => e.type === 'folder' && e.name === name);
    if (!child) return null;
    id = child.id;
  }
  return id;
}

async function uploadVersion(folderId, fileName, ext, buffer, token) {
  const existing = (await listChildren(folderId, token)).find((e) => e.type === 'file' && e.name === fileName);
  const form = new FormData();
  form.append('attributes', JSON.stringify({ name: fileName, parent: { id: folderId } }));
  form.append('file', new Blob([buffer], { type: MIME[ext] }), fileName);

  const url = existing
    ? `https://upload.box.com/api/2.0/files/${existing.id}/content`
    : 'https://upload.box.com/api/2.0/files/content';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`upload failed (HTTP ${res.status})`);
  return existing ? 'new version' : 'created';
}

// ---------- main ----------
const token = uploadToBox ? getToken() : '';
if (uploadToBox && !token) {
  console.error('No BOX_DEV_TOKEN found in .env (use --local to convert without uploading).');
  process.exit(1);
}

const targets = walk(sourceRoot).filter((f) => /\.(docx|pdf|xlsx)$/.test(f));
let converted = 0;
let failures = 0;

for (const file of targets) {
  const rel = path.relative(sourceRoot, file);
  const ext = path.extname(file).slice(1);
  const original = fs.readFileSync(file);

  let buffer = original;
  if (isRealFile(original, ext)) {
    console.log(`skip    ${rel} (already a real ${ext})`);
  } else {
    const lines = original.toString('utf8').split(/\r?\n/);
    buffer = await BUILDERS[ext](lines);
    fs.writeFileSync(file, buffer);
    converted++;
    console.log(`built   ${rel} (${buffer.length} bytes)`);
  }

  // Only files under Customers/... exist in Box; the root-level addendum is a local-only demo file.
  const segments = path.dirname(rel).split(path.sep).filter((s) => s && s !== '.');
  if (uploadToBox && segments.length > 0) {
    try {
      const folderId = await resolveFolderId(segments, token);
      if (!folderId) throw new Error('folder not found in Box');
      const outcome = await uploadVersion(folderId, path.basename(file), ext, buffer, token);
      console.log(`upload  ${rel} -> ${outcome}`);
    } catch (err) {
      failures++;
      console.error(`FAILED  ${rel}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
}

console.log(`\nConverted ${converted} file(s) locally${uploadToBox ? `, ${failures} upload failure(s)` : ' (upload skipped)'}.`);
process.exit(failures ? 1 : 0);
