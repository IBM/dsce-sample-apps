// In-memory telemetry state & multi-scenario simulation engine for Retail Application

export let currentScenarioId = null; // null = baseline, or scenario id string
export let isLoadedState = false;

export const SCENARIOS = [
  {
    id: 'db_pool_exhaustion',
    name: 'Scenario 1: DB Connection Pool Exhaustion (shipping-service)',
    shortName: 'DB Pool Exhaustion (shipping-service)',
    icon: '🐘',
    description: 'PostgreSQL RDS connection pool saturated (10/10), causing thread contention and 14% HTTP 500/504 errors on dispatch APIs.',
    affectedServices: ['shipping-service', 'payment-service'],
    primaryNodeId: 'node-1',
    summary: {
      totalCalls: 284500,
      totalErrors: 9920,
      overallErrorRate: 3.49,
      topP90: 3420,
      openIncidents: 1,
      openIssues: 1,
    },
    services: [
      { name: 'shipping-service', calls: 42100, errors: 5890, errorRate: 14.00, p90: 3420, mean: 890 },
      { name: 'payment-service',  calls: 61200, errors: 2940, errorRate: 4.80,  p90: 1850, mean: 380 },
      { name: 'order-service',    calls: 45800, errors: 680,  errorRate: 1.48,  p90: 890,  mean: 140 },
      { name: 'cart-service',     calls: 41200, errors: 140,  errorRate: 0.34,  p90: 310,  mean: 50 },
      { name: 'catalog-service',  calls: 68900, errors: 210,  errorRate: 0.30,  p90: 280,  mean: 45 },
      { name: 'user-auth-service',calls: 25300, errors: 60,   errorRate: 0.24,  p90: 180,  mean: 30 },
    ],
    incidents: [
      {
        id: 'inc-retail-8849',
        title: 'shipping-service - High Erroneous Call Rate (14.0%) & DB Connection Pool Saturation',
        severity: 'critical',
        entity: 'shipping-service (retail-app/shipping-service-7f8849)',
        start: Date.now() - 6 * 60 * 1000,
      },
    ],
    issues: [
      {
        id: 'iss-retail-9921',
        title: 'payment-service - Latency SLA Violation (P90: 1,850ms > threshold: 1,500ms)',
        severity: 'warning',
        entity: 'payment-service (retail-app/payment-service-5d9921)',
        start: Date.now() - 14 * 60 * 1000,
      },
    ],
    nodeOverrides: {
      'node-1': {
        status: 'MemoryPressure / Anomaly',
        metrics: { cpuPercent: 86, memoryPercent: 89, podsRunning: 24, maxPods: 110, diskPercent: 68, netInMbps: 480, netOutMbps: 520 },
      },
    },
    rca: `### 🔍 Autonomous SRE Root Cause Analysis (Headless Bob)

**Target**: \`shipping-service\` (Namespace: \`retail-app\` on OpenShift Node: \`ocp-worker-02\`)
**Triggering Incident**: \`inc-retail-8849\` (Severity: **Critical**)

---

#### 1. Symptom & Impact Analysis
- **Error Rate Spiked**: **14.0%** of calls to \`POST /api/v1/shipping/dispatch\` failing with \`HTTP 500 Internal Server Error\` and \`HTTP 504 Gateway Timeout\`.
- **Latency Degradation**: P90 latency increased from **380ms** baseline to **3,420ms**.
- **Upstream Cascade**: \`payment-service\` and checkout confirmation transactions experiencing backpressure delays.

#### 2. Root Cause Identification
- **Bottleneck**: PostgreSQL RDS connection pool in \`HikariCP\` exhausted (**10/10 active connections utilized**).
- **Thread Lock**: Worker threads blocked on \`getConnection()\` wait queues exceeding the default 30,000ms timeout.
- **Trace Evidence**: Span \`postgres.query: SELECT * FROM shipping_zones\` shows average execution queue latency of **2,940ms**.

#### 3. Recommended Remediation
1. **Immediate**: Increase connection pool size from \`10\` to \`50\` in \`shipping-service\` ConfigMap.
2. **Kubernetes Action**: Scale \`shipping-service\` replicas from \`2\` to \`5\` to distribute connection load.
3. **Database Tuning**: Configure \`idle_in_transaction_session_timeout = 5000ms\` on PostgreSQL instance.`,
  },

  {
    id: 'jvm_memory_leak',
    name: 'Scenario 2: Java JVM Memory Leak & Stop-the-World GC (payment-service)',
    shortName: 'JVM Memory Leak (payment-service)',
    icon: '☕',
    description: 'Unbounded heap allocation in PaymentSessionCache causes 96% Old Gen memory saturation and 4.8s Stop-the-World GC pauses.',
    affectedServices: ['payment-service', 'order-service'],
    primaryNodeId: 'node-1',
    summary: {
      totalCalls: 295000,
      totalErrors: 11200,
      overallErrorRate: 3.79,
      topP90: 5120,
      openIncidents: 1,
      openIssues: 1,
    },
    services: [
      { name: 'payment-service',  calls: 64500, errors: 10450, errorRate: 16.20, p90: 5120, mean: 1240 },
      { name: 'order-service',    calls: 48900, errors: 2005,  errorRate: 4.10,  p90: 1450, mean: 290 },
      { name: 'shipping-service', calls: 39100, errors: 120,   errorRate: 0.31,  p90: 390,  mean: 80 },
      { name: 'cart-service',     calls: 43200, errors: 95,    errorRate: 0.22,  p90: 250,  mean: 45 },
      { name: 'catalog-service',  calls: 71200, errors: 180,   errorRate: 0.25,  p90: 270,  mean: 40 },
      { name: 'user-auth-service',calls: 28100, errors: 60,    errorRate: 0.21,  p90: 190,  mean: 30 },
    ],
    incidents: [
      {
        id: 'inc-retail-9104',
        title: 'payment-service - Critical JVM Heap Saturation (96%) & Stop-the-World Major GC Pauses',
        severity: 'critical',
        entity: 'payment-service (retail-app/payment-service-5d9921)',
        start: Date.now() - 8 * 60 * 1000,
      },
    ],
    issues: [
      {
        id: 'iss-retail-9105',
        title: 'order-service - Downstream Payment Dependency Timeout',
        severity: 'warning',
        entity: 'order-service (retail-app/order-service-3b1022)',
        start: Date.now() - 5 * 60 * 1000,
      },
    ],
    nodeOverrides: {
      'node-1': {
        status: 'MemoryPressure / JVM Leak',
        metrics: { cpuPercent: 78, memoryPercent: 95, podsRunning: 24, maxPods: 110, diskPercent: 55, netInMbps: 390, netOutMbps: 410 },
      },
    },
    rca: `### 🔍 Autonomous SRE Root Cause Analysis (Headless Bob)

**Target**: \`payment-service\` (Namespace: \`retail-app\` on OpenShift Node: \`ocp-worker-02\`)
**Triggering Incident**: \`inc-retail-9104\` (Severity: **Critical**)

---

#### 1. Symptom & Impact Analysis
- **Service Failure**: **16.2%** error rate on \`POST /api/v1/payment/process\` with socket read timeouts.
- **Extreme Latency Spike**: P90 latency climbed to **5,120ms** due to recurring Java GC pauses.
- **JVM Heap Telemetry**: Instana JVM Sensor reports Old Gen memory usage at **96.4%** with GC pauses lasting **4,820ms**.

#### 2. Root Cause Identification
- **Memory Leak**: \`PaymentSessionCache\` static concurrent hash map retaining unevicted user payment tokens without TTL expiration.
- **Garbage Collection Lock**: G1GC triggering continuous concurrent mark failures, leading to Full Stop-the-World garbage collections.

#### 3. Recommended Remediation
1. **Immediate**: Perform zero-downtime rolling restart of \`payment-service\` pods on OpenShift.
2. **Code Fix**: Replace unbound static HashMap with Guava/Caffeine cache with a 15-minute \`expireAfterWrite\` eviction policy.
3. **JVM Tuning**: Update container args with \`-XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError\`.`,
  },

  {
    id: 'redis_cache_failure',
    name: 'Scenario 3: Redis Cache Stampede & Thundering Herd (cart-service)',
    shortName: 'Redis Cache Stampede (cart-service)',
    icon: '⚡',
    description: 'Redis cache shard eviction triggers cache stampede; thousands of concurrent cart requests flood catalog backend database.',
    affectedServices: ['cart-service', 'catalog-service'],
    primaryNodeId: 'node-0',
    summary: {
      totalCalls: 310000,
      totalErrors: 13500,
      overallErrorRate: 4.35,
      topP90: 3890,
      openIncidents: 1,
      openIssues: 1,
    },
    services: [
      { name: 'cart-service',     calls: 68900, errors: 12740, errorRate: 18.50, p90: 3890, mean: 920 },
      { name: 'catalog-service',  calls: 98400, errors: 5310,  errorRate: 5.40,  p90: 1620, mean: 310 },
      { name: 'payment-service',  calls: 31200, errors: 98,    errorRate: 0.31,  p90: 420,  mean: 90 },
      { name: 'shipping-service', calls: 22100, errors: 70,    errorRate: 0.32,  p90: 390,  mean: 85 },
      { name: 'order-service',    calls: 41200, errors: 110,   errorRate: 0.27,  p90: 310,  mean: 55 },
      { name: 'user-auth-service',calls: 48200, errors: 150,   errorRate: 0.31,  p90: 200,  mean: 35 },
    ],
    incidents: [
      {
        id: 'inc-retail-7312',
        title: 'cart-service - Redis Cache Shard Eviction & Thundering Herd Anomaly',
        severity: 'critical',
        entity: 'cart-service (retail-app/cart-service-1e8831)',
        start: Date.now() - 4 * 60 * 1000,
      },
    ],
    issues: [
      {
        id: 'iss-retail-7313',
        title: 'catalog-service - High DB Read Latency under Cache Miss Storm',
        severity: 'warning',
        entity: 'catalog-service (retail-app/catalog-service-9c4110)',
        start: Date.now() - 4 * 60 * 1000,
      },
    ],
    nodeOverrides: {
      'node-0': {
        status: 'CPUPressure / Cache Storm',
        metrics: { cpuPercent: 91, memoryPercent: 82, podsRunning: 22, maxPods: 110, diskPercent: 74, netInMbps: 580, netOutMbps: 620 },
      },
    },
    rca: `### 🔍 Autonomous SRE Root Cause Analysis (Headless Bob)

**Target**: \`cart-service\` & \`catalog-service\` (Namespace: \`retail-app\` on OpenShift Node: \`ocp-worker-01\`)
**Triggering Incident**: \`inc-retail-7312\` (Severity: **Critical**)

---

#### 1. Symptom & Impact Analysis
- **Service Failure**: **18.5%** failure rate on Cart item additions and session lookups.
- **Cache Hit Rate Collapse**: Redis cluster hit rate dropped from **98.4%** down to **28.1%**.
- **Cascading Overload**: \`catalog-service\` database saturated with 12,000 queries/sec of uncached catalog metadata reads.

#### 2. Root Cause Identification
- **Cache Stampede**: Key TTL on high-velocity promotional products expired simultaneously across all cart pods without probabilistic early recomputation (XFetch / Mutex lock).
- **Thundering Herd**: Hundreds of concurrent pod threads bypassed cache and flooded the backing datastore.

#### 3. Recommended Remediation
1. **Immediate**: Warm up Redis cache keys with batch pre-population script.
2. **Code Fix**: Implement distributed Mutex locks (e.g. Redlock) on cache misses so only 1 thread recomputes missing keys.
3. **Redis Config**: Increase Redis memory allocation and enable jitter on cache TTLs: \`TTL = base_ttl + rand(0, 300)s\`.`,
  },

  {
    id: 'gateway_rate_limit',
    name: 'Scenario 4: 3rd-Party Payment Gateway Rate Limit & HTTP 429 (payment-service)',
    shortName: 'Stripe Gateway Rate Limit (payment-service)',
    icon: '💳',
    description: 'External payment gateway API enforces strict rate limiting, returning HTTP 429 and exhausting payment thread pools.',
    affectedServices: ['payment-service', 'order-service'],
    primaryNodeId: 'node-1',
    summary: {
      totalCalls: 278000,
      totalErrors: 14800,
      overallErrorRate: 5.32,
      topP90: 6200,
      openIncidents: 1,
      openIssues: 1,
    },
    services: [
      { name: 'payment-service',  calls: 58200, errors: 12800, errorRate: 22.00, p90: 6200, mean: 1450 },
      { name: 'order-service',    calls: 46200, errors: 3920,  errorRate: 8.50,  p90: 2800, mean: 510 },
      { name: 'shipping-service', calls: 32100, errors: 90,    errorRate: 0.28,  p90: 380,  mean: 85 },
      { name: 'cart-service',     calls: 39800, errors: 75,    errorRate: 0.19,  p90: 240,  mean: 45 },
      { name: 'catalog-service',  calls: 64200, errors: 140,   errorRate: 0.22,  p90: 220,  mean: 40 },
      { name: 'user-auth-service',calls: 37500, errors: 80,    errorRate: 0.21,  p90: 190,  mean: 30 },
    ],
    incidents: [
      {
        id: 'inc-retail-6209',
        title: 'payment-service - Upstream 3rd-Party Gateway HTTP 429 Rate Limit Saturation',
        severity: 'critical',
        entity: 'payment-service (retail-app/payment-service-5d9921)',
        start: Date.now() - 10 * 60 * 1000,
      },
    ],
    issues: [
      {
        id: 'iss-retail-6210',
        title: 'order-service - Order Checkout Processing Backpressure Queue Full',
        severity: 'warning',
        entity: 'order-service (retail-app/order-service-3b1022)',
        start: Date.now() - 7 * 60 * 1000,
      },
    ],
    nodeOverrides: {
      'node-1': {
        status: 'NetworkQueue / Gateway Timeout',
        metrics: { cpuPercent: 65, memoryPercent: 78, podsRunning: 24, maxPods: 110, diskPercent: 52, netInMbps: 540, netOutMbps: 580 },
      },
    },
    rca: `### 🔍 Autonomous SRE Root Cause Analysis (Headless Bob)

**Target**: \`payment-service\` (Namespace: \`retail-app\` on OpenShift Node: \`ocp-worker-02\`)
**Triggering Incident**: \`inc-retail-6209\` (Severity: **Critical**)

---

#### 1. Symptom & Impact Analysis
- **Service Failure**: **22.0%** of customer payment authorizations failing with \`HTTP 429 Too Many Requests\` and \`HTTP 504 Gateway Timeout\`.
- **Extreme Latency**: P90 checkout latency spiked to **6,200ms**.
- **Customer Impact**: Checkout orders unable to complete credit card settlement.

#### 2. Root Cause Identification
- **External Rate Limit**: Upstream Payment Gateway provider (Stripe API) enforcing hard tier rate limit of 100 req/sec per API key.
- **Lack of Circuit Breaker**: \`payment-service\` retried synchronously without exponential backoff or jitter, amplifying the rate limit penalty.

#### 3. Recommended Remediation
1. **Immediate**: Engage Payment Gateway provider to temporarily lift TPS ceiling to 500 req/sec.
2. **Circuit Breaker**: Enable Resilience4j CircuitBreaker with 50% failure threshold and 10s open-state cooldown.
3. **Async Queueing**: Offload non-blocking payment authorization to IBM MQ background queue with client status polling.`,
  },

  {
    id: 'cpu_throttling_eviction',
    name: 'Scenario 5: OpenShift Node CPU Throttling & Pod Eviction (order-service)',
    shortName: 'CPU Throttling & Pod Evictions (order-service)',
    icon: '🔥',
    description: 'Order processing burst exceeds Linux CFS CPU quotas; worker node suffers severe CPU throttling and 3 container restarts.',
    affectedServices: ['order-service', 'user-auth-service'],
    primaryNodeId: 'node-2',
    summary: {
      totalCalls: 325000,
      totalErrors: 15600,
      overallErrorRate: 4.80,
      topP90: 4100,
      openIncidents: 1,
      openIssues: 1,
    },
    services: [
      { name: 'order-service',    calls: 78500, errors: 10050, errorRate: 12.80, p90: 4100, mean: 890 },
      { name: 'user-auth-service',calls: 51200, errors: 1640,  errorRate: 3.20,  p90: 980,  mean: 180 },
      { name: 'payment-service',  calls: 42100, errors: 180,   errorRate: 0.43,  p90: 440,  mean: 95 },
      { name: 'shipping-service', calls: 28900, errors: 85,    errorRate: 0.29,  p90: 380,  mean: 85 },
      { name: 'cart-service',     calls: 46200, errors: 90,    errorRate: 0.19,  p90: 240,  mean: 45 },
      { name: 'catalog-service',  calls: 78100, errors: 160,   errorRate: 0.20,  p90: 210,  mean: 40 },
    ],
    incidents: [
      {
        id: 'inc-retail-5510',
        title: 'order-service - Severe Linux CFS CPU Throttling (94%) & Pod CrashLoopBackOff',
        severity: 'critical',
        entity: 'order-service (retail-app/order-service-3b1022)',
        start: Date.now() - 5 * 60 * 1000,
      },
    ],
    issues: [
      {
        id: 'iss-retail-5511',
        title: 'ocp-worker-03 - High Node CPU Utilization (>94%)',
        severity: 'warning',
        entity: 'ocp-worker-03.retail.internal (Kubernetes Node)',
        start: Date.now() - 5 * 60 * 1000,
      },
    ],
    nodeOverrides: {
      'node-2': {
        status: 'CPUPressure / Throttling',
        metrics: { cpuPercent: 96, memoryPercent: 91, podsRunning: 26, maxPods: 110, diskPercent: 78, netInMbps: 510, netOutMbps: 540 },
      },
    },
    rca: `### 🔍 Autonomous SRE Root Cause Analysis (Headless Bob)

**Target**: \`order-service\` (Namespace: \`retail-app\` on OpenShift Node: \`ocp-worker-03\`)
**Triggering Incident**: \`inc-retail-5510\` (Severity: **Critical**)

---

#### 1. Symptom & Impact Analysis
- **Service Failure**: **12.8%** of order creation requests failing with HTTP 503 & connection resets.
- **Node Saturation**: OpenShift Worker \`ocp-worker-03\` CPU pinned at **96%**.
- **Pod Health**: 3 container restarts recorded on \`order-service-3b1022\` with \`OOMKilled\` / \`Evicted\` events.

#### 2. Root Cause Identification
- **CFS Quota Throttling**: Kubernetes CPU limit set aggressively low (\`500m\`), resulting in **84% CFS throttling** during bulk order processing bursts.
- **Resource Starvation**: Node-level CPU starvation prevented liveness probe execution, causing OpenShift kubelet to prematurely terminate pods.

#### 3. Recommended Remediation
1. **Immediate**: Increase \`order-service\` CPU limit in deployment spec from \`500m\` to \`2000m\` (2 vCPU).
2. **Horizontal Pod Autoscaling**: Configure OpenShift HPA with \`minReplicas: 3\`, \`maxReplicas: 10\`, targeting 70% CPU utilization.
3. **Pod Anti-Affinity**: Distribute \`order-service\` pods across \`ocp-worker-01\`, \`02\`, and \`03\` to prevent single-node hotspotting.`,
  },
];

export const BASELINE_STATE = {
  ts: Date.now(),
  windowSize: 3600000,
  summary: {
    totalCalls: 189450,
    totalErrors: 758,
    overallErrorRate: 0.40,
    topP90: 410,
    openIncidents: 0,
    openIssues: 0,
  },
  services: [
    { name: 'payment-service',  calls: 24100, errors: 82,  errorRate: 0.34, p90: 410, mean: 95 },
    { name: 'shipping-service', calls: 12400, errors: 42,  errorRate: 0.34, p90: 380, mean: 85 },
    { name: 'order-service',    calls: 31200, errors: 94,  errorRate: 0.30, p90: 320, mean: 60 },
    { name: 'cart-service',     calls: 38900, errors: 68,  errorRate: 0.17, p90: 240, mean: 45 },
    { name: 'catalog-service',  calls: 54600, errors: 120, errorRate: 0.22, p90: 210, mean: 40 },
    { name: 'user-auth-service',calls: 28250, errors: 352, errorRate: 1.25, p90: 190, mean: 30 },
  ],
  incidents: [],
  issues: [],
};

export function setScenario(scenarioId) {
  if (!scenarioId || scenarioId === 'baseline') {
    currentScenarioId = null;
    isLoadedState = false;
    return null;
  }
  const match = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  currentScenarioId = match.id;
  isLoadedState = true;
  return match;
}

export function getCurrentScenario() {
  if (!isLoadedState || !currentScenarioId) return null;
  return SCENARIOS.find((s) => s.id === currentScenarioId) || SCENARIOS[0];
}

export function scaleTelemetryForWindow(base, windowMs = 3600000) {
  const baseWindow = base.windowSize || 3600000;
  const ratio = Math.max(0.02, windowMs / baseWindow);

  // Timeframe dynamics:
  // Short windows (5m, 15m) capture acute peak incident metrics
  // Long windows (3h, 24h) include pre-incident historical averages
  let errorRateMultiplier = 1.0;
  let latencyMultiplier = 1.0;

  if (windowMs <= 300000) {         // 5m
    errorRateMultiplier = 1.28;
    latencyMultiplier = 1.22;
  } else if (windowMs <= 900000) {  // 15m
    errorRateMultiplier = 1.12;
    latencyMultiplier = 1.10;
  } else if (windowMs <= 3600000) { // 1h (baseline reference)
    errorRateMultiplier = 1.00;
    latencyMultiplier = 1.00;
  } else if (windowMs <= 10800000) {// 3h
    errorRateMultiplier = 0.62;
    latencyMultiplier = 0.70;
  } else {                          // 24h
    errorRateMultiplier = 0.25;
    latencyMultiplier = 0.38;
  }

  const isHealthy = !base.scenario;

  const services = (base.services || []).map((svc) => {
    const scaledCalls = Math.max(10, Math.round(svc.calls * ratio));
    
    let adjustedErrRate = isHealthy
      ? +(svc.errorRate * (windowMs > 3600000 ? 1.08 : 0.92)).toFixed(2)
      : +(svc.errorRate * (svc.errorRate > 1.0 ? errorRateMultiplier : 1.0)).toFixed(2);

    adjustedErrRate = Math.min(99.0, Math.max(0.04, adjustedErrRate));
    const scaledErrors = Math.round((adjustedErrRate / 100) * scaledCalls);

    const adjustedP90 = Math.max(
      60,
      Math.round(
        isHealthy
          ? svc.p90 * (windowMs <= 300000 ? 0.90 : windowMs >= 86400000 ? 1.10 : 1.0)
          : svc.p90 * (svc.p90 > 600 ? latencyMultiplier : 1.0)
      )
    );

    const adjustedMean = Math.max(
      20,
      Math.round(
        isHealthy
          ? svc.mean
          : svc.mean * (svc.p90 > 600 ? latencyMultiplier : 1.0)
      )
    );

    return {
      ...svc,
      calls: scaledCalls,
      errors: scaledErrors,
      errorRate: adjustedErrRate,
      p90: adjustedP90,
      mean: adjustedMean,
    };
  });

  const totalCalls = services.reduce((acc, s) => acc + s.calls, 0);
  const totalErrors = services.reduce((acc, s) => acc + s.errors, 0);
  const overallErrorRate = totalCalls > 0 ? +((totalErrors / totalCalls) * 100).toFixed(2) : 0;
  const topP90 = services.length > 0 ? Math.max(...services.map((s) => s.p90)) : base.summary.topP90;

  return {
    ...base,
    ts: Date.now(),
    windowSize: windowMs,
    summary: {
      ...base.summary,
      totalCalls,
      totalErrors,
      overallErrorRate,
      topP90,
    },
    services,
  };
}

export function getCurrentTelemetry(windowMs = 3600000) {
  const sc = getCurrentScenario();
  let baseData;
  if (sc) {
    baseData = {
      ts: Date.now(),
      windowSize: 3600000,
      summary: sc.summary,
      services: sc.services,
      incidents: sc.incidents,
      issues: sc.issues,
      scenario: {
        id: sc.id,
        name: sc.name,
        shortName: sc.shortName,
        icon: sc.icon,
        description: sc.description,
      },
    };
  } else {
    baseData = {
      ...BASELINE_STATE,
      ts: Date.now(),
    };
  }
  return scaleTelemetryForWindow(baseData, windowMs);
}
