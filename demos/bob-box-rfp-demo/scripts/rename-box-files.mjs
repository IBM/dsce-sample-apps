/**
 * rename-box-files.mjs
 * Renames files and folders in Box to look like a real enterprise workspace.
 * Uses the same Box auth + MCP approach as the rest of the project.
 *
 * Run:  node scripts/rename-box-files.mjs
 */

import { getBoxAccessToken } from './box-auth.mjs';

const BOX_API = 'https://api.box.com/2.0';
const BOX_MCP_URL = 'https://mcp.box.com/';
const ROOT_FOLDER_NAME = 'Box_Upload_Folder';

// ── Desired renames ──────────────────────────────────────────────────────────
// Root folder
const FOLDER_RENAMES = {
  'Box_Upload_Folder': 'IBM Enterprise Content',
  'Acme Corp': 'Acme Bank',
};

const FILE_RENAMES = {
  'Acme_Late_Addendum_BAA_Compliance.pdf': 'Acme Bank - Late Addendum BAA Compliance.pdf',
  'Acme_Discovery_Notes.docx': 'Acme Bank Discovery Notes.docx',
  'September_Follow_Up_Notes.docx': 'September Follow-Up Notes.docx',
  'Acme_RFP.pdf': 'Acme Bank RFP-2025-DOCAI-04.pdf',
  'Demo_Request.docx': 'Demo Request.docx',
  'Data_Governance_Requirements.pdf': 'Data Governance Requirements.pdf',
  'Security_Requirements.pdf': 'Security Requirements.pdf',
  'Acme_Current_Architecture.pdf': 'Current Architecture Overview.pdf',
  'Acme_Technical_Requirements.xlsx': 'Technical Requirements.xlsx',
  'Integration_Requirements.xlsx': 'Integration Requirements.xlsx',
  'Architecture_Workshop_Notes.docx': 'Architecture Workshop Notes.docx',
  'Customer_Workflow_Notes.docx': 'Customer Workflow Notes.docx',
  'Demo_Planning_Email_Summary.docx': 'Demo Planning Email Summary.docx',
};

// ── Box REST helpers ─────────────────────────────────────────────────────────
let rpcId = 0;

async function mcpCall(token, name, args) {
  const res = await fetch(BOX_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  const body = await res.json();
  if (body.error || body.result?.isError) throw new Error(`MCP tool ${name} failed: ${JSON.stringify(body.error ?? body.result)}`);
  return body.result?.content?.[0]?.text ?? '';
}

async function renameItem(token, type, id, newName) {
  const endpoint = type === 'folder' ? `${BOX_API}/folders/${id}` : `${BOX_API}/files/${id}`;
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Rename failed (HTTP ${res.status}): ${err.message ?? JSON.stringify(err)}`);
  }
  return await res.json();
}

async function listFolderRest(token, folderId) {
  const res = await fetch(`${BOX_API}/folders/${folderId}/items?limit=200&fields=id,type,name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`List folder failed (HTTP ${res.status})`);
  const data = await res.json();
  return data.entries ?? [];
}

// ── Walk and rename ──────────────────────────────────────────────────────────
async function walkAndRename(token, folderId, depth = 0) {
  const entries = await listFolderRest(token, folderId);
  for (const entry of entries) {
    if (entry.type === 'folder') {
      const newName = FOLDER_RENAMES[entry.name];
      if (newName) {
        try {
          await renameItem(token, 'folder', entry.id, newName);
          console.log(`  ✓ folder  "${entry.name}" → "${newName}"`);
          // Walk with the same id (now renamed, contents unchanged)
        } catch (e) {
          console.error(`  ✗ folder  "${entry.name}": ${e.message}`);
        }
      }
      if (depth < 4) await walkAndRename(token, entry.id, depth + 1);
    } else if (entry.type === 'file') {
      const newName = FILE_RENAMES[entry.name];
      if (newName) {
        try {
          await renameItem(token, 'file', entry.id, newName);
          console.log(`  ✓ file    "${entry.name}" → "${newName}"`);
        } catch (e) {
          console.error(`  ✗ file    "${entry.name}": ${e.message}`);
        }
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Authenticating with Box…');
  const token = await getBoxAccessToken();
  if (!token) throw new Error('No Box token available — check .env');

  console.log(`Searching for root folder "${ROOT_FOLDER_NAME}"…`);
  const found = JSON.parse(
    await mcpCall(token, 'search_folders_by_name', { folder_name: ROOT_FOLDER_NAME.replace(/_/g, ' '), limit: 10 })
  );
  const root = (Array.isArray(found) ? found : []).find((f) => f.name === ROOT_FOLDER_NAME);
  if (!root) throw new Error(`Folder "${ROOT_FOLDER_NAME}" not found in Box`);

  console.log(`Found root folder id=${root.id}. Walking and renaming…\n`);
  await walkAndRename(token, root.id);

  // Rename the root folder itself last (so walk above still works)
  const rootNewName = FOLDER_RENAMES[ROOT_FOLDER_NAME];
  if (rootNewName) {
    try {
      await renameItem(token, 'folder', root.id, rootNewName);
      console.log(`\n  ✓ root    "${ROOT_FOLDER_NAME}" → "${rootNewName}"`);
    } catch (e) {
      console.error(`  ✗ root    "${ROOT_FOLDER_NAME}": ${e.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
