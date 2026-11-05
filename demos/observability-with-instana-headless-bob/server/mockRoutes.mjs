// STREAM_MODE=mock: simulated API surface for the Retail Application demo.
//
// Every payload produced here is SIMULATED. It is generated from mockData.mjs
// (scenario engine) and never touches Instana, the MCP server or the Bob API.
// All payloads carry `source: 'mock'` / `simulated: true` so the UI can label
// them. The route shapes match the live bridge so one frontend serves both modes.

import express from 'express';
import {
  isLoadedState,
  currentScenarioId,
  setScenario,
  getCurrentScenario,
  getCurrentTelemetry,
  SCENARIOS,
} from './mockData.mjs';

const RETAIL_APP_NAME = process.env.INSTANA_APP_NAME || 'Retail Application';
const SIM_TAG = '🧪 **MOCK DATA (STREAM_MODE=mock)** — no live Instana query was made.';
const GIB = 1024 ** 3;

const sentinel = (severity, errorRate, p90Latency, hasIncidents) =>
  JSON.stringify({ severity, errorRate, p90Latency, hasIncidents });

// ── Digital twin (simulated, shaped like the live payload) ─────────────────

const pctNum = (s) => parseInt(String(s), 10);

function podSeverity(status) {
  if (status === 'Running') return 'ok';
  return status.startsWith('Degraded') ? 'critical' : 'warning';
}

function buildMockTwin() {
  const sc = getCurrentScenario();
  const id = sc?.id ?? null;
  const loaded = isLoadedState;

  // Per-node definitions. Conditions mirror the scenario → node mapping of the
  // original demo (redis → node-0; db/jvm/gateway → node-1; cpu → node-2).
  const defs = [
    {
      id: 'node-0', name: 'ocp-worker-01.retail.internal', ip: '10.240.0.14', zone: 'us-south-1',
      cpu: id === 'redis_cache_failure' ? 91 : loaded ? 42 : 22,
      mem: id === 'redis_cache_failure' ? 82 : loaded ? 52 : 36,
      pods: 18, disk: id === 'redis_cache_failure' ? 74 : 41, netIn: loaded ? 280 : 45, netOut: loaded ? 320 : 52,
      status: id === 'redis_cache_failure' ? 'CPUPressure / Cache Storm' : 'Ready',
      hosted: [
        { name: 'cart-service-1e8831-q773e', ns: 'retail-app', status: id === 'redis_cache_failure' ? 'Degraded (18% Errors)' : 'Running', restarts: id === 'redis_cache_failure' ? 1 : 0, cpu: id === 'redis_cache_failure' ? '88%' : '11%', mem: id === 'redis_cache_failure' ? '820 MiB' : '210 MiB' },
        { name: 'catalog-service-9c4110-z012d', ns: 'retail-app', status: id === 'redis_cache_failure' ? 'High DB Latency' : 'Running', restarts: 0, cpu: id === 'redis_cache_failure' ? '54%' : '12%', mem: id === 'redis_cache_failure' ? '510 MiB' : '240 MiB' },
        { name: 'instana-agent-pk891', ns: 'instana-agent', status: 'Running', restarts: 0, cpu: '0.4%', mem: '128 MiB' },
      ],
    },
    {
      id: 'node-1', name: 'ocp-worker-02.retail.internal', ip: '10.240.0.15', zone: 'us-south-2',
      cpu: id === 'db_pool_exhaustion' ? 86 : id === 'jvm_memory_leak' ? 78 : id === 'gateway_rate_limit' ? 65 : loaded ? 55 : 28,
      mem: id === 'jvm_memory_leak' ? 95 : id === 'db_pool_exhaustion' ? 89 : id === 'gateway_rate_limit' ? 78 : loaded ? 60 : 44,
      pods: 24, disk: id === 'db_pool_exhaustion' ? 68 : 55, netIn: loaded ? 480 : 78, netOut: loaded ? 520 : 88,
      status: id === 'db_pool_exhaustion' ? 'MemoryPressure / DB Lock'
        : id === 'jvm_memory_leak' ? 'MemoryPressure / JVM Leak'
        : id === 'gateway_rate_limit' ? 'NetworkQueue / Gateway Timeout' : 'Ready',
      hosted: [
        { name: 'shipping-service-7f8849-c92xa', ns: 'retail-app', status: id === 'db_pool_exhaustion' ? 'Degraded (14% Errors)' : 'Running', restarts: id === 'db_pool_exhaustion' ? 2 : 0, cpu: id === 'db_pool_exhaustion' ? '84%' : '18%', mem: id === 'db_pool_exhaustion' ? '910 MiB' : '340 MiB' },
        {
          name: 'payment-service-5d9921-k911a', ns: 'retail-app',
          status: id === 'jvm_memory_leak' ? 'Degraded (JVM 96% Saturation)'
            : id === 'gateway_rate_limit' ? 'Degraded (HTTP 429 RateLimit)'
            : id === 'db_pool_exhaustion' ? 'Elevated Latency' : 'Running',
          restarts: id === 'jvm_memory_leak' ? 1 : 0,
          cpu: id === 'jvm_memory_leak' ? '76%' : id === 'gateway_rate_limit' ? '64%' : '22%',
          mem: id === 'jvm_memory_leak' ? '970 MiB' : '410 MiB',
        },
        { name: 'instana-agent-xm204', ns: 'instana-agent', status: 'Running', restarts: 0, cpu: '0.6%', mem: '134 MiB' },
      ],
    },
    {
      id: 'node-2', name: 'ocp-worker-03.retail.internal', ip: '10.240.0.16', zone: 'us-south-3',
      cpu: id === 'cpu_throttling_eviction' ? 96 : loaded ? 45 : 19,
      mem: id === 'cpu_throttling_eviction' ? 91 : loaded ? 54 : 35,
      pods: id === 'cpu_throttling_eviction' ? 26 : 16, disk: id === 'cpu_throttling_eviction' ? 78 : 38,
      netIn: loaded ? 360 : 38, netOut: loaded ? 410 : 42,
      status: id === 'cpu_throttling_eviction' ? 'CPUPressure / Throttling' : 'Ready',
      hosted: [
        { name: 'order-service-3b1022-p442c', ns: 'retail-app', status: id === 'cpu_throttling_eviction' ? 'Degraded (12.8% CFS Throttling)' : 'Running', restarts: id === 'cpu_throttling_eviction' ? 3 : 0, cpu: id === 'cpu_throttling_eviction' ? '94%' : '15%', mem: id === 'cpu_throttling_eviction' ? '890 MiB' : '280 MiB' },
        { name: 'user-auth-service-4a1190-h881a', ns: 'retail-app', status: id === 'cpu_throttling_eviction' ? 'Slow Authentication' : 'Running', restarts: 0, cpu: id === 'cpu_throttling_eviction' ? '32%' : '8%', mem: '180 MiB' },
        { name: 'instana-agent-lb901', ns: 'instana-agent', status: 'Running', restarts: 0, cpu: '0.4%', mem: '124 MiB' },
      ],
    },
  ];

  // gateway_rate_limit is a warning-level scenario; the others are critical.
  const faultSeverity = id === 'gateway_rate_limit' ? 'warning' : 'critical';
  const SEV_RANK = { ok: 0, warning: 1, critical: 2 };

  const nodes = defs.map((d) => {
    const faulted = d.status !== 'Ready';
    const pods = d.hosted.map((p) => ({
      name: p.name,
      namespace: p.ns,
      cpuToLimitPct: pctNum(p.cpu),
      memToLimitPct: null,           // simulated pods carry absolute memory only
      mem: p.mem,
      status: p.status,
      restarts: p.restarts,
      restartsDelta: p.restarts,
      severity: podSeverity(p.status),
    })).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
    return {
      id: d.id,
      name: d.name,
      ip: d.ip,
      os: 'RHCOS 416.94',
      zone: d.zone,
      severity: faulted ? faultSeverity : 'ok',
      issues: faulted ? [{
        id: `sim-${d.id}`,
        severity: faultSeverity,
        text: d.status,
        fixSuggestion: sc ? `See Headless Bob RCA for ${sc.shortName}.` : null,
        start: null,
      }] : [],
      metrics: {
        cpuRequestedPct: d.cpu,
        memRequestedPct: d.mem,
        cpuLimitPct: d.cpu,
        podAllocationPct: Math.round((d.pods / 110) * 100),
        podsAllocated: d.pods,
        podsCapacity: 110,
        cpuCapacityCores: 16,
        memCapacityBytes: 64 * GIB,
      },
      mock: { diskPercent: d.disk, netInMbps: d.netIn, netOutMbps: d.netOut, agentStatus: 'Connected', kernel: '5.14.0-427.el9_4.x86_64' },
      pods,
      podSummary: {
        total: pods.length,
        critical: pods.filter((p) => p.severity === 'critical').length,
        warning: pods.filter((p) => p.severity === 'warning').length,
      },
    };
  });

  nodes.sort((x, y) => (SEV_RANK[y.severity] - SEV_RANK[x.severity])
    || (y.podSummary.critical - x.podSummary.critical)
    || (y.metrics.cpuRequestedPct - x.metrics.cpuRequestedPct));

  const clusterStatus = nodes.reduce((s, n) => (SEV_RANK[n.severity] > SEV_RANK[s] ? n.severity : s), 'ok');
  const avgCpu = Math.round(nodes.reduce((a, n) => a + n.metrics.cpuRequestedPct, 0) / nodes.length);
  const clusterName = 'ocp-prod-retail-cluster';

  return {
    ts: Date.now(),
    source: 'mock',
    simulated: true,
    windowSize: 900000,
    cluster: {
      name: clusterName,
      status: clusterStatus,
      nodesCount: nodes.length,
      podsMonitored: nodes.reduce((a, n) => a + n.pods.length, 0),
      podsTruncated: false,
      openIssues: nodes.reduce((a, n) => a + n.issues.length, 0),
      selection: 'query',
      mock: {
        version: 'Red Hat OpenShift v4.16.8',
        platform: 'IBM Cloud / OCP on VPC Gen2',
        region: 'us-south (Dallas)',
        agentOperator: 'instana-agent-operator v2.1.4',
        daemonSet: '3/3 Pods Ready & Monitoring',
        activeScenario: sc?.shortName || 'Baseline (Normal)',
        activeScenarioId: sc?.id || null,
        isLoaded: loaded,
      },
    },
    focusNodeId: nodes[0]?.id ?? null,
    nodes,
    clusters: [{ name: clusterName, nodesCount: nodes.length, cpuRequestedPct: avgCpu }],
    clustersTruncated: false,
    isStale: false,
    rateLimited: false,
  };
}

// ── Canned chat answers (simulated "Instana MCP" replies) ──────────────────

const BASELINE_TABLE = `| Service Name | Calls | Errors | Error Rate | P90 Latency | Mean Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **catalog-service** | 54,600 | 120 | 0.22% | 210 ms | 40 ms | 🟢 Healthy |
| **cart-service** | 38,900 | 68 | 0.17% | 240 ms | 45 ms | 🟢 Healthy |
| **order-service** | 31,200 | 94 | 0.30% | 320 ms | 60 ms | 🟢 Healthy |
| **payment-service** | 24,100 | 82 | 0.34% | 410 ms | 95 ms | 🟢 Healthy |
| **user-auth-service** | 28,250 | 352 | 1.25% | 190 ms | 30 ms | 🟢 Healthy |
| **shipping-service** | 12,400 | 42 | 0.34% | 380 ms | 85 ms | 🟢 Healthy |`;

const callsMetricsTool = (extraMetrics = []) => ({
  tool: 'manage_applications',
  input: {
    resource_type: 'metrics',
    operation: 'get_grouped_calls_metrics',
    params: {
      metrics: [{ metric: 'calls', aggregation: 'SUM' }, { metric: 'erroneousCalls', aggregation: 'SUM' }, ...extraMetrics],
      tag_filter_expression: { type: 'TAG_FILTER', name: 'application.name', operator: 'EQUALS', entity: 'DESTINATION', value: RETAIL_APP_NAME },
      group: { groupbyTag: 'service.name', groupbyTagEntity: 'DESTINATION' },
    },
  },
});

function buildMockAnswer(prompt) {
  const p = (prompt || '').toLowerCase();
  const tel = getCurrentTelemetry();
  const sc = getCurrentScenario();
  const active = isLoadedState && sc;
  let toolCalls;
  let answer;
  let criticalIssue = { detected: false, severity: 'healthy', summary: '' };

  if (p.includes('health') || (p.includes('retail') && p.includes('status'))) {
    toolCalls = [
      callsMetricsTool([{ metric: 'latency', aggregation: 'P90' }]),
      { tool: 'manage_events', input: { operation: 'get_events', params: { filters: { time_range: 'last 1 hour', event_type_filters: ['INCIDENT', 'ISSUE'], state: 'open' } } } },
    ];
    if (active) {
      criticalIssue = { detected: true, severity: 'critical', summary: `${sc.name}: ${sc.incidents[0]?.title}` };
      answer = `${SIM_TAG}

### 📊 Retail Application Observability Report (mock: ${sc.shortName})

| Service Name | Calls | Errors | Error Rate | P90 Latency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
${tel.services.map((s) => `| **${s.name}** | ${s.calls.toLocaleString()} | ${s.errors.toLocaleString()} | **${s.errorRate.toFixed(2)}%** | **${s.p90.toLocaleString()} ms** | ${s.errorRate >= 10 ? '🔴 Critical' : s.errorRate >= 3 ? '🟡 Warning' : '🟢 Healthy'} |`).join('\n')}

#### 🚨 Active Incidents & Issues
1. **[🔴 Critical]** \`${tel.incidents[0]?.id}\`: ${tel.incidents[0]?.title}
${tel.issues[0] ? `2. **[🟡 Warning]** \`${tel.issues[0]?.id}\`: ${tel.issues[0]?.title}` : ''}

<!--STATUS:{"hasCriticalIssues":true,"severity":"critical","summary":"${sc.shortName} active on Retail Application (mock)"}-->`;
    } else {
      answer = `${SIM_TAG}

### 📊 Retail Application Observability Report (mock baseline)

${BASELINE_TABLE}

- **Aggregate Error Rate**: **0.40%** (SLA target < 1.0%)
- **Top P90 Latency**: **410 ms** (\`payment-service\`)
- **Active Incidents**: **0 open incidents**`;
    }
  } else if (p.includes('trace') || p.includes('erroneous')) {
    toolCalls = [{
      tool: 'manage_applications',
      input: {
        resource_type: 'analyze',
        operation: 'get_all_traces',
        params: { payload: { timeFrame: { windowSize: 3600000 }, tagFilterExpression: { type: 'TAG_FILTER', name: 'call.erroneous', operator: 'EQUALS', entity: 'NOT_APPLICABLE', value: 'true' }, pagination: { retrievalSize: 10 } } },
      },
    }];
    if (active) {
      const svc = sc.affectedServices[0];
      criticalIssue = { detected: true, severity: 'critical', summary: `Erroneous traces captured for ${sc.shortName}` };
      answer = `${SIM_TAG}

### 🔍 Erroneous Traces Analysis — ${RETAIL_APP_NAME} (${sc.shortName})

| Trace ID | Age | Endpoint | Service | Status | Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| \`sim-tr-88f2190a\` | 2m ago | \`POST /api/v1/${svc.split('-')[0]}/execute\` | ${svc} | **HTTP 500** | ${sc.summary.topP90} ms |
| \`sim-tr-88f2190b\` | 3m ago | \`POST /api/v1/${svc.split('-')[0]}/verify\` | ${svc} | **HTTP 500** | ${(sc.summary.topP90 * 0.95).toFixed(0)} ms |
| \`sim-tr-99a4181c\` | 4m ago | \`POST /api/v1/checkout/process\` | ${sc.affectedServices[1] || 'order-service'} | **HTTP 504** | ${(sc.summary.topP90 * 0.75).toFixed(0)} ms |

Root failure location: \`${svc}\`; upstream services show cascading delays.

<!--STATUS:{"hasCriticalIssues":true,"severity":"critical","summary":"Erroneous traces on ${svc} (mock)"}-->`;
    } else {
      answer = `${SIM_TAG}

### 🔍 Erroneous Traces Analysis — ${RETAIL_APP_NAME} (mock baseline)

- **Erroneous Traces**: **758** of 189,450 (0.40%)
- Top non-200 responses: \`GET /api/v1/auth/verify\` HTTP 401 (352), \`GET /api/v1/products/{id}\` HTTP 404 (120), \`POST /api/v1/cart/add\` HTTP 400 (68)

No HTTP 5xx server-side failures in the baseline.`;
    }
  } else {
    toolCalls = [callsMetricsTool()];
    if (active) {
      criticalIssue = { detected: true, severity: 'critical', summary: `Degradation detected under ${sc.name}` };
      answer = `${SIM_TAG}

The ${RETAIL_APP_NAME} is degraded (mock scenario **${sc.shortName}**):
- **Overall Error Rate**: **${tel.summary.overallErrorRate}%** (${sc.services[0].name}: **${sc.services[0].errorRate}%**)
- **Active Incident**: \`${tel.incidents[0]?.id}\` — ${tel.incidents[0]?.title}

<!--STATUS:{"hasCriticalIssues":true,"severity":"critical","summary":"${sc.shortName} active (mock)"}-->`;
    } else {
      answer = `${SIM_TAG}

- **Overall Health**: Healthy (0 open incidents)
- **Throughput**: 189,450 calls
- **Average Error Rate**: 0.40% (within 1.0% SLA)`;
    }
  }

  return { answer, toolCalls, iterations: toolCalls.length, criticalIssue, simulated: true };
}

// ── Router ─────────────────────────────────────────────────────────────────

export function createMockRouter() {
  const router = express.Router();
  const sseClients = new Set();

  const broadcast = (event) => {
    const data = `data: ${JSON.stringify({ simulated: true, ...event })}\n\n`;
    for (const res of sseClients) {
      try { res.write(data); } catch { sseClients.delete(res); }
    }
  };

  const alertEvent = (sc, tel, intro) => ({
    type: 'alert',
    ts: Date.now(),
    severity: 'critical',
    errorRate: tel.summary.overallErrorRate,
    p90Latency: tel.summary.topP90,
    hasOpenIncidents: true,
    scenarioId: sc.id,
    scenarioName: sc.name,
    source: 'mock',
    message: `🧪 **MOCK ALERT** · 🔴 **CRITICAL ANOMALY: ${RETAIL_APP_NAME}**

${intro}
- **Scenario**: ${sc.shortName}
- **Affected Microservices**: ${sc.affectedServices.map((s) => `\`${s}\``).join(', ')}
- **Overall Error Rate**: **${tel.summary.overallErrorRate}%** (Threshold: 3.00%)
- **Top P90 Latency**: **${tel.summary.topP90} ms**
- **Incident**: \`${tel.incidents[0]?.id}\` — ${tel.incidents[0]?.title}

{"severity":"critical","errorRate":${tel.summary.overallErrorRate},"p90Latency":${tel.summary.topP90},"hasIncidents":true}`,
  });

  const okEvent = (tel, message) => ({
    type: 'status_tick',
    ts: Date.now(),
    severity: 'ok',
    errorRate: tel.summary.overallErrorRate,
    p90Latency: tel.summary.topP90,
    hasOpenIncidents: false,
    source: 'mock',
    message: `🧪 Mock: ${message}`,
  });

  // Periodic monitor tick: re-announce the active scenario every 60 s.
  const ticker = setInterval(() => {
    const sc = getCurrentScenario();
    if (isLoadedState && sc && sseClients.size > 0) {
      broadcast(alertEvent(sc, getCurrentTelemetry(), 'Autonomous Health Monitor (mock) sees sustained degradation.'));
    }
  }, 60_000);
  ticker.unref();

  router.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      streamMode: 'mock',
      simulated: true,
      // No MCP server is started in mock mode; do not claim a connection.
      mcpConnected: false,
      toolCount: 0,
      instanaUrl: 'mock',
      bobApiBase: 'mock',
      bobModel: 'mock',
      applicationScoped: RETAIL_APP_NAME,
      isLoaded: isLoadedState,
      activeScenario: currentScenarioId,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/api/scenarios', (req, res) => {
    res.json({
      simulated: true,
      activeScenarioId: currentScenarioId,
      isLoaded: isLoadedState,
      scenarios: SCENARIOS.map((s) => ({
        id: s.id, name: s.name, shortName: s.shortName, icon: s.icon,
        description: s.description, affectedServices: s.affectedServices, summary: s.summary,
      })),
    });
  });

  router.get('/api/insights', (req, res) => {
    const windowMs = parseInt(req.query.window, 10) || 3600000;
    res.json({ ...getCurrentTelemetry(windowMs), source: 'mock', simulated: true });
  });

  router.get('/api/infrastructure/digital-twin', (req, res) => res.json(buildMockTwin()));

  router.post('/api/demo/load-data', (req, res) => {
    const known = SCENARIOS.some((s) => s.id === req.body?.scenarioId);
    if (req.body?.scenarioId && !known) {
      return res.status(400).json({ error: `Unknown scenarioId. Valid: ${SCENARIOS.map((s) => s.id).join(', ')}` });
    }
    const sc = setScenario(req.body?.scenarioId || 'db_pool_exhaustion');
    const tel = getCurrentTelemetry();
    broadcast(alertEvent(sc, tel, 'Anomaly injected by the demo operator.'));
    res.json({ ...tel, source: 'mock', simulated: true });
  });

  router.post('/api/demo/reset-data', (req, res) => {
    setScenario('baseline');
    const tel = getCurrentTelemetry();
    broadcast(okEvent(tel, 'traffic restored to normal baseline. All microservices operational.'));
    res.json({ ...tel, source: 'mock', simulated: true });
  });

  // ── Monitor / SSE ──
  let monitorRunning = true;   // the simulated monitor is always "on"

  router.get('/api/monitor/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'connected', running: monitorRunning, simulated: true, ts: Date.now() })}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 20_000);
    req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
  });

  router.post('/api/monitor/register', (req, res) => res.json({ registered: true, simulated: true }));
  router.delete('/api/monitor/register', (req, res) => res.json({ registered: false, simulated: true }));
  router.post('/api/monitor/start', (req, res) => {
    monitorRunning = true;
    broadcast({ type: 'monitor_started', ts: Date.now(), intervalMs: 60_000 });
    res.json({ running: true, intervalMs: 60_000, simulated: true });
  });
  router.post('/api/monitor/stop', (req, res) => {
    monitorRunning = false;
    broadcast({ type: 'monitor_stopped', ts: Date.now() });
    res.json({ running: false, simulated: true });
  });
  router.get('/api/monitor/status', (req, res) => {
    res.json({ running: monitorRunning, intervalMs: 60_000, clients: sseClients.size, simulated: true });
  });
  router.post('/api/monitor/check_now', (req, res) => {
    broadcast({ type: 'check_start', ts: Date.now() });
    setTimeout(() => {
      const sc = getCurrentScenario();
      const tel = getCurrentTelemetry();
      if (isLoadedState && sc) broadcast(alertEvent(sc, tel, 'Manual health check (mock).'));
      else broadcast(okEvent(tel, 'health evaluated — all services operational, error rate < 0.5%.'));
    }, 800);
    res.json({ status: 'check_initiated', simulated: true });
  });

  // ── Chat + RCA (canned, delayed to resemble real tool-calling latency) ──
  router.post('/api/prompt', async (req, res) => {
    if (!req.body?.prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });
    await new Promise((r) => setTimeout(r, 6500));
    res.json(buildMockAnswer(req.body.prompt));
  });

  router.post('/api/headlessbob/diagnose', async (req, res) => {
    await new Promise((r) => setTimeout(r, 6200));
    const sc = getCurrentScenario();
    const rca = sc?.rca ?? `### 🤖 Headless Bob — SRE Health Assessment

- **Target Application**: \`${RETAIL_APP_NAME}\`
- **Error Rate**: **0.40%** (Normal)
- **P90 Latency**: **410 ms** (within SLA)
- **Incidents**: 0 active

No remediation required at this time.`;
    res.json({ rca: `${SIM_TAG}\n\n${rca}`, source: 'mock', simulated: true });
  });

  // Live-only endpoints: reject explicitly rather than falling through to code
  // that needs an MCP connection.
  router.use(['/hb', '/api/tools', '/api/erroneous-rate'], (req, res) => {
    res.status(404).json({ error: 'Not available when STREAM_MODE=mock', streamMode: 'mock' });
  });

  return router;
}
