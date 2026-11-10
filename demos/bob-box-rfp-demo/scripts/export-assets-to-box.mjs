import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBoxAccessToken } from './box-auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function saveFilesLocally(files) {
  const targetDir = path.resolve(__dirname, '../IBM Enterprise Content/Generated RFP Responses');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const results = [];
  for (const f of files) {
    const dest = path.join(targetDir, f.filename);
    fs.writeFileSync(dest, f.buffer);
    console.log(`[LOCAL SAVE] ${f.filename} -> ${dest}`);
    results.push({ status: 'saved_locally', filename: f.filename, path: dest });
  }
  return { targetFolderId: 'local-generated', results, localFallback: true };
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

// --- Box hosted MCP helpers (folder resolution) ---
// Binary .pptx/.docx uploads stay on the REST API because the MCP upload_file tool is text-only.
const BOX_MCP_URL = 'https://mcp.box.com/';
const MCP_TIMEOUT_MS = 30_000;
const ROOT_FOLDER_NAME = 'IBM Enterprise Content';
const DELIVERABLES_FOLDER_NAME = 'Generated RFP Responses';
let mcpRpcId = 0;

async function callMcpTool(authToken, name, args) {
  const res = await fetch(BOX_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++mcpRpcId,
      method: 'tools/call',
      params: { name, arguments: args }
    }),
    signal: AbortSignal.timeout(MCP_TIMEOUT_MS)
  });

  if (res.status === 401) throw new Error('Box token expired or invalid. Paste a fresh BOX_DEV_TOKEN into .env.');
  if (!res.ok) throw new Error(`Box MCP HTTP ${res.status}`);

  const body = await res.json();
  if (body.error || body.result?.isError) {
    throw new Error(`Box MCP tool ${name} failed`);
  }
  return body.result?.content?.[0]?.text ?? '';
}

async function listChildFolders(authToken, folderId) {
  const text = await callMcpTool(authToken, 'list_folder_content_by_folder_id', {
    folder_id: folderId,
    limit: 100,
    fields: ['name']
  });
  return (JSON.parse(text).entries ?? []).filter(e => e.type === 'folder');
}

async function createChildFolder(authToken, name, parentId) {
  const text = await callMcpTool(authToken, 'create_folder', { name, parent_folder_id: parentId });
  let created;
  try { created = JSON.parse(text); } catch { created = null; }
  const id = created?.id ?? created?.folder_id;
  if (id) return String(id);
  // Response shape not recognised: look the new folder up instead of guessing.
  const match = (await listChildFolders(authToken, parentId)).find(f => f.name === name);
  if (!match) throw new Error(`Box MCP create_folder did not create "${name}"`);
  return String(match.id);
}

// Find (or create) "IBM Enterprise Content / Generated RFP Responses" in Box via the hosted MCP server
export async function getOrCreateTargetFolder(authToken) {
  // 1. Locate the IBM Enterprise Content (same lookup the live reader uses; Box name search does not match underscores)
  const found = JSON.parse(
    await callMcpTool(authToken, 'search_folders_by_name', { folder_name: ROOT_FOLDER_NAME.replace(/_/g, ' '), limit: 10 })
  );
  const root = (Array.isArray(found) ? found : []).find(f => f.name === ROOT_FOLDER_NAME);
  const rootFolderId = root ? String(root.id) : await createChildFolder(authToken, ROOT_FOLDER_NAME, '0');

  // 2. Find or create the deliverables folder under it (listing is more reliable than search for new folders)
  const existing = (await listChildFolders(authToken, rootFolderId))
    .find(f => String(f.name).toLowerCase() === DELIVERABLES_FOLDER_NAME.toLowerCase());
  return existing ? String(existing.id) : createChildFolder(authToken, DELIVERABLES_FOLDER_NAME, rootFolderId);
}

const MIME_BY_EXT = {
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf'
};
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9_\s-]{0,120}\.(pptx|docx|txt|pdf)$/;

/**
 * Uploads the files the browser built from the live brief/plan/assets.
 * files: [{ filename, buffer }] - filenames are allowlisted (.pptx/.docx, no path characters).
 */
export async function exportAllToBoxLive(authToken, files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('No files supplied for export');
  }
  for (const f of files) {
    if (!SAFE_FILENAME.test(f.filename)) throw new Error('Invalid export filename');
  }

  try {
    const activeToken = authToken || await getBoxAccessToken();
    if (!activeToken) {
      console.warn('[Box Exporter] No Box token available, saving deliverables locally in IBM Enterprise Content');
      return await saveFilesLocally(files);
    }

    console.log('Resolving Box destination folder via MCP...');
    const targetFolderId = await getOrCreateTargetFolder(activeToken);
    console.log(`Target Box Folder ID: ${targetFolderId}`);

    const results = [];
    for (const f of files) {
      const ext = f.filename.slice(f.filename.lastIndexOf('.'));
      const res = await uploadFileBuffer(targetFolderId, f.filename, MIME_BY_EXT[ext], f.buffer, activeToken);
      results.push(res);
      console.log(`[${res.status.toUpperCase()}] ${f.filename}`);
    }

    return { targetFolderId, results };
  } catch (err) {
    console.warn('[Box Exporter] Live Box upload encountered an error:', err.message, '-> saving locally in IBM Enterprise Content');
    return await saveFilesLocally(files);
  }
}

export const exportAssetsToBox = exportAllToBoxLive;
