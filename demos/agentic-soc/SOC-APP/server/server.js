const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Simple logger utility
const logger = {
  info: (message, data = {}) => {
    console.log('[%s] INFO: %s', new Date().toISOString(), message, data);
  },
  error: (message, error = {}) => {
    console.error('[%s] ERROR: %s', new Date().toISOString(), message, error);
  },
  warn: (message, data = {}) => {
    console.warn('[%s] WARN: %s', new Date().toISOString(), message, data);
  },
  debug: (message, data = {}) => {
    if (process.env.DEBUG === 'true') {
      console.log('[%s] DEBUG: %s', new Date().toISOString(), message, data);
    }
  }
};

const app = express();

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST'],
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiters ─────────────────────────────────────────────────────────────
const agentRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — try again in a minute.' },
});
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many token requests — try again in a minute.' },
});

const DEFAULT_STAGE_CONFIG = {
  triage: {
    label: 'Triage',
    agentId: process.env.TRIAGE_AGENT_ID || '',
    instruction: 'Assesses the incoming offense, determines severity, and prepares the hand-off for downstream stages.'
  },
  classification: {
    label: 'Classification',
    agentId: process.env.CLASSIFICATION_AGENT_ID || '',
    instruction: 'Determines whether the offense is a true positive, false positive, benign positive, or requires RCA.'
  },
  rca: {
    label: 'RCA',
    agentId: process.env.RCA_AGENT_ID || '',
    instruction: 'Performs root cause analysis, evidence correlation, and investigation summarization.'
  },
  notification: {
    label: 'Notification',
    agentId: process.env.NOTIFICATION_AGENT_ID || '',
    instruction: 'Builds the customer-ready notification payload and explains the communication outcome.'
  },
  action: {
    label: 'Action',
    agentId: process.env.ACTION_AGENT_ID || '',
    instruction: 'Recommends or executes the next remediation action and records the decision.'
  },
  close: {
    label: 'Close',
    agentId: process.env.CLOSE_AGENT_ID || '',
    instruction: 'Finalizes the case, summarizes resolution, and closes the workflow.'
  }
};

const STAGE_ORDER = ['triage', 'classification', 'rca', 'notification', 'action', 'close'];
const VALID_STAGE_KEYS = new Set(STAGE_ORDER);
const SERVICE_URL = process.env.WXO_URL || process.env.WATSONX_SERVICE_URL || process.env.Service_instance_URL || '';
const API_KEY = process.env.WXO_API_KEY || process.env.WATSONX_API_KEY || '';
const CONV_SUPERVISOR_AGENT_ID = process.env.CONV_SUPERVISOR_AGENT_ID || '';

// Log stage configuration at startup — omit agentIds from INFO logs
logger.info('=== Stage Configuration Loaded ===', {
  stageCount: Object.keys(DEFAULT_STAGE_CONFIG).length,
  stages: Object.keys(DEFAULT_STAGE_CONFIG).map((key) => ({
    key,
    label: DEFAULT_STAGE_CONFIG[key].label,
    fromEnv: Boolean(process.env[`${key.toUpperCase()}_AGENT_ID`]),
    configured: Boolean(DEFAULT_STAGE_CONFIG[key].agentId),
  })),
});

function parseServiceUrl(serviceUrl) {
  if (!serviceUrl) {
    logger.warn('Service URL is empty');
    return { host: '', instanceId: '' };
  }

  const parsed = new URL(serviceUrl);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const instancesIndex = pathParts.indexOf('instances');

  if (instancesIndex === -1 || !pathParts[instancesIndex + 1]) {
    logger.error('Invalid WATSONX_SERVICE_URL format', { serviceUrl });
    throw new Error('WATSONX_SERVICE_URL must include /instances/{instance_id}');
  }

  const result = {
    host: parsed.hostname,
    instanceId: pathParts[instancesIndex + 1]
  };
  logger.debug('Service URL parsed', result);
  return result;
}

function getPlatform(serviceUrl) {
  let hostname = '';

  try {
    hostname = new URL(serviceUrl).hostname.toLowerCase();
  } catch (error) {
    logger.warn('Unable to parse service URL while detecting platform', { serviceUrl });
    logger.debug('Detected platform: On-Premises');
    return 'on_prem';
  }

  if (
    hostname === 'watson-orchestrate.cloud.ibm.com' ||
    hostname.endsWith('.watson-orchestrate.cloud.ibm.com')
  ) {
    logger.debug('Detected platform: IBM Cloud');
    return 'ibm_cloud';
  }

  if (
    hostname === 'watson-orchestrate.ibm.com' ||
    hostname.endsWith('.watson-orchestrate.ibm.com')
  ) {
    logger.debug('Detected platform: AWS or SaaS');
    return 'aws_or_saas';
  }

  logger.debug('Detected platform: On-Premises');
  return 'on_prem';
}

// Per-request socket timeout (60s).
const REQUEST_TIMEOUT_MS = 60000;

// ── Token cache (avoids a fresh IAM round-trip on every poll) ────────────────
let _tokenCache = { token: '', expiresAt: 0 };
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 min — refresh 10 min before 60-min IBM token expires

function requestJson(options, body) {
  let parsedBody = null;
  try {
    parsedBody = body ? JSON.parse(body) : null;
  } catch (e) {
    parsedBody = body;
  }
  
  logger.debug('Making HTTP request', {
    hostname: options.hostname,
    path: options.path,
    method: options.method,
    payloadSize: body ? Buffer.byteLength(body) : 0,
    payload: parsedBody
  });
  
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = '';

      response.on('data', (chunk) => {
        responseBody += chunk;
      });

      response.on('end', () => {
        let parsed = responseBody;

        if (responseBody) {
          try {
            parsed = JSON.parse(responseBody);
          } catch (error) {
            parsed = responseBody;
          }
        }

        logger.debug('HTTP response received', {
          statusCode: response.statusCode,
          response: parsed
        });

        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(parsed);
          return;
        }

        logger.error('HTTP request failed', { statusCode: response.statusCode, response: parsed });
        const error = new Error(typeof parsed === 'string' ? parsed : JSON.stringify(parsed));
        error.statusCode = response.statusCode;
        error.body = parsed;
        reject(error);
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      logger.error('HTTP request socket timeout', { path: options.path, timeoutMs: REQUEST_TIMEOUT_MS });
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    request.on('error', (err) => {
      logger.error('HTTP request error', { message: err.message });
      reject(err);
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
}

async function getAccessToken() {
  if (!API_KEY) {
    logger.error('Missing API key for authentication');
    throw new Error('Missing WATSONX_API_KEY or WXO_API_KEY');
  }

  // Return cached token if still valid
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) {
    logger.debug('Using cached IAM token');
    return _tokenCache.token;
  }

  logger.info('Requesting access token');
  const platform = getPlatform(SERVICE_URL);
  let token;

  if (platform === 'ibm_cloud') {
    logger.debug('Using IBM Cloud authentication');
    const body = new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: API_KEY
    }).toString();

    const response = await requestJson({
      hostname: 'iam.cloud.ibm.com',
      path: '/identity/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    token = response.access_token;
  } else {
    logger.debug('Using SaaS/On-Premises authentication');
    const body = JSON.stringify({ apikey: API_KEY });
    const response = await requestJson({
      hostname: 'iam.platform.saas.ibm.com',
      path: '/siusermgr/api/1.0/apikeys/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);
    token = response.token;
  }

  _tokenCache = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  logger.info('IAM token refreshed, cached for 50 min');
  return token;
}

function extractText(runDetails) {
  return runDetails?.result?.data?.message?.content?.[0]?.text || '';
}

function extractTraces(runDetails, runEvents = []) {
  if (Array.isArray(runDetails?.traces) && runDetails.traces.length > 0) {
    return runDetails.traces;
  }

  if (Array.isArray(runDetails?.trace) && runDetails.trace.length > 0) {
    return runDetails.trace;
  }

  if (Array.isArray(runDetails?.result?.trace) && runDetails.result.trace.length > 0) {
    return runDetails.result.trace;
  }

  if (Array.isArray(runEvents) && runEvents.length > 0) {
    return runEvents;
  }

  if (Array.isArray(runDetails?.result?.data?.message?.additional_properties?.tool_calls)) {
    return runDetails.result.data.message.additional_properties.tool_calls;
  }

  if (Array.isArray(runDetails?.step_history)) {
    return runDetails.step_history;
  }

  // Fallback: Return structured object containing run telemetry
  return [
    {
      event: 'run.details',
      id: runDetails?.id || runDetails?.run_id,
      trace_id: runDetails?.trace_id || null,
      status: runDetails?.status || 'completed',
      usage: runDetails?.usage || null,
      guardrails: runDetails?.guardrails || null,
      llm_params: runDetails?.llm_params || null,
      created_at: runDetails?.created_at || null,
      completed_at: runDetails?.completed_at || null,
      result: runDetails?.result || null
    }
  ];
}

function buildAnalytics(runDetails, startedAt, traces = []) {
  const timestamps = [startedAt, runDetails?.created_at, runDetails?.updated_at, runDetails?.completed_at].filter(Boolean);
  const durationMs = timestamps.length >= 2
    ? Math.max(new Date(timestamps[timestamps.length - 1]).getTime() - new Date(timestamps[0]).getTime(), 0)
    : null;

  const toolCallsCount = traces.filter((item) => {
    const type = String(item?.type || item?.event_type || item?.event || '').toLowerCase();
    const name = String(item?.name || item?.data?.name || '').toLowerCase();
    return type.includes('tool') || type.includes('step') || name.includes('tool');
  }).length;

  return {
    status: runDetails?.status || 'unknown',
    durationMs,
    toolCalls: toolCallsCount,
    traceCount: traces.length,
    startedAt,
    updatedAt: runDetails?.updated_at || runDetails?.completed_at || null
  };
}

async function getRunEvents(runId, token, service) {
  try {
    const eventsResponse = await requestJson({
      hostname: service.host,
      path: `/instances/${service.instanceId}/v1/orchestrate/runs/${runId}/events`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (Array.isArray(eventsResponse)) return eventsResponse;
    if (Array.isArray(eventsResponse?.items)) return eventsResponse.items;
    if (Array.isArray(eventsResponse?.data)) return eventsResponse.data;
    return [];
  } catch (err) {
    logger.warn('Could not fetch optional run events/traces', { runId, error: err.message });
    return [];
  }
}

async function getRunDetails(runId, token, service) {
  return requestJson({
    hostname: service.host,
    path: `/instances/${service.instanceId}/v1/orchestrate/runs/${runId}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
}

// Maximum time to wait for a single agent run: 5 minutes.
// Individual agents (RCA, Notification) can legitimately take 2-3 minutes.
const COMPLETION_TIMEOUT_MS = 300000;

// Polling schedule: start at 2s, double each miss up to a 10s ceiling.
// This reduces poll noise on fast runs while not stalling on slow ones.
async function waitForCompletion(runId, token, service, startedAt) {
  logger.info('Waiting for run completion', { runId });
  const deadline = Date.now() + COMPLETION_TIMEOUT_MS;
  let attempts = 0;
  let pollInterval = 2000;
  const MAX_POLL_INTERVAL = 10000;

  while (Date.now() < deadline) {
    attempts++;
    const runDetails = await getRunDetails(runId, token, service);
    const status = runDetails?.status;

    logger.debug('Run status check', { runId, status, attempt: attempts, pollInterval });

    if (status === 'completed') {
      logger.info('Run completed successfully', { runId, duration: Date.now() - new Date(startedAt).getTime() });
      return runDetails;
    }

    if (status === 'failed' || status === 'cancelled') {
      logger.warn('Run did not complete successfully', { runId, status });
      return runDetails;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    // Exponential backoff up to MAX_POLL_INTERVAL
    pollInterval = Math.min(pollInterval * 1.5, MAX_POLL_INTERVAL);
  }

  logger.error('Run completion timed out', { runId, maxWaitTime: `${COMPLETION_TIMEOUT_MS}ms` });
  throw new Error(`Timed out waiting for run ${runId} after ${COMPLETION_TIMEOUT_MS / 1000}s`);
}

app.get('/api/config', (req, res) => {
  logger.info('GET /api/config - Fetching configuration');
  res.json({
    success: true,
    serviceConfigured: Boolean(SERVICE_URL && API_KEY),
    stages: STAGE_ORDER.map((key) => ({ key, ...DEFAULT_STAGE_CONFIG[key] }))
  });
});

app.post('/api/stages/:stageKey/run', agentRunLimiter, async (req, res) => {
  try {
    const { stageKey } = req.params;
    const { prompt, threadId } = req.body;

    // Allowlist check — reject any key not in the known stage set
    if (!VALID_STAGE_KEYS.has(stageKey)) {
      logger.warn('Unknown stage requested', { stageKey });
      return res.status(404).json({ success: false, error: 'Unknown stage' });
    }

    logger.info('POST /api/stages/:stageKey/run - Starting stage run', {
      stageKey,
      threadId: threadId ? '[provided]' : 'new - agent will create',
      promptLength: prompt?.length || 0,
    });

    const stage = DEFAULT_STAGE_CONFIG[stageKey];

    logger.debug('Stage configuration retrieved', {
      stageKey,
      stageName: stage.label,
    });

    if (!prompt) {
      logger.warn('Prompt is required but missing');
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    if (!SERVICE_URL) {
      logger.error('SERVICE_URL is not configured');
      return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });
    }

    const service = parseServiceUrl(SERVICE_URL);
    const token = await getAccessToken();
    
    logger.debug('Constructing agent payload', {
      stageKey,
      configuredAgentId: stage.agentId,
      hasThreadId: Boolean(threadId)
    });
    
    const payload = {
      agent_id: stage.agentId,
      message: {
        role: 'user',
        content: prompt
      }
    };

    // Only include thread_id if explicitly provided
    if (threadId) {
      payload.thread_id = threadId;
      logger.debug('Using provided thread ID', {
        stageKey,
        threadId: threadId
      });
    } else {
      logger.debug('No thread ID provided - agent will create new thread', {
        stageKey
      });
    }

    const body = JSON.stringify(payload);
    const startedAt = new Date().toISOString();

    logger.info('Agent call dispatched', {
      stageKey,
      stageName: stage.label,
      threadId: threadId ? '[provided]' : null,
      messageLength: payload.message.content.length,
    });
    
    const runResponse = await requestJson({
      hostname: service.host,
      path: `/instances/${service.instanceId}/v1/orchestrate/runs`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    logger.info('Agent call response received', {
      stageKey,
      runId: runResponse.run_id,
      responseStatus: runResponse.status || 'unknown',
    });
    
    const runDetails = await waitForCompletion(runResponse.run_id, token, service, startedAt);
    const runEvents = await getRunEvents(runResponse.run_id, token, service);

    const outputText = extractText(runDetails);
    const traces = extractTraces(runDetails, runEvents);
    const analytics = buildAnalytics(runDetails, startedAt, traces);

    logger.info('Stage run completed', {
      stageKey,
      runId: runResponse.run_id,
      status: runDetails?.status,
      duration: Date.now() - new Date(startedAt).getTime(),
    });

    res.json({
      success: true,
      stage: {
        key: stageKey,
        label: stage.label,
        instruction: stage.instruction,
      },
      run: {
        threadId: runDetails?.thread_id || runResponse.thread_id || null,
        runId: runResponse.run_id,
        taskId: runResponse.task_id || null,
        messageId: runResponse.message_id || null,
        status: runDetails?.status || 'unknown',
        outputText: outputText,
        analytics,
        traces,
      }
    });
  } catch (error) {
    logger.error('Stage run failed', {
      stageKey: req.params.stageKey,
      error: error.message,
      errorDetails: error.body || error
    });
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      details: error.body || null
    });
  }
});

app.get('/api/runs/:runId', async (req, res) => {
  try {
    logger.info('GET /api/runs/:runId - Fetching run details', { runId: req.params.runId });
    
    if (!SERVICE_URL) {
      logger.error('SERVICE_URL is not configured');
      return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });
    }

    const service = parseServiceUrl(SERVICE_URL);
    const token = await getAccessToken();
    const runDetails = await getRunDetails(req.params.runId, token, service);
    const runEvents = await getRunEvents(req.params.runId, token, service);

    logger.info('Run details retrieved', { runId: req.params.runId, status: runDetails?.status });

    const traces = extractTraces(runDetails, runEvents);
    const analytics = buildAnalytics(runDetails, runDetails?.created_at || new Date().toISOString(), traces);

    res.json({
      success: true,
      run: {
        status: runDetails?.status || 'unknown',
        outputText: extractText(runDetails),
        analytics,
        traces,
      }
    });
  } catch (error) {
    logger.error('Failed to fetch run details', { runId: req.params.runId, error: error.message });
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message,
      details: error.body || null
    });
  }
});



// POST /api/poc-stages/:stageKey/run — create a run, return immediately with runId + startedAt
app.post('/api/poc-stages/:stageKey/run', agentRunLimiter, async (req, res) => {
  const { stageKey } = req.params;
  const { prompt, threadId } = req.body;

  if (!VALID_STAGE_KEYS.has(stageKey)) return res.status(404).json({ success: false, error: 'Unknown stage' });
  if (!prompt) return res.status(400).json({ success: false, error: 'prompt is required' });
  if (!SERVICE_URL) return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });

  const stage = DEFAULT_STAGE_CONFIG[stageKey];

  logger.info(`[${stageKey}] ── START ──────────────────────────────────────`);
  logger.info(`[${stageKey}] Prompt dispatched (${prompt.length} chars)`);

  try {
    const service = parseServiceUrl(SERVICE_URL);
    const token   = await getAccessToken();

    const payload = { agent_id: stage.agentId, message: { role: 'user', content: prompt } };
    if (threadId) payload.thread_id = threadId;

    const body        = JSON.stringify(payload);
    const startedAt   = new Date().toISOString();
    const runResponse = await requestJson({
      hostname: service.host,
      path: `/instances/${service.instanceId}/v1/orchestrate/runs`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);

    const runId = runResponse.run_id;
    logger.info(`[${stageKey}] Run created — runId: ${runId}`);

    res.json({ success: true, runId, threadId: runResponse.thread_id || null, taskId: runResponse.task_id || null, startedAt });
  } catch (error) {
    logger.error(`[${stageKey}] Failed to create run: ${error.message}`);
    res.status(error.statusCode || 500).json({ success: false, error: error.message, details: error.body || null });
  }
});

// GET /api/poc-stages/:stageKey/run/:runId — single non-blocking status check
app.get('/api/poc-stages/:stageKey/run/:runId', async (req, res) => {
  const { stageKey, runId } = req.params;
  const { threadId } = req.query;  // startedAt no longer accepted from client

  if (!VALID_STAGE_KEYS.has(stageKey)) return res.status(404).json({ success: false, error: 'Unknown stage' });
  const stage = DEFAULT_STAGE_CONFIG[stageKey];
  if (!SERVICE_URL) return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });

  try {
    const service    = parseServiceUrl(SERVICE_URL);
    const token      = await getAccessToken();
    const runDetails = await getRunDetails(runId, token, service);
    const status     = runDetails?.status || 'unknown';

    logger.info(`[${stageKey}] Poll → runId: ${runId}  status: ${status}`);

    const TERMINAL = ['completed', 'failed', 'cancelled'];
    if (!TERMINAL.includes(status)) {
      return res.json({ success: true, completed: false, status });
    }

    const runEvents  = await getRunEvents(runId, token, service);
    const outputText = extractText(runDetails);
    const traces     = extractTraces(runDetails, runEvents);
    // Use server-sourced timestamp — never the client-supplied startedAt
    const resolvedStartedAt = runDetails?.created_at || new Date().toISOString();
    const analytics  = buildAnalytics(runDetails, resolvedStartedAt, traces);

    logger.info(`[${stageKey}] ── DONE ─── status: ${status}  duration: ${analytics.durationMs != null ? (analytics.durationMs / 1000).toFixed(1) + 's' : '—'}`);

    res.json({
      success: true, completed: true,
      stage: { key: stageKey, label: stage.label },
      run: {
        threadId:  runDetails?.thread_id || threadId || null,
        runId, taskId: null, messageId: null,
        status, outputText, analytics, traces,
      },
    });
  } catch (error) {
    logger.error(`[${stageKey}] Poll error — runId: ${runId} — ${error.message}`);
    res.status(error.statusCode || 500).json({ success: false, error: error.message, details: error.body || null });
  }
});

// ── Conversational Supervisor Chat routes ─────────────────────────────────

app.post('/api/chat-conv', agentRunLimiter, async (req, res) => {
  const { message, threadId } = req.body;
  if (!message) return res.status(400).json({ success: false, error: 'message is required' });
  if (!SERVICE_URL) return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });
  if (!CONV_SUPERVISOR_AGENT_ID) return res.status(500).json({ success: false, error: 'CONV_SUPERVISOR_AGENT_ID is not set in .env' });

  try {
    const service = parseServiceUrl(SERVICE_URL);
    const token   = await getAccessToken();

    const payload = { agent_id: CONV_SUPERVISOR_AGENT_ID, message: { role: 'user', content: message } };
    if (threadId) payload.thread_id = threadId;

    const body        = JSON.stringify(payload);
    const startedAt   = new Date().toISOString();
    const runResponse = await requestJson({
      hostname: service.host,
      path: `/instances/${service.instanceId}/v1/orchestrate/runs`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);

    res.json({ success: true, runId: runResponse.run_id, threadId: runResponse.thread_id || threadId || null, startedAt });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message, details: error.body || null });
  }
});

app.get('/api/chat-conv/:runId', async (req, res) => {
  const { runId } = req.params;
  const { threadId } = req.query;  // startedAt no longer accepted from client
  if (!SERVICE_URL) return res.status(500).json({ success: false, error: 'Missing WATSONX_SERVICE_URL' });

  try {
    const service    = parseServiceUrl(SERVICE_URL);
    const token      = await getAccessToken();
    const runDetails = await getRunDetails(runId, token, service);
    const status     = runDetails?.status || 'unknown';

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.json({ success: true, completed: false, status });
    }

    const runEvents  = await getRunEvents(runId, token, service);
    const outputText = extractText(runDetails);
    const traces     = extractTraces(runDetails, runEvents);
    const resolvedStartedAt = runDetails?.created_at || new Date().toISOString();
    const analytics  = buildAnalytics(runDetails, resolvedStartedAt, traces);

    res.json({ success: true, completed: true, threadId: runDetails?.thread_id || threadId || null, runId, status, outputText, analytics, traces });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message, details: error.body || null });
  }
});

// ── Embed JWT endpoint ────────────────────────────────────────────────────────
app.get('/api/wxo-token', tokenLimiter, (req, res) => {
  // Enforce same-origin: only allow requests from the configured allowed origin
  const origin = req.headers.origin || req.headers.referer || '';
  const allowed = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  if (origin && !origin.startsWith(allowed)) {
    logger.warn('[wxo-token] Request rejected — origin not allowed', { origin });
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  const rawKey = process.env.WXO_EMBED_PRIVATE_KEY || '';
  if (!rawKey) {
    logger.warn('[wxo-token] WXO_EMBED_PRIVATE_KEY not set — returning unsigned placeholder');
    return res.json({ success: false, error: 'WXO_EMBED_PRIVATE_KEY is not configured in .env' });
  }

  try {
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const jwtPayload = Buffer.from(JSON.stringify({
      sub: 'embed-user',
      iss: 'soc-demo-server',
      aud: 'wxo-embed',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const signingInput = `${header}.${jwtPayload}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signingInput);
    const signature = sign.sign(privateKey, 'base64url');

    res.json({ success: true, token: `${signingInput}.${signature}` });
  } catch (err) {
    logger.error('[wxo-token] Failed to sign JWT', { error: err.message });
    res.status(500).json({ success: false, error: `Failed to sign embed JWT: ${err.message}` });
  }
});

app.get('/health', (req, res) => {
  logger.debug('GET /health - Health check');
  res.json({
    status: 'healthy',
    serviceConfigured: Boolean(SERVICE_URL && API_KEY),
    convSupervisorConfigured: Boolean(CONV_SUPERVISOR_AGENT_ID),
    pipeline: 'SOC 5-Agent Pipeline'
  });
});

// Rate limit catch-all route that serves index.html to reduce DoS risk
const staticFallbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});

app.get('*', staticFallbackLimiter, (req, res) => {
  if (req.path.startsWith('/api') || req.path === '/health') {
    return res.status(404).json({ success: false, error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.EXPRESS_PORT || process.env.SERVER_PORT || 3001;
app.listen(PORT, () => {
  logger.info(`=== SOC 5-Agent Server Started on http://localhost:${PORT} ===`);
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Service Configured: ${Boolean(SERVICE_URL && API_KEY)}`);
  logger.info(`DEBUG mode: ${process.env.DEBUG === 'true' ? 'enabled' : 'disabled'}`);
  logger.info(`=== Ready to accept requests ===`);
});
