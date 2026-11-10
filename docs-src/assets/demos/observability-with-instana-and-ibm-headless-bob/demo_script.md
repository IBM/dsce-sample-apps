Jump to: [Act 1](#act-1--executive-overview--baseline-health) · [Act 2](#act-2--incident-injection) · [Act 3](#act-3--autonomous-sre-investigation) · [Act 4](#act-4--root-cause-analysis--headless-bob) · [Act 5](#act-5--recovery--reset) · [Act 6](#act-6--dual-mode-architecture--enterprise-extensibility)

---

## Act 1 — Executive Overview & Baseline Health

**Step 1 — Introduce the Platform**

1. Highlight **IBM Instana Observability | Autonomous SRE Platform**.
2. Point out the **GENAI SRE ENGINE** and **MOCK DATA** indicators.

**Step 2 — Show the Status Bar**

1. Highlight the active endpoint, the **claude-opus-4-5** model ID, and the connection status.

**Step 3 — Open Infrastructure Insights**

1. Click **☸️ Infrastructure Insights**.

**Step 4 — Showcase the Digital Twin**

1. Highlight the OpenShift cluster **ocp-production-us-south (4.14.18)**.
2. Show the three worker nodes and hosted microservice pods.
3. Highlight the animated blue connection splines.

**Step 5 — Show Node Telemetry**

1. Select **ocp-worker-01**.
2. Highlight the CPU, Memory, and Pod gauges (green, below 65%).

**Step 6 — Open Application Insights**

1. Click **📊 Application Insights Dashboard**.

**Step 7 — Highlight KPIs**

1. Total Calls: **284.5k**
2. Total Errors: **0.12%**
3. P90 Latency: **280ms**
4. Open Incidents: **0**

**Step 8 — Show Service Performance**

1. Highlight the performance table and sparklines for the **cart**, **catalog**, **payment**, and **shipping** services.

> **Talking point:** "We are monitoring a healthy production retail application on OpenShift. Instana continuously correlates infrastructure metrics with application traces."

---

## Act 2 — Incident Injection

**Step 9 — Open the Scenario Drawer**

1. Click **🧪 Select SRE Anomaly Scenario ▾**.
2. Showcase the five failure scenarios:
   - DB Connection Pool Exhaustion
   - Java JVM Memory Leak
   - Redis Cache Stampede
   - Payment Gateway Rate Limit
   - Kubernetes CPU Throttling

**Step 10 — Inject the Incident**

1. Select **Scenario 1: DB Connection Pool Exhaustion (shipping-service)**.
2. Click **Load Scenario**.

**Step 11 — Show Application Degradation**

1. Total Errors: **9,920**
2. Error Rate: **14%**
3. P90 Latency: **3,420ms**
4. Open Incidents: **1**
5. Highlight **shipping-service** in red.

**Step 12 — Show Infrastructure Impact**

1. Open **Infrastructure Insights**.
2. Highlight **ocp-worker-02** in red.
3. Show the **MemoryPressure** / **DB Lock** indicators and the critical pod connections.

> **Talking point:** "We simulated PostgreSQL connection pool exhaustion. The Digital Twin and application dashboard immediately reflect the incident."

---

## Act 3 — Autonomous SRE Investigation

**Step 13 — Open SRE Chat**

1. Click **🤖 Autonomous SRE Chat**.

**Step 14 — Submit a Health Query**

1. Enter: `What is the current health of Retail Application and what incidents are active?`

**Step 15 — Show Agent Execution**

1. Highlight the MCP connection and the rotating progress indicator.
2. Show the streaming AI response.

**Step 16 — Review the Health Report**

1. Highlight application health, error rates, latency, and active incidents.

**Step 17 — Inspect MCP Tool Calls**

1. Expand the **2 tool calls**.
2. Highlight:
   - `manage_applications` → `get_grouped_calls_metrics`
   - `manage_events` → `get_events`

**Step 18 — Explain Tenant Scoping**

1. Highlight the **Retail Application** filtering.
2. Explain the exclusion of unrelated application telemetry.

> **Talking point:** "The engineer uses natural language to investigate incidents. The AI agent invokes Instana MCP tools and returns a prioritized report with transparent execution logs."

---

## Act 4 — Root Cause Analysis – Headless Bob

**Step 19 — Trigger RCA**

1. Enter: `Perform a deep Root Cause Analysis on shipping-service and provide step-by-step remediation.`

**Step 20 — Review the Executive Summary**

1. Highlight the critical incident classification and failure mechanism.

**Step 21 — Identify the Root Cause**

1. Show the **PostgreSQL RDS HikariCP** pool saturation.
2. Highlight **10/10 active connections** and the **30-second timeout**.

**Step 22 — Assess Impact**

1. Show the impact on checkout, shipping, and payment verification.

**Step 23 — Review the Remediation Plan**

1. Increase the HikariCP pool: **10 → 50**.
2. Scale shipping-service replicas: **2 → 5**.
3. Configure PostgreSQL `idle_in_transaction_session_timeout = 5000ms`.

**Step 24 — Showcase the Headless Bob Monitor**

1. Highlight the 120px **HealthRing** gauge.
2. Show the live SSE events and token consumption metrics.

> **Talking point:** "Headless Bob identifies the HikariCP bottleneck and generates a prioritized remediation playbook."

---

## Act 5 — Recovery & Reset

**Step 25 — Open the Scenario Drawer**

1. Click **🧪 Select SRE Anomaly Scenario ▾**.

**Step 26 — Reset the Baseline**

1. Click **↺ Reset Baseline**.

**Step 27 — Verify Infrastructure Recovery**

1. Show the green worker nodes, resource gauges, and pod connections.

**Step 28 — Verify Application Recovery**

1. Confirm the error rate is below **0.2%** and there are **zero** open incidents.

**Step 29 — Validate Through SRE Chat**

1. Enter: `Check health status`.
2. Show the AI confirmation of application recovery.

> **Talking point:** "The application has returned to its healthy baseline. The AI agent validates that no active incidents remain."

---

## Act 6 — Dual-Mode Architecture & Enterprise Extensibility

**Step 30 — Introduce the Dual Modes**

1. Explain the two execution modes:
   - `STREAM_MODE=mock`
   - `STREAM_MODE=realtime`

**Step 31 — Explain Mock Mode**

1. Fully offline execution.
2. No external credentials.
3. Ideal for demos and workshops.

**Step 32 — Explain Real-Time Mode**

1. Configure:
   - `INSTANA_BASE_URL`
   - `INSTANA_API_TOKEN`
   - `BOB_API_KEY`

**Step 33 — Explain Instana MCP**

1. The Express bridge launches `mcp-instana` over STDIO.
2. It discovers 11 enterprise APM tools.
3. It retrieves live telemetry and incidents.

**Step 34 — Explain IBM Bob**

1. Connects to the IBM Bob Inference API.
2. Uses **claude-opus-4-5** for AI-powered investigation and RCA.

**Step 35 — Explain Streaming & Caching**

1. SSE streams live events.
2. 30-second TTL KPI caching optimizes API calls.

**Step 36 — Close with Business Value**

1. Continuous observability.
2. AI-powered incident investigation.
3. Automated RCA generation.
4. Prioritized remediation.
5. Faster incident resolution.
6. Extensible enterprise architecture.
