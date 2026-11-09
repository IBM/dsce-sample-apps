import express from 'express';
import cors from 'cors';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { createMockRouter } from './mockRoutes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from the parent instana-bob-app/ directory
config({ path: resolve(__dirname, '../.env') });
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── STREAM_MODE ───────────────────────────────────────────────────────────
//   mock   (default) – simulated Retail Application data + scenario injector.
//                      No Instana, MCP or Bob credentials are needed.
//   realtime         – live data fetched from Instana through the MCP server.
const RAW_STREAM_MODE = (process.env.STREAM_MODE || 'mock').trim().toLowerCase();
if (!['mock', 'realtime'].includes(RAW_STREAM_MODE)) {
  console.warn(`WARN: invalid STREAM_MODE="${process.env.STREAM_MODE}" (expected "mock" or "realtime"); using "mock".`);
}
const STREAM_MODE = RAW_STREAM_MODE === 'realtime' ? 'realtime' : 'mock';
const MOCK_MODE = STREAM_MODE === 'mock';
console.log(`STREAM_MODE=${STREAM_MODE}${MOCK_MODE ? ' (simulated data; no Instana/MCP/Bob calls)' : ' (live Instana via MCP)'}`);

// ─── Security: CORS & Rate Limiting ─────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like same-origin mobile apps, curl, or server-to-server)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS request blocked by security policy'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Lightweight in-memory rate limiter for expensive LLM / telemetry sinks
function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const requests = new Map();
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (requests.get(ip) || []).filter((t) => t > windowStart);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    timestamps.push(now);
    requests.set(ip, timestamps);
    next();
  };
}

const llmRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

// Mock mode: the simulated API answers first; live handlers below are never reached
// for the routes it owns, and live-only routes are rejected by the mock router.
if (MOCK_MODE) app.use(createMockRouter());

// ─── Bob Inference client ─────────────────────────────────────────────────
// Bob uses an OpenAI-compatible inference endpoint but requires:
//   - Authorization: Apikey <key>   (not Bearer)
//   - x-instance-id and x-team-id headers
//   - Base path: /inference/v1  (not /v1)
//   - User-Agent: bobshell/<version>  (Cloudflare trust)

const BOB_API_KEY     = process.env.BOB_API_KEY || (MOCK_MODE ? 'unused-in-mock-mode' : undefined);
const BOB_INSTANCE_ID = process.env.BOB_INSTANCE_ID;
const BOB_TEAM_ID     = process.env.BOB_TEAM_ID;
const BOB_BASE_URL    = (process.env.BOB_API_BASE_URL || 'https://api.us-east.bob.ibm.com')
                          .replace(/\/v1\/?$/, ''); // strip trailing /v1 — we add it per-path

if (!MOCK_MODE && (!BOB_API_KEY || !BOB_INSTANCE_ID || !BOB_TEAM_ID)) {
  console.error('FATAL: STREAM_MODE=realtime requires BOB_API_KEY, BOB_INSTANCE_ID and BOB_TEAM_ID (see .env.example).');
  process.exit(1);
}

const bobClient = new OpenAI({
  apiKey: BOB_API_KEY,                    // placeholder; real auth via defaultHeaders
  baseURL: `${BOB_BASE_URL}/inference/v1`,
  defaultHeaders: {
    'Authorization': `Apikey ${BOB_API_KEY}`,
    'x-instance-id': BOB_INSTANCE_ID || '',
    'x-team-id':     BOB_TEAM_ID     || '',
    'User-Agent':    'bobshell/1.0.6',
  },
});

const BOB_MODEL = process.env.BOB_MODEL || 'claude-opus-4-5';

// ── Well-known application IDs (avoid name-based lookups) ─────────────────
// These were discovered via manage_applications → get_applications with name_filter=Retail
const RETAIL_APP_NAME = process.env.INSTANA_APP_NAME || 'Retail Application';

// ─── MCP client connected to Instana MCP server ───────────────────────────
let mcpClient = null;
let mcpTools = [];

async function connectMCP() {
  try {
    console.log('Connecting to Instana MCP server...');
    const transport = new StdioClientTransport({
      command: process.env.INSTANA_MCP_COMMAND || 'npx',
      args: JSON.parse(process.env.INSTANA_MCP_ARGS || '["@instana/mcp-server"]'),
      env: {
        ...process.env,
        INSTANA_BASE_URL: process.env.INSTANA_BASE_URL,
        INSTANA_API_TOKEN: process.env.INSTANA_API_TOKEN,
        INSTANA_SSL_VERIFY: process.env.INSTANA_SSL_VERIFY,
        INSTANA_CA_BUNDLE: process.env.INSTANA_CA_BUNDLE,
        SSL_CERT_FILE: process.env.SSL_CERT_FILE,
        REQUESTS_CA_BUNDLE: process.env.REQUESTS_CA_BUNDLE,
      },
    });

    // Use a local client and publish it only after connect + listTools succeed,
    // so a failed connection leaves mcpClient null (callers return 503).
    const client = new Client({ name: 'instana-bob-app', version: '1.0.0' });
    await client.connect(transport);

    const toolsResult = await client.listTools();

    // Convert MCP tool schema → OpenAI function calling format
    mcpClient = client;
    mcpTools = toolsResult.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema ?? { type: 'object', properties: {} },
      },
    }));

    console.log(`Connected to Instana MCP. ${mcpTools.length} tools available.`);
  } catch (err) {
    console.error('Failed to connect to Instana MCP server:', err.message);
    console.error('Continuing without MCP — set INSTANA_BASE_URL and INSTANA_API_TOKEN in .env');
  }
}

// ─── Call an MCP tool ──────────────────────────────────────────────────────
async function callMCPTool(toolName, toolInput) {
  if (!mcpClient) throw new Error('MCP client not connected');
  const result = await mcpClient.callTool({ name: toolName, arguments: toolInput });
  return result.content?.[0]?.text ?? JSON.stringify(result);
}

// ─── Stage 1: Instana Assistant (Telemetry Retrieval via MCP) ─────────────
// Helper to test if an event belongs to a target application or its services
function isEventForApplication(ev, appName, knownServiceNames = new Set()) {
  if (!ev) return false;
  const appClean = (appName || '').trim().toLowerCase();
  const appWords = appClean.replace(/application|app/g, '').trim().split(/\s+/).filter((w) => w.length > 2);

  const searchStrings = [];
  if (ev.applicationName) searchStrings.push(String(ev.applicationName));
  if (ev.application?.name) searchStrings.push(String(ev.application.name));
  if (ev.entityLabel) searchStrings.push(String(ev.entityLabel));
  if (ev.entityName) searchStrings.push(String(ev.entityName));
  if (ev.problem) searchStrings.push(String(ev.problem));
  if (ev.text) searchStrings.push(String(ev.text));
  if (ev.title) searchStrings.push(String(ev.title));
  if (ev.description) searchStrings.push(String(ev.description));
  if (ev.serviceName) searchStrings.push(String(ev.serviceName));

  if (Array.isArray(ev.affectedEntities)) {
    for (const ent of ev.affectedEntities) {
      if (ent.label) searchStrings.push(String(ent.label));
      if (ent.name) searchStrings.push(String(ent.name));
      if (ent.type) searchStrings.push(String(ent.type));
    }
  }

  const combined = searchStrings.join(' ').toLowerCase();

  // 1. Direct match on full application name
  if (combined.includes(appClean)) return true;

  // 2. Keyword match (e.g. "retail")
  for (const word of appWords) {
    if (combined.includes(word)) return true;
  }

  // 3. Match against known microservice names belonging to this application
  for (const svc of knownServiceNames) {
    if (!svc) continue;
    const svcLower = String(svc).trim().toLowerCase();
    if (svcLower.length > 2 && combined.includes(svcLower)) return true;
  }

  return false;
}

// ─── Stage 1: Instana Assistant (Telemetry Retrieval via MCP) ─────────────
async function runAgentLoop(userPrompt, conversationHistory = []) {
  const systemPrompt = `You are the Instana Assistant. You have access to Instana MCP tools to query live APM metrics, service calls, error rates, latencies, traces, and open incidents EXCLUSIVELY for "${RETAIL_APP_NAME}".

When the user asks a question about application health, incidents, or performance:
1. **Query Instana via MCP Tools (Strictly Scoped to ${RETAIL_APP_NAME})**:
   - For application metrics (get_grouped_calls_metrics), ALWAYS scope using:
     tag_filter_expression: { type: 'TAG_FILTER', name: 'application.name', operator: 'EQUALS', entity: 'DESTINATION', value: '${RETAIL_APP_NAME}' }
     group: { groupbyTag: 'service.name', groupbyTagEntity: 'DESTINATION' }
   - For events / incidents (get_events), ONLY consider and report events that explicitly belong to "${RETAIL_APP_NAME}" or its constituent microservices/components. Completely ignore and omit any events or incidents from other applications, hosts, or foreign services.

2. **Present a Clean Observability Report for "${RETAIL_APP_NAME}"**:
   - Provide a clear, well-structured response with markdown tables summarizing services, call volumes, error rates, and latencies.
   - Highlight open incidents or warnings for "${RETAIL_APP_NAME}" clearly.

3. **Status Tag (MANDATORY)**:
   - At the very end of your response, on a new line, output a hidden status JSON tag:
   <!--STATUS:{"hasCriticalIssues":true|false,"severity":"critical"|"warning"|"healthy","summary":"Brief description of critical issue if any"}-->
   - Mark hasCriticalIssues: true if ${RETAIL_APP_NAME} error rate ≥ 5%, severe latency spike, or critical incidents for ${RETAIL_APP_NAME} are present.

Current Instana environment: ${process.env.INSTANA_BASE_URL || 'configured via env'}
Primary monitored application: ${RETAIL_APP_NAME}`;

  // Strip any stale system messages from incoming history (they're re-added fresh each turn)
  const cleanHistory = conversationHistory.filter((m) => m.role !== 'system');

  // System prompt goes as first message (OpenAI style, not Anthropic top-level field)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory,
    { role: 'user', content: userPrompt },
  ];

  let response;
  let iterations = 0;
  const MAX_ITERATIONS = 10;
  const toolCallsSummary = [];

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    response = await bobClient.chat.completions.create({
      model: BOB_MODEL,
      max_tokens: 8096,
      tools: mcpTools.length > 0 ? mcpTools : undefined,
      tool_choice: mcpTools.length > 0 ? 'auto' : undefined,
      messages,
    });

    const choice = response.choices[0];

    // No tool use — final answer
    if (choice.finish_reason === 'stop' || choice.finish_reason === 'end_turn') {
      break;
    }

    // Handle tool calls
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      // Add assistant message with tool calls
      messages.push(choice.message);

      // Execute each tool and collect results
      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments || '{}');

        toolCallsSummary.push({ tool: toolName, input: toolInput });

        let toolResult;
        try {
          toolResult = await callMCPTool(toolName, toolInput);
        } catch (err) {
          toolResult = `Error calling tool ${toolName}: ${err.message}`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
      continue;
    }

    break;
  }

  const rawText = response.choices[0].message?.content ?? '';

  // Extract hidden STATUS marker
  let criticalIssue = { detected: false, severity: 'healthy', summary: '' };
  let cleanAnswer = rawText;
  const statusMatch = rawText.match(/<!--STATUS:(\{.*?\})-->/s);
  if (statusMatch) {
    try {
      const parsed = JSON.parse(statusMatch[1]);
      const isCrit = parsed.hasCriticalIssues === true || parsed.severity === 'critical';
      criticalIssue = {
        detected: isCrit,
        severity: parsed.severity || (isCrit ? 'critical' : 'healthy'),
        summary: parsed.summary || parsed.issueSummary || '',
      };
      cleanAnswer = rawText.replace(/<!--STATUS:(\{.*?\})-->/s, '').trim();
    } catch {}
  }

  // Fallback heuristic check if marker was missed
  if (!criticalIssue.detected) {
    if (/critical|🔴|erroneous|high error rate|incident/i.test(cleanAnswer) && /(?:error rate.*?([5-9]|\d{2,})\%|incident open)/i.test(cleanAnswer)) {
      criticalIssue = {
        detected: true,
        severity: 'critical',
        summary: 'Elevated error rates or active incidents detected in Retail Application',
      };
    }
  }

  // Build a clean conversation history for the next turn.
  const cleanedHistory = [
    ...messages.filter((m) => {
      if (m.role === 'system') return false;
      if (m.role === 'tool') return false;
      if (m.role === 'assistant' && m.tool_calls?.length) return false;
      return true;
    }),
    { role: 'assistant', content: cleanAnswer },
  ];

  return {
    answer: cleanAnswer,
    toolCalls: toolCallsSummary,
    iterations,
    conversationHistory: cleanedHistory,
    criticalIssue,
  };
}

// ─── Stage 2: Headless Bob Autonomous SRE RCA & Remediation Generator ──────
async function runHeadlessBobRCA(prompt, instanaReport, issueSummary) {
  // If a HeadlessBob instance is actively registered, forward to HeadlessBob thread
  const hbBase = sanitizeHBobBaseUrl(hbobUrl);
  if (hbBase) {
    try {
      const hbHdrs = { 'Content-Type': 'application/json',
                       ...(hbobToken ? { Authorization: `Bearer ${hbobToken}` } : {}) };

      if (!hbobThread || !isValidId(hbobThread)) {
        const threadEndpoint = new URL('/api/v1/threads', hbBase).href;
        const tr = await fetch(threadEndpoint, {
          method: 'POST', headers: hbHdrs,
          body: JSON.stringify({ title: `RCA — ${RETAIL_APP_NAME}` }),
        });
        if (tr.ok) {
          const threadData = await tr.json();
          if (isValidId(threadData?.id)) hbobThread = threadData.id;
        }
      }

      if (hbobThread && isValidId(hbobThread)) {
        const rcaPrompt = `A critical issue was identified during health assessment: "${issueSummary}".
User query: "${prompt}"
Telemetry from Instana:
${instanaReport}

Please perform an in-depth SRE Root Cause Analysis (RCA) and generate a comprehensive diagnostic report formatted with:
- 📊 **Executive Summary**
- 🔍 **Root Cause Analysis (RCA)** (technical failure mechanism, affected endpoints, dependency chain)
- 📉 **Impact Assessment** (blast radius, affected transactions)
- 🛠️ **Remediation & Step-by-Step Fixes** (immediate mitigation, code/config fixes, preventive measures)`;

        const msgEndpoint = new URL(`/api/v1/threads/${encodeURIComponent(hbobThread)}/messages`, hbBase).href;
        const mr = await fetch(msgEndpoint, {
          method: 'POST', headers: hbHdrs,
          body: JSON.stringify({ content: rcaPrompt }),
        });

        if (mr.ok) {
          const { run_id } = await mr.json();
          if (isValidId(run_id)) {
            const deadline = Date.now() + 120_000;
            while (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, 2000));
              const runEndpoint = new URL(`/api/v1/runs/${encodeURIComponent(run_id)}`, hbBase).href;
              const pr = await fetch(runEndpoint, { headers: hbHdrs });
              if (!pr.ok) break;
              const run = await pr.json();
              if (['completed', 'failed', 'cancelled'].includes(run.status)) {
                if (run.status === 'completed' && run.output) {
                  return { rca: run.output, source: 'headlessbob' };
                }
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[HeadlessBob RCA] Forwarding error:', e.message);
    }
  }

  // Direct SRE Agent Fallback via Bob client
  const rcaSystemPrompt = `You are Headless Bob, an autonomous Site Reliability Engineering (SRE) diagnostic agent.
A critical anomaly has been detected in "${RETAIL_APP_NAME}".

Generate a structured, professional SRE Root Cause Analysis and Remediation Report:
1. 📊 **Executive Summary**: Core failure summary with severity (🔴 CRITICAL).
2. 🔍 **Root Cause Analysis (RCA)**: Deep technical explanation of the failure mechanism, erroneous endpoints, and downstream database/service cascade.
3. 📉 **Impact Assessment**: Blast radius on users, checkout flows, and dependent microservices.
4. 🛠️ **Remediation & Step-by-Step Fixes**: Concrete, prioritized mitigation steps (e.g. database pool resizing, circuit breakers, code patches, rollback).`;

  const rcaUserPrompt = `Context from Instana Assistant Telemetry:
${instanaReport}

Identified Issue:
${issueSummary}

Provide the complete SRE Root Cause Analysis and Remediation Action Plan.`;

  const resp = await bobClient.chat.completions.create({
    model: BOB_MODEL,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: rcaSystemPrompt },
      { role: 'user', content: rcaUserPrompt },
    ],
  });

  return {
    rca: resp.choices[0]?.message?.content ?? '',
    source: 'headlessbob',
  };
}

// ─── Proactive Monitor ────────────────────────────────────────────────────
// When Headless Bob is registered, Bob owns the entire monitoring loop:
//   every POLL_INTERVAL_MS we send Bob a standing health-check instruction
//   and he calls the Instana MCP tools himself to decide what to report.
//   No pre-fetching, no threshold logic here — that's Bob's job.
//
// Without Headless Bob, falls back to direct inference API + our own
// Instana MCP calls (legacy path, kept for graceful degradation).

const POLL_INTERVAL_MS = 60_000;
let monitorTimer   = null;
let monitorRunning = false;
const sseClients   = new Set();

// Headless Bob registration — set by POST /api/monitor/register from the UI
let hbobUrl    = null;  // e.g. "http://127.0.0.1:8000"
let hbobToken  = null;  // Bearer token (may be null for unauthenticated local)
let hbobThread = null;  // dedicated monitor thread, reused across checks

// ── The standing prompt Bob receives every cycle ──────────────────────────
// Bob has the Instana MCP tools — he decides what to query and what to report.
const BOB_MONITOR_PROMPT = (appName) =>
`You are an autonomous health monitor EXCLUSIVELY for the "${appName}" application running in Instana.

Your job every cycle:
1. Query live metrics strictly for "${appName}":
   - Call manage_applications (resource_type="metrics", operation="get_grouped_calls_metrics") with:
     tag_filter_expression: { type: "TAG_FILTER", name: "application.name", operator: "EQUALS", entity: "DESTINATION", value: "${appName}" }
     group: { groupbyTag: "service.name", groupbyTagEntity: "DESTINATION" }
     time_frame: { windowSize: 300000 }
     include_internal: false, include_synthetic: false
     metrics: [{ metric: "calls", aggregation: "SUM" }, { metric: "erroneousCalls", aggregation: "SUM" }, { metric: "latency", aggregation: "P90" }]
2. Query open events and incidents:
   - Call manage_events (operation="get_events") with filters: { time_range: "last 5 minutes", event_type_filters: ["INCIDENT", "ISSUE"], state: "open" }
   - CRITICAL APPLICATION SCOPING: ONLY analyze incidents and issues that belong directly to "${appName}" or its microservices (such as shipping-service, payment-service, order-service, catalog-service, cart-service, etc.).
   - YOU MUST COMPLETELY IGNORE all incidents, issues, or alerts for any other applications, foreign microservices, or unrelated infrastructure in the Instana tenant.
3. Analyse what you find for "${appName}":
   - If "${appName}" error rate ≥ 10% OR P90 latency ≥ 3000ms OR open critical incidents exist for "${appName}" → severity: CRITICAL 🔴
   - If "${appName}" error rate ≥ 3% OR P90 latency ≥ 1500ms OR open warning incidents exist for "${appName}" → severity: WARNING 🟡
   - Otherwise → report health as OK ✅ for "${appName}" in one sentence and stop.

If severity is CRITICAL or WARNING:
- Clearly state that this alert is for "${appName}".
- Output a concise alert (max 200 words):
  - Severity badge: 🔴 CRITICAL or 🟡 WARNING
  - What is wrong: specific metric values and affected service(s) within ${appName}
  - Likely impact on ${appName} users and business
  - Immediate recommended action

Always end your response with a machine-readable JSON block on its own line:
{"severity":"critical"|"warning"|"ok","errorRate":<number|null>,"p90Latency":<number|null>,"hasIncidents":<boolean>}`;

// ── Broadcast helper ──────────────────────────────────────────────────────
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    try { res.write(data); } catch { sseClients.delete(res); }
  }
}

// ── Extract the trailing JSON sentinel Bob appends ────────────────────────
function parseBobSentinel(text) {
  const match = text.match(/\{[^{}]*"severity"\s*:\s*"[^"]*"[^{}]*\}\s*$/m);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ── One monitoring cycle ──────────────────────────────────────────────────
async function runMonitorCheck() {
  broadcast({ type: 'check_start', ts: Date.now() });

  // ── PATH A: Headless Bob owns the check ──────────────────────────────────
  const hbBase = sanitizeHBobBaseUrl(hbobUrl);
  if (hbBase) {
    try {
      const hbHdrs = { 'Content-Type': 'application/json',
                       ...(hbobToken ? { Authorization: `Bearer ${hbobToken}` } : {}) };

      // Lazily create a dedicated monitor thread
      if (!hbobThread || !isValidId(hbobThread)) {
        const threadEndpoint = new URL('/api/v1/threads', hbBase).href;
        const tr = await fetch(threadEndpoint, {
          method: 'POST', headers: hbHdrs,
          body: JSON.stringify({ title: `${RETAIL_APP_NAME} — Auto Monitor` }),
        });
        if (!tr.ok) throw new Error(`thread create failed: ${tr.status}`);
        const threadData = await tr.json();
        if (isValidId(threadData?.id)) {
          hbobThread = threadData.id;
          console.log('[Monitor] Headless Bob monitor thread:', hbobThread);
        }
      }

      if (hbobThread && isValidId(hbobThread)) {
        // Send the standing health-check prompt — Bob calls Instana tools himself
        const msgEndpoint = new URL(`/api/v1/threads/${encodeURIComponent(hbobThread)}/messages`, hbBase).href;
        const mr = await fetch(msgEndpoint, {
          method: 'POST', headers: hbHdrs,
          body: JSON.stringify({ content: BOB_MONITOR_PROMPT(RETAIL_APP_NAME) }),
        });
        if (!mr.ok) throw new Error(`message POST failed: ${mr.status}`);
        const { run_id } = await mr.json();

        if (isValidId(run_id)) {
          broadcast({ type: 'bob_running', ts: Date.now(), run_id });

          // Poll until Bob completes (max 3 min)
          const deadline = Date.now() + 180_000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 3000));
            const runEndpoint = new URL(`/api/v1/runs/${encodeURIComponent(run_id)}`, hbBase).href;
            const pr = await fetch(runEndpoint, { headers: hbHdrs });
            if (!pr.ok) break;
            const run = await pr.json();
            if (!['completed', 'failed', 'cancelled'].includes(run.status)) continue;

            if (run.status !== 'completed' || !run.output) break;

            // Parse Bob's sentinel to extract structured fields
            const sentinel = parseBobSentinel(run.output);
            const severity  = sentinel?.severity  ?? 'ok';
            const errorRate  = sentinel?.errorRate  ?? null;
            const p90Latency = sentinel?.p90Latency ?? null;

            broadcast({
              type:     severity === 'ok' ? 'status_tick' : 'alert',
              ts:       Date.now(),
              severity,
              errorRate,
              p90Latency,
              hasOpenIncidents: sentinel?.hasIncidents ?? false,
              message:  run.output,
              source:   'headlessbob',
            });
            return; // done for this cycle
          }
        }
      }
    } catch (hbErr) {
      console.error('[Monitor] Headless Bob check failed:', hbErr.message, '— falling back');
      // fall through to PATH B
    }
  }

  // ── PATH B: Fallback — bridge fetches Instana, inference API analyses ─────
  if (!mcpClient) {
    broadcast({ type: 'monitor_error', ts: Date.now(), message: 'MCP not connected and no Headless Bob registered' });
    return;
  }
  try {
    const [eventsResult, metricsResult] = await Promise.all([
      callMCPTool('manage_events', {
        operation: 'get_events',
        params: { filters: { time_range: 'last 5 minutes', event_type_filters: ['INCIDENT', 'ISSUE'], state: 'open' } },
      }),
      callMCPTool('manage_applications', {
        resource_type: 'metrics',
        operation: 'get_grouped_calls_metrics',
        params: {
          metrics: [
            { metric: 'calls', aggregation: 'SUM' },
            { metric: 'erroneousCalls', aggregation: 'SUM' },
            { metric: 'latency', aggregation: 'P90' },
          ],
          tag_filter_expression: { type: 'TAG_FILTER', name: 'application.name', operator: 'EQUALS', entity: 'DESTINATION', value: RETAIL_APP_NAME },
          group: { groupbyTag: 'service.name', groupbyTagEntity: 'DESTINATION' },
          time_frame: { windowSize: 300_000 },
          include_internal: false, include_synthetic: false,
        },
      }),
    ]);

    // Parse metrics and discover Retail Application services
    let errorRate = null, p90Latency = null;
    const knownServiceNames = new Set();
    try {
      const m = typeof metricsResult === 'string' ? JSON.parse(metricsResult) : metricsResult;
      const inner = m?.results ?? m;
      const items = Array.isArray(inner) ? inner : inner?.items ?? inner?.data ?? [];
      if (items.length > 0) {
        items.forEach((item) => {
          const sName = item.name ?? item.label ?? item.groupByFields?.['service.name'] ?? item.tags?.['service.name'] ?? item.groupByTag;
          if (sName) knownServiceNames.add(sName.toLowerCase());
        });
        const calls = items.reduce((s, x) => s + (Array.isArray(x.metrics?.['calls.sum']) ? x.metrics['calls.sum'].reduce((a, p) => a + (p?.[1] ?? 0), 0) : 0), 0);
        const errs  = items.reduce((s, x) => s + (Array.isArray(x.metrics?.['erroneousCalls.sum']) ? x.metrics['erroneousCalls.sum'].reduce((a, p) => a + (p?.[1] ?? 0), 0) : 0), 0);
        errorRate  = calls > 0 ? (errs / calls) * 100 : 0;
        const latArr = items[0]?.metrics?.['latency.p90'] ?? items[0]?.metrics?.['latency.P90'];
        if (Array.isArray(latArr) && latArr.length) p90Latency = latArr[latArr.length - 1]?.[1] ?? null;
      }
    } catch { /* best-effort */ }

    // Filter open incidents strictly for Retail Application
    const hasOpenIncidents = (() => {
      try {
        const e = typeof eventsResult === 'string' ? JSON.parse(eventsResult) : eventsResult;
        const rawEvents = Array.isArray(e) ? e : e?.results?.events ?? e?.events ?? e?.items ?? [];
        const appEvents = rawEvents.filter((ev) => isEventForApplication(ev, RETAIL_APP_NAME, knownServiceNames));
        return appEvents.some((ev) => ev.type === 'INCIDENT' || ev.severity === 10);
      } catch {
        return false;
      }
    })();

    const severity =
      (errorRate >= 10 || p90Latency >= 3000 || hasOpenIncidents) ? 'critical' :
      (errorRate >=  3 || p90Latency >= 1500)                     ? 'warning'  : 'ok';

    broadcast({ type: 'status_tick', ts: Date.now(), severity, errorRate: errorRate !== null ? +errorRate.toFixed(2) : null, p90Latency });

    if (severity !== 'ok') {
      const prompt =
`You are monitoring the ${RETAIL_APP_NAME} application in Instana. A health check just detected:
- Error Rate (last 5 min): ${errorRate !== null ? errorRate.toFixed(2) + '%' : 'unknown'}
- P90 Latency: ${p90Latency !== null ? p90Latency + ' ms' : 'unknown'}
- Open Incidents/Issues: ${hasOpenIncidents ? 'YES' : 'none'}
- Severity: ${severity.toUpperCase()}

Provide a concise alert (max 200 words): 1) what is wrong 2) likely impact 3) immediate action.
Use 🔴 for critical, 🟡 for warning.`;

      let alertMessage;
      try { alertMessage = (await runAgentLoop(prompt, [])).answer; }
      catch (e) { alertMessage = `⚠ Analysis unavailable: ${e.message}`; }

      broadcast({ type: 'alert', ts: Date.now(), severity, errorRate: errorRate !== null ? +errorRate.toFixed(2) : null, p90Latency, hasOpenIncidents, message: alertMessage, source: 'inference' });
    }
  } catch (err) {
    console.error('[Monitor] Fallback check failed:', err.message);
    broadcast({ type: 'monitor_error', ts: Date.now(), message: err.message });
  }
}

// ─── Monitor control routes ───────────────────────────────────────────────

app.get('/api/monitor/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected', running: monitorRunning, ts: Date.now() })}\n\n`);
  sseClients.add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 20_000);
  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

function sanitizeHBobBaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const hostname = parsed.hostname.toLowerCase();
    // Disallow cloud metadata endpoints & link-local addresses
    if (hostname === '169.254.169.254' || hostname.startsWith('169.254.')) return null;
    
    // Allow localhost/loopback or pre-configured trusted hosts
    const configuredHosts = process.env.ALLOWED_HBOB_HOSTS
      ? process.env.ALLOWED_HBOB_HOSTS.split(',').map((h) => h.trim())
      : [];
    const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0', ...configuredHosts]);
    if (!allowedHosts.has(hostname)) return null;

    const port = parsed.port ? `:${parsed.port}` : '';
    return `${parsed.protocol}//${hostname}${port}`;
  } catch {
    return null;
  }
}

function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(id);
}

app.post('/api/monitor/register', (req, res) => {
  const { url, token } = req.body ?? {};
  if (!url) return res.status(400).json({ error: 'url is required' });
  const safeUrl = sanitizeHBobBaseUrl(url);
  if (!safeUrl) {
    return res.status(400).json({ error: 'Invalid registration URL: target host is not authorized or uses an invalid protocol.' });
  }
  hbobUrl   = safeUrl;
  hbobToken = token || null;
  hbobThread = null;
  console.log('[Monitor] Headless Bob registered for auto-monitor:', hbobUrl);
  res.json({ registered: true, url: hbobUrl });
});

app.delete('/api/monitor/register', (req, res) => {
  hbobUrl = hbobToken = hbobThread = null;
  console.log('[Monitor] Headless Bob deregistered');
  res.json({ registered: false });
});

app.post('/api/monitor/start', (req, res) => {
  if (monitorRunning) return res.json({ running: true, message: 'Already running' });
  monitorRunning = true;
  runMonitorCheck();
  monitorTimer = setInterval(runMonitorCheck, POLL_INTERVAL_MS);
  broadcast({ type: 'monitor_started', ts: Date.now(), intervalMs: POLL_INTERVAL_MS });
  console.log('[Monitor] Started — Bob owns monitoring every', POLL_INTERVAL_MS / 1000, 's');
  res.json({ running: true, intervalMs: POLL_INTERVAL_MS });
});

// ─── Insights endpoint with In-Memory Cache & Stale Fallback ──────────────
// Returns live KPI data directly from Instana MCP — no LLM overhead.
const insightsCache = new Map(); // windowSize -> { data, ts }
const INSIGHTS_CACHE_TTL_MS = 30_000; // 30 seconds fresh cache

app.get('/api/insights', async (req, res) => {
  if (!mcpClient) return res.status(503).json({ error: 'MCP not connected' });

  const windowSize = parseInt(req.query.window ?? '3600000', 10); // default 1 hour
  const force = req.query.force === 'true';

  // Return fresh cache if available and not forced
  const cached = insightsCache.get(windowSize);
  if (!force && cached && (Date.now() - cached.ts < INSIGHTS_CACHE_TTL_MS)) {
    return res.json({ ...cached.data, cached: true });
  }

  try {
    // Run application metrics and open events calls in parallel (2 targeted calls)
    const [metricsRaw, eventsRaw] = await Promise.allSettled([
      // 1. Application metrics: calls, errors, latency per service
      callMCPTool('manage_applications', {
        resource_type: 'metrics',
        operation: 'get_grouped_calls_metrics',
        params: {
          metrics: [
            { metric: 'calls',          aggregation: 'SUM'  },
            { metric: 'erroneousCalls', aggregation: 'SUM'  },
            { metric: 'latency',        aggregation: 'P90'  },
            { metric: 'latency',        aggregation: 'MEAN' },
          ],
          tag_filter_expression: {
            type: 'TAG_FILTER', name: 'application.name',
            operator: 'EQUALS', entity: 'DESTINATION',
            value: RETAIL_APP_NAME,
          },
          group:      { groupbyTag: 'service.name', groupbyTagEntity: 'DESTINATION' },
          time_frame: { windowSize },
          order:      { by: 'calls', direction: 'DESC' },
          pagination: { page: 1, pageSize: 10 },
          include_internal:  false,
          include_synthetic: false,
        },
      }),
      // 2. Open events
      callMCPTool('manage_events', {
        operation: 'get_events',
        params: {
          filters: {
            time_range: `last ${Math.round(windowSize / 60000)} minutes`,
            event_type_filters: ['INCIDENT', 'ISSUE'],
            state: 'open',
          },
        },
      }),
    ]);

    // ── Parse helpers ──
    function unwrap(settled) {
      if (!settled || settled.status !== 'fulfilled') return null;
      const raw = settled.value;
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const inner = parsed?.results ?? parsed;
        if (inner?.elicitation_needed) {
          console.warn('[Insights] elicitation_needed from MCP:', inner.message, '| missing:', inner.missing_parameters);
          return null;
        }
        return inner;
      } catch { return null; }
    }

    // Check for rate limit
    const isRateLimited = (r) => {
      const s = String(r?.reason ?? r?.value ?? '');
      return s.toLowerCase().includes('rate limit') || s.includes('"429"') || s.includes("'429'");
    };
    const metricsRateLimited = isRateLimited(metricsRaw) || isRateLimited(eventsRaw);

    if (metricsRateLimited) {
      const errStr = String(metricsRaw.reason ?? metricsRaw.value ?? eventsRaw.reason ?? eventsRaw.value ?? '');
      const resetMatch = errStr.match(/X-RateLimit-Reset.*?'(\d{10})'/)
        ?? errStr.match(/RateLimit-Reset.*?(\d{10})/)
        ?? errStr.match(/\b(179\d{7})\b/);
      const resetTs = resetMatch ? parseInt(resetMatch[1], 10) : Math.floor(Date.now() / 1000) + 1800;

      // 1. If we have a previously cached live snapshot, serve it gracefully
      if (cached?.data) {
        return res.json({
          ...cached.data,
          isStale: true,
          rateLimited: true,
          resetTs,
          notice: 'Instana API rate limit active. Showing cached telemetry snapshot.',
        });
      }

      // 2. No cached snapshot: report "unavailable" explicitly. Never fabricate telemetry.
      //    The unavailable payload is deliberately NOT cached.
      return res.json({
        ts: Date.now(),
        windowSize,
        unavailable: true,
        isStale: false,
        rateLimited: true,
        resetTs,
        notice: `Instana API rate limit active on tenant (resets in ${Math.max(1, resetTs - Math.floor(Date.now() / 1000))}s). No cached telemetry is available yet.`,
        summary: null,
        services: [],
        incidents: [],
        issues: [],
      });
    }

    // ── Parse metrics ──
    let services = [];
    let totalCalls = 0, totalErrors = 0;
    try {
      const m = unwrap(metricsRaw);
      const items = Array.isArray(m)
        ? m
        : m?.items ?? m?.data ?? m?.results?.items ?? m?.results?.data
        ?? (Array.isArray(m?.results) ? m.results : []);

      services = items.map((item) => {
        const metricVal = (...keys) => {
          for (const k of keys) {
            const series = item.metrics?.[k];
            if (Array.isArray(series) && series.length > 0) {
              const total = series.reduce((acc, pt) => acc + (Number(pt?.[1]) || 0), 0);
              if (total > 0) return total;
            }
          }
          for (const k of keys) {
            const v = item.metrics_extracted?.[k]?.value;
            if (v != null && v > 0) return v;
          }
          return null;
        };
        const calls  = metricVal('calls.sum',          'calls.SUM',          'calls')          ?? 0;
        const errors = metricVal('erroneousCalls.sum', 'erroneousCalls.SUM', 'erroneousCalls') ?? 0;
        const p90  = metricVal('latency.p90',  'latency.P90',  'latency');
        const mean = metricVal('latency.mean', 'latency.MEAN');
        totalCalls  += calls;
        totalErrors += errors;
        const name = item.name
          ?? item.label
          ?? item.groupByFields?.['service.name']
          ?? item.tags?.['service.name']
          ?? item.groupByTag
          ?? 'Unknown';
        return {
          name,
          calls:     Math.round(calls),
          errors:    Math.round(errors),
          errorRate: calls > 0 ? +((errors / calls) * 100).toFixed(2) : 0,
          p90:       p90  != null ? Math.round(p90)  : null,
          mean:      mean != null ? Math.round(mean) : null,
        };
      });
    } catch (e) {
      console.error('[Insights] metrics parse error:', e.message);
    }

    // ── Parse events (Filtered specifically for Retail Application) ──
    let openIncidents = [], openIssues = [];
    try {
      const knownServiceNames = new Set(services.map((s) => s.name.toLowerCase()));
      const ev = unwrap(eventsRaw);
      const rawEvents = Array.isArray(ev)
        ? ev
        : ev?.events ?? ev?.items ?? ev?.data
        ?? (Array.isArray(ev?.results) ? ev.results : []);

      // Filter events strictly for Retail Application and its services
      const appEvents = rawEvents.filter((e) => isEventForApplication(e, RETAIL_APP_NAME, knownServiceNames));

      openIncidents = appEvents.filter((e) => e.type === 'INCIDENT' || e.severity === 10);
      openIssues    = appEvents.filter((e) => e.type === 'ISSUE'    || e.severity === 5);
    } catch (e) {
      console.error('[Insights] events parse error:', e.message);
    }

    const overallErrorRate = totalCalls > 0 ? +((totalErrors / totalCalls) * 100).toFixed(2) : 0;
    const topP90 = services.length > 0
      ? Math.max(...services.map((s) => s.p90 ?? 0))
      : null;

    const responsePayload = {
      ts: Date.now(),
      windowSize,
      summary: {
        totalCalls:       Math.round(totalCalls),
        totalErrors:      Math.round(totalErrors),
        overallErrorRate,
        topP90,
        openIncidents:    openIncidents.length,
        openIssues:       openIssues.length,
      },
      services,
      incidents: openIncidents.slice(0, 5).map((ev) => ({
        id:       ev.id,
        title:    ev.problem ?? ev.text ?? ev.title ?? 'Incident',
        severity: ev.severity === 10 ? 'critical' : ev.severity === 5 ? 'warning' : 'info',
        entity:   ev.affectedEntities?.[0]?.label ?? ev.entityLabel ?? '',
        start:    ev.start ?? ev.startTime,
      })),
      issues: openIssues.slice(0, 5).map((ev) => ({
        id:       ev.id,
        title:    ev.problem ?? ev.text ?? ev.title ?? 'Issue',
        severity: ev.severity === 10 ? 'critical' : ev.severity === 5 ? 'warning' : 'info',
        entity:   ev.affectedEntities?.[0]?.label ?? ev.entityLabel ?? '',
        start:    ev.start ?? ev.startTime,
      })),
    };

    // Cache the good response
    insightsCache.set(windowSize, { data: responsePayload, ts: Date.now() });

    res.json(responsePayload);
  } catch (err) {
    console.error('[Insights] Error:', err.message);
    if (cached?.data) {
      return res.json({ ...cached.data, isStale: true });
    }
    res.status(500).json({ error: err.message });
  }
});
// ─── Infrastructure Digital Twin (live, from Instana MCP) ───────────────────
// Builds a Kubernetes/OpenShift topology from Instana `kubernetesNode` and
// `kubernetesPod` entities via manage_infrastructure. Nothing is simulated:
// a value Instana does not return is `null` and the UI renders it as "n/a".
//
// Metric scale (verified against the tenant): *_percentage and *UsageTo*Ratio
// values are fractions (0..1+); they are multiplied by 100 here.
// NOTE: required_cpu_percentage / required_mem_percentage are *requests vs
// allocatable capacity*, not live utilisation.
const infraCache    = new Map(); // `${cluster}|${window}` -> { data, ts }
const INFRA_CACHE_TTL_MS = 30_000;
let   clusterListCache   = null; // { clusters, truncated, ts }
const CLUSTER_LIST_TTL_MS = 5 * 60_000;
const INFRA_GRANULARITY   = 300_000;
const INFRA_K8S_CLUSTER   = (process.env.INSTANA_K8S_CLUSTER || '').trim();

class InstanaRateLimitError extends Error {
  constructor(resetTs) { super('Instana API rate limit'); this.rateLimited = true; this.resetTs = resetTs; }
}

function extractResetTs(text) {
  const m = String(text).match(/X-RateLimit-Reset.*?'(\d{10})'/)
    ?? String(text).match(/RateLimit-Reset.*?(\d{10})/);
  return m ? parseInt(m[1], 10) : Math.floor(Date.now() / 1000) + 300;
}

function looksRateLimited(text) {
  const s = String(text).toLowerCase();
  return s.includes('rate limit') || s.includes('"429"') || s.includes("'429'");
}

// Call an MCP tool and return the parsed `results` object.
// Throws InstanaRateLimitError on rate limits and Error on MCP/tool errors.
async function mcpJson(toolName, args) {
  let raw;
  try {
    raw = await callMCPTool(toolName, args);
  } catch (err) {
    if (looksRateLimited(err.message)) throw new InstanaRateLimitError(extractResetTs(err.message));
    throw err;
  }
  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { if (looksRateLimited(raw)) throw new InstanaRateLimitError(extractResetTs(raw)); throw new Error('Unparseable MCP response'); }
  const inner = parsed?.results ?? parsed;
  if (inner?.elicitation_needed) throw new Error(`MCP elicitation needed: ${inner.message}`);
  if (inner?.error) {
    if (looksRateLimited(inner.error)) throw new InstanaRateLimitError(extractResetTs(inner.error));
    throw new Error(String(inner.error).slice(0, 300));
  }
  return inner;
}

// Latest non-null datapoint of "<metric>.<AGG>.<granularity>".
function latestMetric(metrics, base, agg = 'MAX') {
  if (!metrics) return null;
  const key = Object.keys(metrics).find((k) => k.startsWith(`${base}.${agg}.`));
  const series = key ? metrics[key] : null;
  if (!Array.isArray(series)) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    const v = series[i]?.[1];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

const pct = (v) => (v == null ? null : Math.round(v * 100));
const SEV_RANK = { ok: 0, warning: 1, critical: 2 };
const worseOf = (a, b) => (SEV_RANK[a] >= SEV_RANK[b] ? a : b);

function severityFromInstana(n) {
  if (n >= 10) return 'critical';
  if (n >= 5)  return 'warning';
  return 'ok';
}

function podSeverity(p) {
  if ((p.restartsDelta ?? 0) >= 3 || (p.memToLimitPct ?? 0) >= 95 || (p.cpuToLimitPct ?? 0) >= 95) return 'critical';
  if ((p.restartsDelta ?? 0) >= 1 || (p.restarts ?? 0) >= 1 || (p.memToLimitPct ?? 0) >= 80 || (p.cpuToLimitPct ?? 0) >= 80) return 'warning';
  return 'ok';
}

async function fetchClusterList() {
  if (clusterListCache && Date.now() - clusterListCache.ts < CLUSTER_LIST_TTL_MS) return clusterListCache;
  const r = await mcpJson('manage_infrastructure', {
    resource_type: 'analyze',
    operation: 'get_entity_groups',
    params: { payload: {
      type: 'kubernetesNode',
      groupBy: ['kubernetes.cluster.name'],
      metrics: [{ metric: 'required_cpu_percentage', granularity: INFRA_GRANULARITY, aggregation: 'MAX' }],
      timeFrame: { windowSize: 900_000 },
      tagFilterExpression: { type: 'EXPRESSION', logicalOperator: 'AND', elements: [] },
      pagination: { retrievalSize: 100 },
    } },
  });
  const items = r?.items ?? [];
  const clusters = items
    .map((it) => ({
      name: it.tags?.['kubernetes.cluster.name'] ?? null,
      nodesCount: it.count ?? null,
      cpuRequestedPct: pct(latestMetric(it.metrics, 'required_cpu_percentage')),
    }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  clusterListCache = { clusters, truncated: (r?.totalHits ?? items.length) > items.length, ts: Date.now() };
  return clusterListCache;
}

async function buildDigitalTwin(clusterName, windowSize) {
  const clusterFilter = {
    type: 'TAG_FILTER', entity: 'NOT_APPLICABLE',
    name: 'kubernetes.cluster.name', operator: 'EQUALS', value: clusterName,
  };
  const timeFrame = { windowSize };
  const g = INFRA_GRANULARITY;
  const m = (metric) => ({ metric, granularity: g, aggregation: 'MAX' });

  // 1. Node metrics + Instana entity health (open issues)
  const nodesRes = await mcpJson('manage_infrastructure', {
    resource_type: 'analyze', operation: 'get_entities',
    params: { payload: {
      type: 'kubernetesNode',
      // The MCP tool allows at most 5 metrics per call.
      metrics: ['required_cpu_percentage', 'required_mem_percentage', 'limit_cpu_percentage',
        'alloc_pods_percentage', 'allocatedPods'].map(m),
      timeFrame, tagFilterExpression: clusterFilter, pagination: { retrievalSize: 100 },
    } },
  });

  // 2. Node attributes (IP / OS / zone). Best-effort: failure degrades to nulls.
  const attrs = new Map();
  try {
    const attrRes = await mcpJson('manage_infrastructure', {
      resource_type: 'analyze', operation: 'get_entity_groups',
      params: { payload: {
        type: 'kubernetesNode',
        groupBy: ['kubernetes.node.name', 'kubernetes.node.internalIp', 'host.os.name', 'host.os.version', 'zone'],
        metrics: ['cap_pods', 'cap_cpu', 'cap_mem'].map(m),
        timeFrame, tagFilterExpression: clusterFilter, pagination: { retrievalSize: 100 },
      } },
    });
    for (const it of attrRes?.items ?? []) {
      const t = it.tags ?? {};
      if (t['kubernetes.node.name']) {
        attrs.set(t['kubernetes.node.name'], {
          ...t,
          cap_pods: latestMetric(it.metrics, 'cap_pods'),
          cap_cpu:  latestMetric(it.metrics, 'cap_cpu'),
          cap_mem:  latestMetric(it.metrics, 'cap_mem'),
        });
      }
    }
  } catch (e) {
    if (e.rateLimited) throw e;
    console.warn('[DigitalTwin] node attribute lookup failed:', e.message);
  }

  // 3. Pods grouped by node / pod / namespace
  const podsRes = await mcpJson('manage_infrastructure', {
    resource_type: 'analyze', operation: 'get_entity_groups',
    params: { payload: {
      type: 'kubernetesPod',
      groupBy: ['kubernetes.node.name', 'kubernetes.pod.name', 'kubernetes.namespace.name'],
      metrics: ['cpuUsageToLimitRatio', 'memoryUsageToLimitRatio', 'restartCount', 'restartCountDelta'].map(m),
      timeFrame, tagFilterExpression: clusterFilter, pagination: { retrievalSize: 200 },
    } },
  });
  const podItems = podsRes?.items ?? [];
  const podsByNode = new Map();
  for (const it of podItems) {
    const t = it.tags ?? {};
    const pod = {
      name: t['kubernetes.pod.name'] ?? 'unknown',
      namespace: t['kubernetes.namespace.name'] ?? null,
      cpuToLimitPct: pct(latestMetric(it.metrics, 'cpuUsageToLimitRatio')),
      memToLimitPct: pct(latestMetric(it.metrics, 'memoryUsageToLimitRatio')),
      restarts: latestMetric(it.metrics, 'restartCount'),
      restartsDelta: latestMetric(it.metrics, 'restartCountDelta'),
    };
    pod.severity = podSeverity(pod);
    const key = t['kubernetes.node.name'] ?? '';
    if (!podsByNode.has(key)) podsByNode.set(key, []);
    podsByNode.get(key).push(pod);
  }

  const nodes = (nodesRes?.items ?? []).map((it) => {
    const name = it.label ?? it.tags?.['kubernetes.node.name'] ?? it.snapshotId;
    const a = attrs.get(name) ?? {};
    const issues = (it.entityHealthInfo?.openIssues ?? []).map((iss) => ({
      id: iss.id ?? null,
      severity: severityFromInstana(Number(iss.problem?.severity ?? 0)),
      text: iss.problem?.problemText ?? iss.metadata?.eventConfigurationType ?? 'Open issue',
      fixSuggestion: iss.problem?.fixSuggestion ?? null,
      start: iss.start ?? null,
    }));
    const pods = (podsByNode.get(name) ?? []).sort(
      (x, y) => (SEV_RANK[y.severity] - SEV_RANK[x.severity])
        || ((y.memToLimitPct ?? 0) - (x.memToLimitPct ?? 0)),
    );
    const metrics = {
      cpuRequestedPct:   pct(latestMetric(it.metrics, 'required_cpu_percentage')),
      memRequestedPct:   pct(latestMetric(it.metrics, 'required_mem_percentage')),
      cpuLimitPct:       pct(latestMetric(it.metrics, 'limit_cpu_percentage')),
      podAllocationPct:  pct(latestMetric(it.metrics, 'alloc_pods_percentage')),
      podsAllocated:     latestMetric(it.metrics, 'allocatedPods'),
      podsCapacity:      a.cap_pods ?? null,
      cpuCapacityCores:  a.cap_cpu ?? null,
      memCapacityBytes:  a.cap_mem ?? null,
    };
    if (metrics.podAllocationPct == null && metrics.podsAllocated != null && metrics.podsCapacity) {
      metrics.podAllocationPct = Math.round((metrics.podsAllocated / metrics.podsCapacity) * 100);
    }
    // Severity: Instana's own entity health decides "critical"; resource
    // pressure alone (requests vs capacity) can only raise "warning".
    let severity = severityFromInstana(Number(it.entityHealthInfo?.maxSeverity ?? 0));
    if ((metrics.cpuRequestedPct ?? 0) >= 85 || (metrics.memRequestedPct ?? 0) >= 85 || (metrics.podAllocationPct ?? 0) >= 85) {
      severity = worseOf(severity, 'warning');
    }
    return {
      id: it.snapshotId,
      name,
      ip: a['kubernetes.node.internalIp'] ?? null,
      os: [a['host.os.name'], a['host.os.version']].filter(Boolean).join(' ') || null,
      zone: a.zone ?? null,
      severity,
      issues,
      metrics,
      pods,
      podSummary: {
        total: pods.length,
        critical: pods.filter((p) => p.severity === 'critical').length,
        warning: pods.filter((p) => p.severity === 'warning').length,
      },
    };
  });

  // Worst first: severity, critical pods, warning pods, CPU requested.
  nodes.sort((x, y) => (SEV_RANK[y.severity] - SEV_RANK[x.severity])
    || (y.podSummary.critical - x.podSummary.critical)
    || (y.podSummary.warning - x.podSummary.warning)
    || ((y.metrics.cpuRequestedPct ?? 0) - (x.metrics.cpuRequestedPct ?? 0)));

  const clusterSeverity = nodes.reduce((s, n) => worseOf(s, n.severity), 'ok');
  return {
    ts: Date.now(),
    source: 'instana',
    windowSize,
    cluster: {
      name: clusterName,
      status: clusterSeverity,
      nodesCount: nodes.length,
      podsMonitored: podItems.length,
      podsTruncated: (podsRes?.totalHits ?? podItems.length) > podItems.length,
      openIssues: nodes.reduce((n, x) => n + x.issues.length, 0),
    },
    focusNodeId: nodes[0]?.id ?? null,
    nodes,
  };
}

app.get('/api/infrastructure/digital-twin', async (req, res) => {
  if (!mcpClient) return res.status(503).json({ unavailable: true, error: 'MCP not connected' });

  const windowSize = parseInt(req.query.window ?? '900000', 10);
  const force = req.query.force === 'true';
  let selection = 'query';
  let cluster = String(req.query.cluster ?? '').trim();
  let clusterList = clusterListCache;

  try {
    // Cluster list (cached 5 min). Needed for the picker and for auto-selection.
    try { clusterList = await fetchClusterList(); }
    catch (e) { if (e.rateLimited) throw e; console.warn('[DigitalTwin] cluster list failed:', e.message); }

    if (!cluster && INFRA_K8S_CLUSTER) { cluster = INFRA_K8S_CLUSTER; selection = 'env'; }
    if (!cluster && clusterList?.clusters?.length) {
      cluster = [...clusterList.clusters].sort((a, b) => (b.cpuRequestedPct ?? 0) - (a.cpuRequestedPct ?? 0))[0].name;
      selection = 'auto-highest-cpu-requests';
    }
    if (!cluster) {
      return res.json({
        ts: Date.now(), source: 'instana', unavailable: true, reason: 'no_kubernetes_entities',
        notice: 'Instana returned no Kubernetes node entities. Install the Instana agent on a cluster or set INSTANA_K8S_CLUSTER.',
        clusters: [], nodes: [],
      });
    }

    const cacheKey = `${cluster}|${windowSize}`;
    const cached = infraCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.ts < INFRA_CACHE_TTL_MS) {
      return res.json({ ...cached.data, cached: true });
    }

    const data = await buildDigitalTwin(cluster, windowSize);
    const payload = {
      ...data,
      cluster: { ...data.cluster, selection },
      clusters: clusterList?.clusters ?? [],
      clustersTruncated: clusterList?.truncated ?? false,
      isStale: false,
      rateLimited: false,
    };
    if (data.nodes.length === 0) {
      payload.unavailable = true;
      payload.reason = 'cluster_has_no_nodes';
      payload.notice = `No kubernetesNode entities found for cluster "${cluster}" in the selected window.`;
      return res.json(payload);
    }
    infraCache.set(cacheKey, { data: payload, ts: Date.now() });
    res.json(payload);
  } catch (err) {
    const cacheKey = `${cluster}|${windowSize}`;
    const cached = infraCache.get(cacheKey);
    if (err.rateLimited) {
      if (cached?.data) {
        return res.json({ ...cached.data, isStale: true, rateLimited: true, resetTs: err.resetTs,
          notice: 'Instana API rate limit active. Showing last cached infrastructure snapshot.' });
      }
      return res.json({ ts: Date.now(), source: 'instana', unavailable: true, reason: 'rate_limited',
        rateLimited: true, resetTs: err.resetTs, clusters: clusterList?.clusters ?? [], nodes: [],
        notice: 'Instana API rate limit active. No cached infrastructure data is available yet.' });
    }
    console.error('[DigitalTwin] Error:', err.message);
    if (cached?.data) return res.json({ ...cached.data, isStale: true, notice: `Showing cached data: ${err.message}` });
    res.status(502).json({ ts: Date.now(), source: 'instana', unavailable: true, reason: 'mcp_error',
      error: err.message, clusters: clusterList?.clusters ?? [], nodes: [] });
  }
});



// ─── Quick erroneous-call-rate endpoint ──────────────────────────────────────
// Lightweight single-metric fetch — used by the dashboard when you only need
// the error rate KPI without re-fetching all service-level data.
app.get('/api/erroneous-rate', async (req, res) => {
  if (!mcpClient) return res.status(503).json({ error: 'MCP not connected' });
  const windowSize = parseInt(req.query.window ?? '3600000', 10);
  try {
    const raw = await callMCPTool('manage_applications', {
      resource_type: 'metrics',
      operation: 'get_grouped_calls_metrics',
      params: {
        metrics: [
          { metric: 'calls',          aggregation: 'SUM' },
          { metric: 'erroneousCalls', aggregation: 'SUM' },
          { metric: 'latency',        aggregation: 'P90' },
        ],
        tag_filter_expression: {
          type: 'TAG_FILTER', name: 'application.name',
          operator: 'EQUALS', entity: 'DESTINATION',
          value: RETAIL_APP_NAME,
        },
        group:      { groupbyTag: 'service.name', groupbyTagEntity: 'DESTINATION' },
        time_frame: { windowSize },
        include_internal:  false,
        include_synthetic: false,
      },
    });

    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return res.status(500).json({ error: 'Failed to parse MCP response' }); }

    const inner = parsed?.results ?? parsed;

    // Guard: elicitation_needed means bad params
    if (inner?.elicitation_needed) {
      return res.status(400).json({ error: `MCP elicitation needed: ${inner.message}` });
    }

    // Guard: rate limit inside the response body
    const rawStr = String(raw);
    if (rawStr.toLowerCase().includes('rate limit') || rawStr.includes('429')) {
      const resetMatch = rawStr.match(/X-RateLimit-Reset.*?'(\d{10})'/)
        ?? rawStr.match(/RateLimit-Reset.*?(\d{10})/)
        ?? rawStr.match(/(\d{10})/);
      const resetTs = resetMatch ? parseInt(resetMatch[1], 10) : Math.floor(Date.now() / 1000) + 60;
      return res.status(429).json({ error: 'Rate limited', rateLimited: true, resetTs });
    }

    const items  = Array.isArray(inner) ? inner
      : inner?.items ?? inner?.data ?? [];

    let totalCalls = 0, totalErrors = 0, p90 = null;
    for (const item of items) {
      // mcp-instana uses lowercase aggregation suffix: 'calls.sum', 'erroneousCalls.sum'
      const series = (k) => {
        const s = item.metrics?.[k + '.sum']
          ?? item.metrics?.[k + '.SUM']
          ?? item.metrics?.[k];
        if (Array.isArray(s)) return s.reduce((a, pt) => a + (Number(pt?.[1]) || 0), 0);
        // Fall back to metrics_extracted if available
        return Number(item.metrics_extracted?.[k + '.sum']?.value) || 0;
      };
      totalCalls  += series('calls');
      totalErrors += series('erroneousCalls');
      const latSeries = item.metrics?.['latency.p90'] ?? item.metrics?.['latency.P90'] ?? item.metrics?.['latency'];
      if (Array.isArray(latSeries) && latSeries.length > 0) {
        const v = latSeries[latSeries.length - 1]?.[1];
        if (v != null && (p90 === null || v > p90)) p90 = v;
      }
    }

    res.json({
      windowSize,
      totalCalls:    Math.round(totalCalls),
      totalErrors:   Math.round(totalErrors),
      erroneousRate: totalCalls > 0 ? +((totalErrors / totalCalls) * 100).toFixed(2) : 0,
      p90Latency:    p90 != null ? Math.round(p90) : null,
    });
  } catch (err) {
    const msg = String(err.message ?? err);
    if (msg.includes('rate limit') || msg.includes('429')) {
      const resetMatch = msg.match(/X-RateLimit-Reset.*?'(\d{10})'/)
        ?? msg.match(/RateLimit-Reset.*?(\d{10})/)
        ?? msg.match(/(\d{10})/);
      const resetTs = resetMatch ? parseInt(resetMatch[1], 10) : Math.floor(Date.now() / 1000) + 60;
      return res.status(429).json({ error: 'Rate limited', rateLimited: true, resetTs });
    }
    res.status(500).json({ error: msg });
  }
});

app.post('/api/monitor/stop', (req, res) => {
  if (!monitorRunning) return res.json({ running: false, message: 'Already stopped' });
  clearInterval(monitorTimer);
  monitorTimer = null;
  monitorRunning = false;
  broadcast({ type: 'monitor_stopped', ts: Date.now() });
  console.log('[Monitor] Stopped');
  res.json({ running: false });
});

app.get('/api/monitor/status', (req, res) => {
  res.json({ running: monitorRunning, intervalMs: POLL_INTERVAL_MS, clients: sseClients.size });
});

app.post('/api/monitor/check_now', async (req, res) => {
  try {
    void runMonitorCheck();
    res.json({ status: 'check_initiated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API Routes ────────────────────────────────────────────────────────────

// Mock-only endpoints are not available against live data.
app.all(['/api/scenarios', '/api/demo/*'], (req, res) => {
  res.status(404).json({ error: 'Scenario injection is only available when STREAM_MODE=mock', streamMode: STREAM_MODE });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    streamMode: STREAM_MODE,
    mcpConnected: !!mcpClient,
    toolCount: mcpTools.length,
    // Hostname only: never expose the full configured URL (path/query/credentials).
    instanaUrl: (() => {
      try { return new URL(process.env.INSTANA_BASE_URL).hostname; }
      catch { return 'not configured'; }
    })(),
    bobApiBase: process.env.BOB_API_BASE_URL || 'not configured',
    bobModel: BOB_MODEL,
  });
});

app.get('/api/tools', (req, res) => {
  res.json({ tools: mcpTools });
});

app.post('/api/prompt', llmRateLimiter, async (req, res) => {
  const { prompt, conversationHistory = [] } = req.body;
  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const result = await runAgentLoop(prompt.trim(), conversationHistory);
    res.json(result);
  } catch (err) {
    console.error('Agent loop error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ─── Trigger Headless Bob RCA Diagnostics ─────────────────────────────────
app.post('/api/headlessbob/diagnose', llmRateLimiter, async (req, res) => {
  const { prompt, instanaAnswer, issueSummary } = req.body;
  try {
    const result = await runHeadlessBobRCA(prompt || '', instanaAnswer || '', issueSummary || '');
    res.json(result);
  } catch (err) {
    console.error('HeadlessBob diagnose error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate RCA' });
  }
});

// ─── Headless Bob proxy ────────────────────────────────────────────────────
// All /hb/* requests are forwarded to the registered headlessbob instance.
// This avoids CORS — the browser always talks to the bridge (same origin via Vite proxy).
app.use('/hb', (req, res, next) => {
  if (!hbobUrl) {
    return res.status(503).json({ error: 'No headlessbob instance registered. Connect first.' });
  }
  createProxyMiddleware({
    target: hbobUrl,
    changeOrigin: true,
    pathRewrite: { '^/hb': '' },
    on: {
      proxyReq: (proxyReq, req) => {
        // Strip browser headers so HeadlessBob doesn't reject as cross-origin / cross-site
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
        proxyReq.removeHeader('sec-fetch-site');
        proxyReq.removeHeader('sec-fetch-mode');
        proxyReq.removeHeader('sec-fetch-dest');

        if (hbobToken) proxyReq.setHeader('Authorization', `Bearer ${hbobToken}`);

        // Re-stream body if express.json() already parsed it
        fixRequestBody(proxyReq, req);
      },
      error: (err, req, res) => {
        console.error('[HB Proxy] Error:', err.message);
        res.status(502).json({ error: `Headless Bob proxy error: ${err.message}` });
      },
    },
  })(req, res, next);
});

// ─── Static UI (production build) ──────────────────────────────────────────
// When `dist/` exists (npm run build / container image) the bridge serves the
// UI itself. In development Vite serves the UI and proxies /api and /hb here.
const DIST_DIR = resolve(__dirname, '../dist');
if (existsSync(resolve(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/|hb\/).*/, (req, res) => res.sendFile(resolve(DIST_DIR, 'index.html')));
  console.log(`Serving UI from ${DIST_DIR}`);
}

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Bridge server running on http://localhost:${PORT}`);
  if (MOCK_MODE) return;
  console.log(`Using Bob inference API: ${process.env.BOB_API_BASE_URL || '(not set)'}`);
  await connectMCP();
});
