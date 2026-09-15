# SRE Copilot — Full Documentation

> An AI-powered Site Reliability Engineering assistant built on **IBM watsonx Orchestrate** that analyzes IT infrastructure incidents in real time — performing root cause analysis, severity classification, and generating step-by-step remediation runbooks.

---

## Table of Contents

1. [What Is SRE Copilot?](#1-what-is-sre-copilot)
2. [Architecture Overview](#2-architecture-overview)
3. [How It Works — End to End](#3-how-it-works--end-to-end)
4. [The watsonx Orchestrate Agent](#4-the-watsonx-orchestrate-agent)
5. [Features & Functionality](#5-features--functionality)
6. [Incident Data](#6-incident-data)
7. [Admin Panel](#7-admin-panel)
8. [Agent Controls](#8-agent-controls)
9. [Tech Stack](#9-tech-stack)
10. [Project Structure](#10-project-structure)
11. [Environment Variables](#11-environment-variables)
12. [Setup & Deployment](#12-setup--deployment)
13. [API Reference](#13-api-reference)
14. [Demo Script](#14-demo-script)

---

## 1. What Is SRE Copilot?

SRE Copilot is a full-stack demo application that showcases the power of **IBM watsonx Orchestrate** AI agents in an IT Operations context. It simulates a real-world incident management platform where on-call engineers can:

- **View** incoming IT infrastructure incidents on a Kanban board
- **Analyze** any incident with a single click — an AI agent performs the full investigation
- **Chat** with the agent to ask follow-up questions about the incident
- **Resolve** incidents and track their lifecycle from detection to resolution
- **Manage** agent safety controls and board state via a password-gated Admin Panel

The demo is designed for **client-facing presentations** — it looks and feels like a production-grade enterprise AIOps tool, built with IBM Carbon Design System for visual authenticity.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (localhost:3000)                  │
│                    React SPA — IBM Carbon Design System          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────────┐
│                    Nginx Reverse Proxy (Podman)                  │
│           /* → React static files                               │
│           /api/* → FastAPI backend                              │
└──────┬──────────────────────────────────────────────────────────┘
       │ /api/*
┌──────▼───────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                        │
│   • In-memory incident store                                     │
│   • WXO SDK client (IAM auth, UUID resolution, run polling)      │
│   • Admin config + agent controls management                     │
└──────┬───────────────────────────────────────────────────────────┘
       │ watsonx Orchestrate SDK
┌──────▼───────────────────────────────────────────────────────────┐
│              IBM watsonx Orchestrate (IBM Cloud)                  │
│   Agent: incident_resolution_agent (SRE Copilot)                 │
│   Tool:  analyze_incident                                        │
│   Controls: PII Filter · Content Guardrails · Secrets Detector   │
└──────────────────────────────────────────────────────────────────┘
```

Both the **Nginx** (serving the React frontend) and **FastAPI backend** run as containers managed by Podman Compose. The watsonx Orchestrate agent is deployed separately to IBM Cloud using the ADK CLI.

---

## 3. How It Works — End to End

### Incident Analysis Flow

```
User clicks "Analyze"
        │
        ▼
Frontend → POST /api/incidents/analyze  { incident_id: "INC-001" }
        │
        ▼
Backend looks up incident from in-memory store
        │
        ▼
Backend builds structured prompt:
  "Incident ID: INC-001
   Title: Payment Service CrashLoopBackOff
   Severity: Critical
   Affected Service: payment-service
   Log Output: [raw logs]
   Please analyze..."
        │
        ▼
WXO SDK → IAM token exchange (API key → Bearer token)
        │
        ▼
WXO SDK → Resolve agent name "incident_resolution_agent" → UUID
        │
        ▼
RunClient.create_run(message=prompt, agent_id=uuid)
        │
        ▼
Poll: wait_for_run_completion(poll_interval=2s, max_retries=60)
        │
        ▼
ThreadsClient.get_thread_messages(thread_id)
        │
        ▼
Extract assistant message text
        │
        ▼
Parse sections: ROOT CAUSE / SEVERITY CLASSIFICATION / REMEDIATION STEPS
        │
        ▼
Return AnalysisResult JSON → Frontend renders in Analysis Drawer
```

### Follow-up Chat Flow

```
User types question in chat input
        │
        ▼
Frontend → POST /api/incidents/{id}/chat
  { message, history: [{role, content}...], analysis: {...} }
        │
        ▼
Backend builds context-rich prompt:
  - Role: "You are assisting an on-call engineer..."
  - Incident metadata + key logs
  - Prior analysis summary (root cause, severity, steps)
  - Conversation history (last 10 turns)
  - "Answer ONLY the question asked. No section headers. 2-5 sentences max."
        │
        ▼
Same WXO invocation flow as above → returns plain-text reply
        │
        ▼
Frontend appends to chat thread in Analysis Drawer
```

---

## 4. The watsonx Orchestrate Agent

### Agent Definition (`agent/agent.yaml`)

| Field | Value |
|---|---|
| **Name** | `incident_resolution_agent` |
| **Display Name** | SRE Copilot |
| **Kind** | Native (watsonx Orchestrate native agent) |
| **LLM** | `groq/openai/gpt-oss-120b` |
| **Tool** | `analyze_incident` |

### Agent Instructions

The agent is instructed to act as an **expert SRE** with deep expertise in Kubernetes, cloud infrastructure, databases, networking, and application performance engineering. It MUST use the `analyze_incident` tool and format its response with exactly three section headers:

```
ROOT CAUSE:
[concise technical root cause referencing specific log entries]

SEVERITY CLASSIFICATION:
[Critical/High/Medium/Low]: [justification based on blast radius + SLA impact]

REMEDIATION STEPS:
1. [exact actionable step with commands]
2. [step two]
...
```

### The `analyze_incident` Tool (`agent/tools/analyze_incident.py`)

A Python tool decorated with `@tool` from the watsonx Orchestrate ADK. It provides the agent with a structured schema for incident analysis:

**Input parameters:**
| Parameter | Type | Description |
|---|---|---|
| `incident_id` | str | Unique identifier (e.g. `INC-001`) |
| `incident_title` | str | Human-readable incident title |
| `severity` | str | Reported severity: Critical / High / Medium / Low |
| `affected_service` | str | Primary service or infrastructure component |
| `timestamp` | str | ISO 8601 detection timestamp |
| `logs` | str | Raw log output, newline-separated |

**Output:**
```json
{
  "incident_id": "INC-001",
  "root_cause": "...",
  "severity_classification": "...",
  "remediation_steps": ["step 1", "step 2", "..."]
}
```

> The tool body is intentionally minimal — the LLM reasoning inside watsonx Orchestrate performs the actual analysis using the tool's docstring as its instruction. The tool exists to give the agent a structured input/output schema.

---

## 5. Features & Functionality

### 5.1 Kanban Incident Board

The main screen presents incidents in a **4-column Kanban board** grouped by severity:

| Column | Colour | Meaning |
|---|---|---|
| 🔴 Critical | Red | Immediate action required — production impact |
| 🟠 High | Orange | Significant degradation — SLA at risk |
| 🟡 Medium | Yellow | Degraded performance — monitor and remediate |
| 🟢 Low | Green | Informational — schedule fix |

Each **Incident Card** shows:
- Incident ID (`INC-001`)
- Status badge (Open / In Progress / Analyzing / Resolved)
- Title and description (2-line clamp)
- Affected service tag
- Detected timestamp
- **4-step timeline progress bar**: Detected → Assigned → Analyzing → Resolved
- **Details** button (opens Detail Drawer)
- **Analyze** button (invokes the AI agent)

### 5.2 Executive KPI Bar

A persistent summary strip below the Carbon header showing live metrics:

- **Severity counts** — animated count-up on load for each severity level
- **SLA Risk badges** — pulsing ⚡ badge on tiles when breach threshold is met (Critical ≥ 2, High ≥ 3)
- **Open Incidents** — total non-resolved count
- **Avg MTTR** — weighted average Mean Time To Resolve across open incidents
- **SLA Breach Risk** — count of severity buckets at or above threshold
- **🔒 Controls Active** — pulsing badge when any Agent Control is enabled

### 5.3 Incident Detail Drawer

Clicking any card or the **Details** button opens a right-side drawer with:
- Full incident metadata grid (ID, severity, status, service, detected time)
- Complete colour-coded log viewer (`ERROR` → red, `WARN` → yellow, `INFO` → blue)
- Multi-source enrichment panel showing correlated data from:
  - PagerDuty (alert ID, on-call responder)
  - Datadog (metric spike link)
  - Splunk (log search link)
  - GitHub (recent deployment reference)
  - Confluence (runbook link)
- **Analyze** button to launch AI analysis directly from the detail view

### 5.4 AI Analysis Drawer

Clicking **Analyze** opens the Analysis Drawer which shows:

**Phase 1 — Thinking Animation (macOS terminal style)**
A typewriter-style terminal shows step-by-step progress:
```
● Connecting to watsonx Orchestrate...
● Retrieving incident data...
● Invoking analyze_incident tool...
● Generating remediation runbook...
● Finalising analysis...
```

**Phase 2 — Analysis Results** (three animated sections that fade in):
1. **Root Cause** — Technical explanation referencing specific log lines
2. **Severity Classification** — Confirmed/reclassified severity with business justification
3. **Remediation Steps** — 5-8 numbered, immediately actionable steps with exact CLI commands

### 5.5 Conversational Follow-up Chat

After analysis completes, a **chat interface** appears at the bottom of the Analysis Drawer:

- **Suggested question chips** — pre-populated context-aware questions (e.g. "How long will the fix take?", "Who should I escalate to?", "What's the customer impact?")
- **Free-text input** — ask any follow-up question
- **Full context injection** — every message includes incident data, prior analysis, and last 10 turns of conversation history
- **Typing indicator** — animated three-dot bouncing indicator while agent is responding
- **Markdown rendering** — agent responses render with code blocks, bold, lists
- **Conversation persistence** — chat history is preserved per incident across drawer open/close sessions (capped at 10 turns)

### 5.6 Incident Lifecycle Management

- **Mark Resolved** — green button in Analysis Drawer footer advances the incident timeline to all 4 steps complete (✓ ✓ ✓ ✓) and updates status to "Resolved"
- **Timeline progression** — status automatically advances:
  - `Open` → `Analyzing` when Analyze is clicked
  - `Analyzing` → `In Progress` when analysis completes
  - `In Progress` → `Resolved` when Mark Resolved is clicked

### 5.7 Auto-Generate Incidents

A toolbar control allows simulating a live incident feed:

| Setting | Behaviour |
|---|---|
| Off | No auto-generation |
| Every 5 sec | New incident added every 5 seconds |
| Every 15 sec | New incident added every 15 seconds |
| Every 30 sec | New incident added every 30 seconds |
| Every 1 min | New incident added every minute |

A green pulsing dot appears next to the selector when auto-generation is active. Each generated incident is randomly drawn from **12 realistic templates** (see Section 6.2).

### 5.8 Manual Create Incident

The **＋ Create Incident** button in both the toolbar and Carbon header creates a new random incident immediately and adds it to the board.

---

## 6. Incident Data

### 6.1 Seed Incidents (8 pre-loaded)

The board starts with 8 realistic IT operations incidents — 2 per severity level:

| ID | Title | Severity | Service |
|---|---|---|---|
| INC-001 | Payment Service CrashLoopBackOff | Critical | payment-service |
| INC-002 | Database Connection Pool Exhausted | Critical | db-cluster-01 |
| INC-003 | Auth API P99 Latency Spike — >30s | High | auth-api |
| INC-004 | Memory Leak Detected in order-service | High | order-service |
| INC-005 | Disk Usage at 85% on storage-node-03 | Medium | storage-node-03 |
| INC-006 | Slow Query Degrading db-cluster-01 Performance | Medium | db-cluster-01 |
| INC-007 | TLS Certificate Expiring in 28 Days | Low | api-gateway |
| INC-008 | Log Rotation Warning on log-aggregator | Low | log-aggregator |

Each seed incident includes realistic log output with proper timestamps, error codes, and service-specific messages that give the AI agent enough context to produce a meaningful analysis.

### 6.2 Auto-Generated Incident Templates (12 templates)

When "Create Incident" is triggered, a random template is selected from:

| Title | Severity | Service |
|---|---|---|
| Kubernetes Node NotReady — worker-node-07 | Critical | k8s-cluster-prod |
| Redis Cluster Split-Brain — cache-cluster-02 | Critical | cache-cluster-02 |
| API Gateway 502 Error Rate Spike | High | api-gateway |
| CPU Throttling on notification-service | High | notification-service |
| Elasticsearch Index Shard Unassigned | High | elasticsearch-prod |
| Network Latency Spike Between AZs | High | network-fabric |
| S3-Compatible Storage Bucket Quota at 90% | Medium | object-storage-prod |
| Microservice Health Check Failures — inventory-service | Medium | inventory-service |
| SSL Pinning Failure in Mobile API | Medium | mobile-api-gateway |
| Cron Job Missed — daily-report-generator | Low | scheduler |
| High Error Rate in Trace Exporter | Low | observability-stack |
| Pod Pending — Insufficient CPU on prod-cluster | Low | k8s-cluster-prod |

---

## 7. Admin Panel

Accessible via the **⚙️ Settings icon** in the Carbon header (top-right corner).

### Password Gate
The Admin Panel is password-protected. Default password: set via `ADMIN_PASSWORD` environment variable (defaults to `ibmdemo` if not set).

### Section 1 — Agent Controls
Three toggles that enable/disable real-time safety controls on the WXO agent (see Section 8 for full details). Changes apply immediately to all subsequent analyses.

### Section 2 — Board Management
**Reset Board** button — restores the incident board to its original 8 seed incidents. Clears all auto-generated incidents and resets the incident ID counter. Requires confirmation via a Carbon danger modal before executing.

After reset, the board automatically reloads to reflect the clean state.

---

## 8. Agent Controls

Three safety and privacy controls are deployed to the watsonx Orchestrate agent, manageable via the Admin Panel:

### 🔒 PII Filter (`pii_filter`) — Priority 10

Detects and masks personally identifiable information in both agent inputs and outputs.

**Enabled detections:**
- Email addresses
- IP addresses (server IPs, client IPs, internal network addresses)
- Phone numbers

**Behaviour:** Replaces detected PII with `[REDACTED]`. Does not block the request — the analysis continues with PII masked.

**Hook:** `agent_pre_invoke` + `agent_post_invoke`

---

### 🛡️ Content Guardrails (`Guardrails`) — Priority 20

Enforces content safety using the watsonx Orchestrate external guardrails detection service.

**Enabled detections:**
- Jailbreak attempts and prompt injection
- Harmful content requests
- Hate speech, abuse, and profanity (HAP)

**Disabled** (not relevant for IT ops): violence, sexual content, social bias

**Behaviour:** Blocks the request and returns: *"This request was blocked by content safety controls. Please ask a question related to incident analysis and remediation."*

**Hook:** `agent_pre_invoke` + `agent_post_invoke`

---

### 🔑 Secrets Detector (`SecretsDetection`) — Priority 30

Detects and redacts credentials and secrets that may appear in incident logs or configuration snippets.

**Enabled detections:**
- JWT tokens
- PEM-format private key blocks
- AWS Access Key IDs and Secret Access Keys
- Google API keys
- Slack tokens
- 32-character hex secrets (generic API keys)

**Behaviour:** Replaces detected secrets with `***REDACTED***`. Does not block — redacts and continues so analysis still completes.

**Hook:** `agent_pre_invoke` + `agent_post_invoke`

---

### Priority Execution Order

```
User message / incident data
        │
        ▼  Priority 10
   PII Filter ──────────────────→ masks emails, IPs, phones
        │
        ▼  Priority 20
  Content Guardrails ───────────→ blocks jailbreak / harmful content
        │
        ▼  Priority 30
  Secrets Detector ─────────────→ redacts API keys, JWTs, certs
        │
        ▼
  Agent LLM processes cleaned input
        │
        ▼  (same controls fire again on output)
  Response returned to user
```

---

## 9. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.x | UI framework |
| IBM Carbon Design System | 1.115.x | Component library + design tokens |
| @carbon/icons-react | 11.87.x | IBM Carbon icon set |
| react-markdown | 10.x | Markdown rendering for agent responses |
| Vite | 8.x | Build tool + dev server |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | 0.115.5 | REST API framework |
| Uvicorn | 0.32.1 | ASGI server |
| ibm-watsonx-orchestrate | ≥2.15.0 | WXO SDK (agent client, run client, threads client) |
| ibm-cloud-sdk-core | (transitive) | IAM authentication |
| Pydantic | 2.10.3 | Request/response validation |
| httpx | ≥0.28.1 | HTTP client for WXO controls REST API |
| python-dotenv | 1.0.1 | Environment variable loading |

### Infrastructure
| Technology | Purpose |
|---|---|
| Podman 5.x | Container runtime |
| Podman Compose | Multi-container orchestration |
| Nginx | Reverse proxy (serves React SPA + proxies /api to backend) |

### AI Platform
| Technology | Purpose |
|---|---|
| IBM watsonx Orchestrate | Agent hosting, tool execution, controls enforcement |
| watsonx Orchestrate ADK 2.16+ | Agent/tool/controls deployment CLI |
| groq/openai/gpt-oss-120b | LLM powering the SRE Copilot agent |

---

## 10. Project Structure

```
Incident Resolution/
├── .env                          # Real credentials (gitignored)
├── .env.example                  # Template — copy to .env
├── .gitignore
├── docker-compose.yml            # Podman Compose (ports 3000, 8765)
├── README.md                     # Quick-start guide
├── DOCUMENTATION.md              # This file
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── IncidentCard.jsx          # Kanban card + 4-step timeline
│   │   │   ├── IncidentDetailDrawer.jsx  # Full log viewer + enrichment panel
│   │   │   ├── AnalysisDrawer.jsx        # Thinking terminal + results + chat
│   │   │   ├── KpiBar.jsx                # Animated KPI strip + Controls Active badge
│   │   │   ├── EnrichmentPanel.jsx       # Multi-source data pills
│   │   │   └── AppHeader.jsx             # Carbon header component
│   │   ├── pages/
│   │   │   ├── IncidentBoard.jsx         # Main Kanban board page
│   │   │   └── AdminPanel.jsx            # Password-gated admin panel
│   │   ├── services/
│   │   │   └── api.js                    # All backend API calls
│   │   ├── App.jsx                       # Root component + admin panel wiring
│   │   ├── App.css
│   │   └── index.css                     # All custom CSS (1700+ lines)
│   ├── Dockerfile
│   ├── nginx.conf                        # Reverse proxy config
│   └── package.json
│
├── backend/
│   ├── main.py                   # FastAPI app + all endpoints
│   ├── models.py                 # Pydantic models (Incident, AnalysisResult, etc.)
│   ├── data/
│   │   ├── incidents.py          # 8 seed incidents
│   │   └── templates.py          # 12 auto-generate templates
│   ├── services/
│   │   ├── agent_client.py       # WXO SDK integration (analyze + chat)
│   │   └── controls_client.py    # WXO controls REST API (enable/disable)
│   ├── requirements.txt
│   └── Dockerfile
│
└── agent/
    ├── agent.yaml                # Agent definition (name, LLM, instructions, tools)
    ├── tools/
    │   └── analyze_incident.py   # @tool decorated function
    ├── controls/
    │   ├── pii_filter.yaml       # PII Filter control definition
    │   ├── guardrails.yaml       # Content Guardrails control definition
    │   └── secrets_detection.yaml # Secrets Detector control definition
    ├── deploy.sh                 # Deploy tool + agent to WXO
    ├── deploy_controls.sh        # Deploy all 3 controls to WXO
    ├── teardown.sh               # Remove agent + tool from WXO
    └── teardown_controls.sh      # Remove all 3 controls from WXO
```

---

## 11. Environment Variables

Create a `.env` file from the template:
```bash
cp .env.example .env
```

| Variable | Required | Description | Example |
|---|---|---|---|
| `WXO_API_KEY` | ✅ | watsonx Orchestrate API key | `FPZX...` |
| `WXO_INSTANCE_URL` | ✅ | WXO instance base URL | `https://api.us-south.watson-orchestrate.ibm.com/instances/xxx` |
| `WXO_ENV_NAME` | ✅ | ADK environment name (for deploy scripts) | `ibm_cloud` |
| `AGENT_NAME` | ⬜ | Deployed agent name (default: `incident_resolution_agent`) | `incident_resolution_agent` |
| `ADMIN_PASSWORD` | ⬜ | Admin panel password (default: `ibmdemo`) | `ibmdemo` |
| `RUN_TIMEOUT_SECONDS` | ⬜ | Max seconds to wait for agent response (default: `120`) | `120` |

---

## 12. Setup & Deployment

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Podman | 5.x+ | Container runtime |
| Python | 3.11+ | Agent deployment only |
| ibm-watsonx-orchestrate ADK | 2.16+ | `pip install ibm-watsonx-orchestrate` |
| watsonx Orchestrate instance | — | IBM Cloud account required |

---

### Step 1 — Configure Environment

```bash
cp .env.example .env
# Edit .env — fill in WXO_API_KEY, WXO_INSTANCE_URL, WXO_ENV_NAME
```

---

### Step 2 — Deploy the Agent (run once per environment)

```bash
pip install ibm-watsonx-orchestrate

# Register your WXO environment (first time only)
orchestrate env add --name <WXO_ENV_NAME> --url <WXO_INSTANCE_URL>

# Deploy agent + analyze_incident tool to watsonx Orchestrate
cd agent
chmod +x deploy.sh deploy_controls.sh teardown.sh teardown_controls.sh
./deploy.sh
```

Verify: `orchestrate agents list` — you should see `incident_resolution_agent`.

---

### Step 3 — Deploy Agent Controls (run once per environment)

```bash
cd agent
./deploy_controls.sh
```

Verify: `orchestrate controls list --agent "incident_resolution_agent"`
Expected output: 3 controls listed (PII Filter, Content Guardrails, Secrets Detector).

---

### Step 4 — Start the Demo Stack

```bash
# From project root
DOCKER_CONFIG=/tmp/empty-docker podman compose up --build
```

Open **http://localhost:3000** in your browser.

---

### Stopping the Stack

```bash
podman compose down              # stop containers
podman compose down --rmi all    # stop + remove images
```

---

### Teardown (remove from WXO)

```bash
cd agent
./teardown_controls.sh   # remove controls first
./teardown.sh            # then remove agent + tool
```

---

### Local Development (without containers)

```bash
# Terminal 1 — Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8765

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev    # → http://localhost:3131
```

---

## 13. API Reference

All endpoints are prefixed with `/api`.

### Incidents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/incidents` | Return all incidents sorted by timestamp descending |
| `POST` | `/api/incidents/generate` | Generate a new random incident from templates |
| `POST` | `/api/incidents/reset` | Reset board to 8 seed incidents |
| `POST` | `/api/incidents/analyze` | Invoke WXO agent to analyze an incident |
| `POST` | `/api/incidents/{id}/chat` | Send follow-up chat message about an incident |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Verify admin password |
| `GET` | `/api/admin/config` | Get current agent control toggle states |
| `PUT` | `/api/admin/config` | Update control toggles (requires `X-Admin-Password` header) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend health check |

---

## 14. Demo Script

A suggested **2-minute walkthrough** for client presentations:

### Opening (20 sec)
> *"This is SRE Copilot — an AI assistant for on-call engineers built on IBM watsonx Orchestrate. Let me show you what happens when infrastructure incidents come in."*

Point to the Kanban board — explain the 4 severity columns and the KPI bar at the top.

### Analyzing an Incident (45 sec)
> *"Let's take this critical incident — Payment Service CrashLoopBackOff. The pod is crashing every few minutes. An engineer would normally spend 20-30 minutes diagnosing this. Let's see what the AI can do."*

Click **Analyze** on INC-001. Point out the thinking animation:
> *"Watch — the agent is calling the analyze_incident tool on watsonx Orchestrate, processing the logs, and building a remediation runbook in real time."*

When results appear, walk through Root Cause → Severity → Remediation Steps.

### Follow-up Chat (20 sec)
> *"The engineer can now ask follow-up questions directly."*

Click the **"How long will the fix take?"** suggested chip and show the concise response.

### Admin Panel — Controls (30 sec)
> *"Now let me show you something important for enterprise deployments — agent safety controls."*

Click the ⚙️ Settings icon → enter password → show the three control toggles:
> *"These controls are enforced by watsonx Orchestrate in real time. PII Filter masks IP addresses and emails. Content Guardrails blocks prompt injection. Secrets Detector redacts API keys and JWT tokens. I can toggle them on or off, and the next analysis will reflect the change immediately — no redeployment required."*

Toggle one on → show the **🔒 Controls Active** badge appear in the KPI bar.

### Closing (5 sec)
> *"All of this — the agent, the tools, the controls — is running on IBM watsonx Orchestrate on IBM Cloud."*
