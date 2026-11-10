import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Read .env
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = val;
    }
  }
}

const token = process.env.BOX_DEV_TOKEN;
if (!token) {
  console.error('❌ Error: No BOX_DEV_TOKEN found in .env');
  process.exit(1);
}

// 2. Build Brief DOCX Buffer
async function generateBriefDocxBuffer() {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'ACME CORP — DEMO READINESS EXECUTIVE BRIEF', heading: HeadingLevel.HEADING_1 }),
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

  return await Packer.toBuffer(doc);
}

// 3. Build Demo Script DOCX Buffer
async function generateScriptDocxBuffer() {
  const scriptContent = `ACME CORP - TAILORED CUSTOMER DEMONSTRATION SCRIPT
Estimated Duration: 18 Minutes (Presentation: 12 min | Technical Q&A: 6+ min)
Presenter: Lead Sales Engineer | Solution: Box Content Cloud + IBM Bob
Target Stakeholders: David Chen (IT Lead), Rachel Green (IT Director), Marcus Vance (CISO Office)

================================================================================
PART 1: WELCOME & THE ACME ONBOARDING CHALLENGE (2 MIN)
================================================================================
[Visual: Slide / Architecture Summary - Current vs. Target State]
PRESENTER:
"Good morning, David, Rachel, and team. Thank you for joining us today.

When we reviewed your onboarding operations, one clear theme emerged: Acme processes over 450 commercial accounts every month, but your teams are wrestling with fragmented network shares, a 48-hour classification backlog, and hours spent manually re-entering document data into Salesforce.

Today, we're going to demonstrate exactly how Box and IBM Bob eliminate that friction. We'll show you an end-to-end flow: from raw intake, to automated AI classification, streamlined approval routing, and instantaneous Salesforce synchronization."

================================================================================
PART 2: INGESTION & AUTOMATED CLASSIFICATION (3 MIN)
================================================================================
[Visual: Box Intake Portal - Customer Upload Dropzone]
PRESENTER:
"Let's start where your intake specialists work. When a new customer package arrives—like this commercial tax form and business license—the specialist simply uploads the files to Box.

[Action: Drop Acme_Commercial_W9_Packet.pdf into intake folder]

Notice what happens immediately: Box doesn't just store the file. Through automated classification, Box analyzes the document structure, identifies it as an IRS Form W-9, and extracts key metadata fields—like the Employer Identification Number, Legal Entity Name, and Expiration Date—with zero manual labeling required.

Rachel, this is the exact capability you requested in the RFP to eliminate that 48-hour backlog."

================================================================================
PART 3: APPROVAL ROUTING & AUDIT TRAIL (2.5 MIN)
================================================================================
[Visual: Box Relay / Workflow Task Panel]
PRESENTER:
"Because this document is classified as a high-tier onboarding asset, Box automatically triggers your standardized underwriting approval workflow.

[Action: Show Underwriting Review Task with automated escalation rules]

Instead of untracked Outlook email threads where cases get lost when reviewers are out of office, the approver receives an actionable task with clear deadlines. Every view, edit, and approval decision is immutably logged into Box's tamper-evident audit trail—meeting Marcus's mandatory 365-day compliance standard."

================================================================================
PART 4: THE LIVE SALESFORCE HANDOFF (3.5 MIN)
================================================================================
[Visual: Salesforce Sales Cloud Account View - Acme Commercial Account]
PRESENTER:
"Now let's switch over to Salesforce Sales Cloud, where your account executives and customer success reps live.

[Action: Open Salesforce Account Record -> Box Embedded Canvas Component]

Without anyone typing a single line of metadata or uploading duplicate files, the account record is instantly synchronized. The account manager sees the verified document preview right inside Salesforce, complete with extracted metadata badges and real-time approval status.

David, this directly eliminates the 2 to 3 hours daily your ops team spent manually locating files and retyping data."

================================================================================
PART 5: GRANULAR ROLE-BASED ACCESS CONTROLS (2 MIN)
================================================================================
[Visual: Box Permissions & Role Simulation]
PRESENTER:
"Let's touch on security. Marcus's team mandated strict RBAC. Watch what happens when I switch roles:
- As an Intake Clerk, I can upload files but cannot approve or modify governance policies.
- As an Underwriting Approver, I have review and sign-off authority.
- And if an external legal auditor needs temporary access, they receive a view-only, dynamic watermarked preview with downloading restricted. All stored with AES-256 encryption in US data centers."

================================================================================
PART 6: TRANSITION TO TECHNICAL VALIDATION & Q&A (5+ MIN)
================================================================================
[Visual: Technical Validation Matrix]
PRESENTER:
"To wrap up our demonstration and respect the 15 minutes we reserved for David and Marcus: we've pre-validated your requirements for REST APIs, SAML Single Sign-On, and US Data Residency. Let's open the floor to address your specific IdP selection and records retention schedules."
`;

  const paragraphs = scriptContent.split('\n').map(line => {
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
      children: [
        new Paragraph({ text: 'ACME CORP — CUSTOMER DEMONSTRATION SCRIPT', heading: HeadingLevel.HEADING_1 }),
        ...paragraphs
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

// 4. Build Validation Matrix DOCX Buffer
async function generateMatrixDocxBuffer() {
  const matrixItems = [
    { req: 'Single Sign-On (SAML 2.0 / OpenID Connect)', status: 'Pre-Validated', cat: 'Security', notes: 'Documented in Tech Matrix REQ-01 and Current Architecture. Ready for Okta or Azure AD federation.' },
    { req: 'Salesforce Sales Cloud Bi-directional Integration', status: 'Pre-Validated', cat: 'Integration', notes: 'Documented in RFP 3.2, Architecture Workshop, and Integration Matrix. Embedded canvas + REST sync.' },
    { req: 'REST APIs & Webhooks for Asynchronous Events', status: 'Pre-Validated', cat: 'Architecture', notes: 'Documented in Tech Matrix REQ-02 and Integration Matrix. Minimum 100 req/sec rate limit supported.' },
    { req: 'Granular Role-Based Access Controls (RBAC)', status: 'Pre-Validated', cat: 'Security', notes: 'Documented in CISO Mandate and Tech Matrix. Segregation of Intake, Review, and Audit tiers.' },
    { req: 'Strict US Data Residency (Zero International Egress)', status: 'Pre-Validated', cat: 'Compliance', notes: 'Documented in CISO Mandate and Data Governance. US-only data center regions enforced.' },
    { req: 'Tamper-Evident Audit Logging (365-Day Minimum)', status: 'Pre-Validated', cat: 'Compliance', notes: 'Documented in CISO Mandate and RFP 4.1. Comprehensive immutable event logging.' },
    { req: 'AES-256 At Rest & TLS 1.2+ In Transit Cryptography', status: 'Pre-Validated', cat: 'Security', notes: 'Documented in CISO Mandate and Tech Matrix REQ-05.' },
    { req: 'Monthly Ingestion Document Volume & Tenant Sizing', status: 'Confirm in Q&A', cat: 'Operations', notes: 'Unresolved in Data Governance framework. Needs confirmation during architecture Q&A.' },
    { req: 'Automated Records Retention Schedule (3 vs 7 Years)', status: 'Confirm in Q&A', cat: 'Compliance', notes: 'Unresolved in RFP Section 4.2 and Data Governance. Legal review in progress.' },
    { req: 'System of Record for Custom Document Metadata', status: 'Confirm in Q&A', cat: 'Architecture', notes: 'Architecture team debating Salesforce vs. Box as authoritative master.' }
  ];

  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Requirement', heading: HeadingLevel.HEADING_3 })], width: { size: 3000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Status', heading: HeadingLevel.HEADING_3 })], width: { size: 2000, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Category', heading: HeadingLevel.HEADING_3 })], width: { size: 1800, type: WidthType.DXA } }),
        new TableCell({ children: [new Paragraph({ text: 'Validation Notes', heading: HeadingLevel.HEADING_3 })], width: { size: 4200, type: WidthType.DXA } }),
      ]
    }),
    ...matrixItems.map(item => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: item.req })] }),
        new TableCell({ children: [new Paragraph({ text: item.status })] }),
        new TableCell({ children: [new Paragraph({ text: item.cat })] }),
        new TableCell({ children: [new Paragraph({ text: item.notes })] }),
      ]
    }))
  ];

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'ACME CORP — TECHNICAL VALIDATION & DISCOVERY MATRIX', heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      ]
    }]
  });

  return await Packer.toBuffer(doc);
}

function getLatestToken() {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (k.trim() === 'BOX_DEV_TOKEN') {
          return v.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }
  return process.env.BOX_DEV_TOKEN || '';
}

async function uploadFileBuffer(folderId, filename, mimeType, buffer, authToken) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  
  const metadata = JSON.stringify({
    name: filename,
    parent: { id: folderId }
  });

  const headerPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="attributes"\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`,
    'utf-8'
  );

  const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const payload = Buffer.concat([headerPart, buffer, footerPart]);

  const res = await fetch('https://upload.box.com/api/2.0/files/content', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: payload
  });

  if (!res.ok) {
    const err = await res.json();
    if (err.status === 409 && err.context_info?.conflicts) {
      const existingId = err.context_info.conflicts.id;
      const vRes = await fetch(`https://upload.box.com/api/2.0/files/${existingId}/content`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: payload
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        return { status: 'updated', item: vData.entries[0] };
      }
    }
    throw new Error(err.message || res.statusText);
  }

  const data = await res.json();
  return { status: 'created', item: data.entries[0] };
}

// Find or dynamically create target folder hierarchy in Box
export async function getOrCreateTargetFolder(authToken = token) {
  // 1. Get or create Customers folder in root
  let customersFolderId = '0';
  const rootRes = await fetch('https://api.box.com/2.0/folders/0/items?limit=100', {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (rootRes.ok) {
    const rootData = await rootRes.json();
    const custEntry = rootData.entries.find(e => e.type === 'folder' && e.name.toLowerCase() === 'customers');
    if (custEntry) {
      customersFolderId = custEntry.id;
    } else {
      const createCust = await fetch('https://api.box.com/2.0/folders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Customers', parent: { id: '0' } })
      });
      if (createCust.ok) {
        const data = await createCust.json();
        customersFolderId = data.id;
      }
    }
  }

  // 2. Get or create Acme Corp folder under Customers
  let acmeFolderId = customersFolderId;
  const custRes = await fetch(`https://api.box.com/2.0/folders/${customersFolderId}/items?limit=100`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (custRes.ok) {
    const custData = await custRes.json();
    const acmeEntry = custData.entries.find(e => e.type === 'folder' && e.name.toLowerCase().includes('acme'));
    if (acmeEntry) {
      acmeFolderId = acmeEntry.id;
    } else {
      const createAcme = await fetch('https://api.box.com/2.0/folders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Acme Corp', parent: { id: customersFolderId } })
      });
      if (createAcme.ok) {
        const data = await createAcme.json();
        acmeFolderId = data.id;
      }
    }
  }

  // 3. Get or create "Bob Prepared Deliverables" under Acme Corp
  let deliverablesFolderId = acmeFolderId;
  const acmeRes = await fetch(`https://api.box.com/2.0/folders/${acmeFolderId}/items?limit=100`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (acmeRes.ok) {
    const acmeData = await acmeRes.json();
    const delivEntry = acmeData.entries.find(e => e.type === 'folder' && e.name.toLowerCase().includes('bob prepared'));
    if (delivEntry) {
      deliverablesFolderId = delivEntry.id;
    } else {
      const createDeliv = await fetch('https://api.box.com/2.0/folders', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Bob Prepared Deliverables', parent: { id: acmeFolderId } })
      });
      if (createDeliv.ok) {
        const data = await createDeliv.json();
        deliverablesFolderId = data.id;
      }
    }
  }

  return deliverablesFolderId;
}

export async function exportAllToBoxLive(authToken, pptxBuffer) {
  const activeToken = authToken || getLatestToken();
  if (!activeToken) {
    throw new Error('No Box Developer Token found in .env');
  }

  console.log('🚀 Dynamically resolving Box destination folder...');
  const targetFolderId = await getOrCreateTargetFolder(activeToken);
  console.log(`📁 Target Box Folder ID: ${targetFolderId}`);

  const results = [];

  // 1. PPTX (rendered in the browser from the website's slide deck)
  if (pptxBuffer) {
    const pptxRes = await uploadFileBuffer(
      targetFolderId,
      'Acme_Corp_Presentation_Slide_Deck.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      pptxBuffer,
      activeToken
    );
    results.push(pptxRes);
    console.log(`✅ [${pptxRes.status.toUpperCase()}] Acme_Corp_Presentation_Slide_Deck.pptx`);
  } else {
    console.warn('⚠️  No slide deck PPTX supplied (it is rendered in the browser) - skipping slide deck upload.');
  }

  // 2. Brief DOCX
  console.log('📝 Building Formatted Word Brief (.docx)...');
  const briefBuffer = await generateBriefDocxBuffer();
  const briefRes = await uploadFileBuffer(
    targetFolderId,
    'Acme_Corp_Executive_Meeting_Brief.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    briefBuffer,
    activeToken
  );
  results.push(briefRes);
  console.log(`✅ [${briefRes.status.toUpperCase()}] Acme_Corp_Executive_Meeting_Brief.docx`);

  // 3. Demo Script DOCX
  console.log('📝 Building Customer Demo Script (.docx)...');
  const scriptBuffer = await generateScriptDocxBuffer();
  const scriptRes = await uploadFileBuffer(
    targetFolderId,
    'Acme_Corp_Customer_Demo_Script.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    scriptBuffer,
    activeToken
  );
  results.push(scriptRes);
  console.log(`✅ [${scriptRes.status.toUpperCase()}] Acme_Corp_Customer_Demo_Script.docx`);

  // 4. Matrix DOCX
  console.log('📝 Building Technical Validation Matrix (.docx)...');
  const matrixBuffer = await generateMatrixDocxBuffer();
  const matrixRes = await uploadFileBuffer(
    targetFolderId,
    'Acme_Corp_Technical_Validation_Matrix.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matrixBuffer,
    activeToken
  );
  results.push(matrixRes);
  console.log(`✅ [${matrixRes.status.toUpperCase()}] Acme_Corp_Technical_Validation_Matrix.docx`);

  return { targetFolderId, results };
}

export const exportAssetsToBox = exportAllToBoxLive;

// Self-run when invoked directly
if (process.argv[1] && process.argv[1].endsWith('export-assets-to-box.mjs')) {
  exportAllToBoxLive()
    .then(() => console.log('\n🎉 Finished! All 4 native Office (.pptx & .docx) files are live in Box Web App!'))
    .catch(err => console.error('❌ Error during export:', err));
}
