// stdio -> Box hosted MCP bridge (https://mcp.box.com).
// Bob speaks stdio to this script; each JSON-RPC message is forwarded over HTTPS
// with the active Box token (auto-refreshed via Client Credentials or Developer Token).
import readline from 'readline';
import { getBoxAccessToken } from './box-auth.mjs';

const BOX_MCP_URL = 'https://mcp.box.com/';
const REQUEST_TIMEOUT_MS = 60_000;

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendError(id, code, message) {
  if (id !== undefined && id !== null) {
    send({ jsonrpc: '2.0', id, error: { code, message } });
  }
}

// Box may answer with plain JSON or an SSE stream; return the JSON-RPC payloads either way.
function parseBody(contentType, text) {
  if (!text.trim()) return [];
  if (contentType.includes('text/event-stream')) {
    return text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => JSON.parse(l.slice(5).trim()));
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function forward(message) {
  let token = '';
  try {
    token = await getBoxAccessToken();
  } catch (err) {
    sendError(message.id, -32001, `Box authentication error: ${err.message}`);
    return;
  }

  if (!token) {
    sendError(message.id, -32001, 'No Box credentials found in .env. Configure BOX_CLIENT_ID & BOX_CLIENT_SECRET or BOX_DEV_TOKEN.');
    return;
  }

  try {
    const res = await fetch(BOX_MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 401) {
      sendError(message.id, -32001, 'Box token expired or invalid. Paste a fresh BOX_DEV_TOKEN into .env and retry.');
      return;
    }
    if (!res.ok) {
      console.error(`Box MCP returned HTTP ${res.status}`);
      sendError(message.id, -32002, `Box MCP request failed (HTTP ${res.status}).`);
      return;
    }

    const payloads = parseBody(res.headers.get('content-type') || '', await res.text());
    for (const payload of payloads) send(payload);
  } catch (err) {
    console.error('Box MCP bridge error:', err?.message);
    sendError(message.id, -32003, 'Could not reach Box MCP server.');
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    console.error('Ignoring non-JSON input line');
    return;
  }
  void forward(message);
});
