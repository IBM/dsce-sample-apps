# Continuous Supply Chain RAG Agent Specification

**Spec:** 14_CONTINUOUS_RAG_AGENT_SPEC.md  
**Version:** 1.0  
**Status:** Implemented  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data  
**Last Updated:** 2025-07  
**Owner:** Supply Chain Intelligence Platform Team

---

## 1. Overview

### 1.1 What Is the Continuous RAG Agent?

The Continuous Supply Chain RAG Agent (`crag_rag_agent_v1`) is a dedicated, independently deployable IBM watsonx Orchestrate (wxO) native agent that answers real-time supply chain questions by querying **7 dedicated `crag.*` Kafka topics** via the Confluent MCP toolkit.

Unlike the primary TSCI agent (`tsci_primary_agent_v1`), which calls backend REST API tools to fetch risk scores and recommendations, `crag_rag_agent_v1` reads **live Kafka topic data directly** through the Real-Time Confluent Event (RTCE) access layer — making it a pure retrieval agent grounded entirely in streaming event data.

Key properties:
- **Stateless:** every query fetches fresh data from RTCE; no session memory
- **Deterministic:** temperature 0.0, react_core style, no speculative generation
- **Isolated:** operates on `crag.*` topic namespace — zero impact on production `supply.*` / `turnaround.*` topics
- **Fast reset:** `reseed.sh` restores full demo state in ~60 seconds without touching infrastructure

### 1.2 Why It Exists — Problem Statement

The original TSCI Confluent RAG agent (`confluent_rag_agent_v1`) shares the TSCI cluster with production Flink jobs and Kafka topics. Resetting or recreating demo scenarios requires `terraform destroy`, which wipes **all** cluster infrastructure and takes 5–10 minutes to rebuild.

The Continuous RAG Agent solves this by using a **`crag.` topic prefix** on the same existing cluster, providing:

| Concern | TSCI Primary Agent | Continuous RAG Agent |
|---|---|---|
| Data source | Backend REST API (`/api/risks`, `/api/materials`, `/api/shipments`) | Confluent RTCE (`crag.*` Kafka topics) |
| Tools | 22 custom WXO tools (read, write, resilience, Confluent trace bridge) | 3 MCP tools (`listTopics`, `getMetadata`, `queryData`) |
| Topic namespace | Shared `supply.*` / `turnaround.*` | Dedicated `crag.*` prefix |
| Infrastructure dependency | Requires TSCI backend running | Zero dependency on TSCI backend |
| Demo reset | Backend re-seed + Flink restart | `reseed.sh` (~60s, retention-purge + re-produce) |
| Destroy risk | `terraform destroy` wipes all infra | `destroy.sh` drops only RTCE registrations |
| Scoring | Composite weighted scoring engine | No scoring — read-only retrieval |
| Approval workflow | Full approval lifecycle (PENDING → APPROVED/REJECTED) | Read-only — does not initiate approvals |
| UI integration | All 7 pages + `RiskTowerPage` | `AvlLiveTab` page only (`VITE_WXO_CRAG_AGENT_NAME`) |

---

## 2. Architecture

### 2.1 Cluster & Namespace

**Cluster:** `lkc-0xddjd2` (us-east-1, AWS)  
**Environment:** `env-o7qy3j`  
**Organization:** `89eabd20-d480-4a30-b32b-9e2cee0c4e60`

```
Confluent Cluster: lkc-0xddjd2
│
├── supply.risk.detected              ← existing production topic (untouched)
├── supply.shipment.updated           ← existing production topic (untouched)
├── turnaround.material.required      ← existing production topic (untouched)
│
├── crag.supply.risk.detected         ← demo topic (this spec)
├── crag.supply.shipment.updated      ← demo topic (this spec)
├── crag.turnaround.material.required ← demo topic (this spec)
├── crag.supply.supplier.status.changed      ← demo topic (this spec)
├── crag.supply.port.status.changed          ← demo topic (this spec)
├── crag.supply.approved_vendor.changed      ← demo topic (this spec)
└── crag.supply.material.readiness.assessed  ← demo topic (this spec)
```

### 2.2 Data Flow — ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│               User / UI (AvlLiveTab)             │
│  Question: "What is the AVL status of CVA-8842?" │
└───────────────────────┬─────────────────────────┘
                        │ HTTPS chat
                        ▼
┌─────────────────────────────────────────────────┐
│       crag_rag_agent_v1  (wxO Native Agent)      │
│   style: react_core  |  model: gpt-oss-120b      │
│   temperature: 0.0   |  stateless                │
└───────────────────────┬─────────────────────────┘
                        │ MCP tool calls
                        │ (listTopics / getMetadata / queryData)
                        ▼
┌─────────────────────────────────────────────────┐
│   confluent_mcp_v1 Toolkit (streamable_http)     │
│   auth: confluent_rtce_v1 (HTTP Basic Auth)      │
└───────────────────────┬─────────────────────────┘
                        │ HTTPS (MCP protocol)
                        ▼
┌─────────────────────────────────────────────────┐
│  Confluent RTCE MCP Server                       │
│  mcp.us-east-1.aws.confluent.cloud/mcp/v1/...   │
│  Context Engine: org / env / cluster             │
└───────────────────────┬─────────────────────────┘
                        │ Flink-backed SQL queries
                        ▼
┌─────────────────────────────────────────────────┐
│  RTCE Registered Tables (Flink CREATE TABLE DDL) │
│  7 × crag.* tables (registered via register.sh) │
└───────────────────────┬─────────────────────────┘
                        │ Kafka consumer
                        ▼
┌─────────────────────────────────────────────────┐
│  Confluent Cloud Kafka Topics (lkc-0xddjd2)     │
│  crag.supply.risk.detected                       │
│  crag.supply.shipment.updated                    │
│  crag.turnaround.material.required               │
│  crag.supply.supplier.status.changed             │
│  crag.supply.port.status.changed                 │
│  crag.supply.approved_vendor.changed             │
│  crag.supply.material.readiness.assessed         │
└─────────────────────────────────────────────────┘
```

### 2.3 Agent Specification

| Property | Value |
|---|---|
| Name | `crag_rag_agent_v1` |
| Kind | `native` |
| Style | `react_core` |
| Model (primary) | `groq/openai/gpt-oss-120b` |
| Model (fallback) | Llama 3.3-70b |
| Temperature | `0.0` (fully deterministic) |
| Max tokens | `2048` |
| Parallel tool calls | `true` |
| Memory | `false` (stateless — every query fetches fresh data) |
| Toolkit | `confluent_mcp_v1` |
| Connection | `confluent_rtce_v1` (HTTP Basic Auth) |
| MCP tools exposed | `listTopics`, `getMetadata`, `queryData` |

---

## 3. Topic Catalogue

### 3.1 All 7 crag.* Topics

| # | Topic Name | Kafka Key | Purpose | Schema Summary |
|---|---|---|---|---|
| 1 | `crag.supply.risk.detected` | `risk_id` | Supply chain risks as detected by the risk engine | risk_id, correlation_id, risk_type, severity, shipment_id, material_id, requirement_id, work_package_id, required_by, current_eta, available_at_destination, shortage_quantity, detected_at |
| 2 | `crag.supply.shipment.updated` | `shipment_id` | Shipment ETA changes and delivery delays | shipment_id, material_id, origin_port, destination_port, original_eta, current_eta, delay_days, status, delay_reason, correlation_id, updated_at |
| 3 | `crag.turnaround.material.required` | `requirement_id` | Material demand per turnaround work package | requirement_id, work_package_id, material_id, material_name, quantity_required, unit, criticality, required_by, raised_at, correlation_id |
| 4 | `crag.supply.supplier.status.changed` | `supplier_id + material_id` | Supplier-level constraints (quality hold, port congestion, capacity limits) | supplier_id, material_id, status, severity, reason, affected_routes, estimated_resolution, correlation_id, occurred_at |
| 5 | `crag.supply.port.status.changed` | `port_code` | Port disruptions and congestion levels | port_code, port_name, status, severity, reason, avg_vessel_wait_days, affected_routes, correlation_id, occurred_at |
| 6 | `crag.supply.approved_vendor.changed` | `material_id + supplier_id` | AVL lifecycle events: APPROVED, SUSPENDED, REINSTATED, REMOVED | material_id (KEY), supplier_id (KEY), change_type, effective_date, reason, authorised_by, event_id, correlation_id |
| 7 | `crag.supply.material.readiness.assessed` | `assessment_id` | Material readiness assessment and resilience posture | assessment_id, material_id, work_package_id, resilience_score, readiness_status, primary_risk, mitigation_available, assessed_at, correlation_id |

### 3.2 RTCE Registration

Each topic is registered as a Flink-backed SQL table via `confluent flink statement create`. Example DDL for `crag.supply.risk.detected`:

```sql
CREATE TABLE `crag.supply.risk.detected` (
  risk_id                  STRING NOT NULL,
  correlation_id           STRING,
  risk_type                STRING,
  severity                 STRING,
  shipment_id              STRING,
  material_id              STRING,
  requirement_id           STRING,
  work_package_id          STRING,
  required_by              TIMESTAMP(3),
  current_eta              TIMESTAMP(3),
  available_at_destination DOUBLE,
  shortage_quantity        DOUBLE,
  detected_at              TIMESTAMP(3),
  PRIMARY KEY (risk_id) NOT ENFORCED
) WITH (
  'key.format'   = 'json-registry',
  'value.format' = 'json-registry',
  'kafka.consumer.isolation-level' = 'read-uncommitted'
)
```

---

## 4. Kafka Event Contracts

### 4.1 Field Naming Rules

| Rule | Correct | Wrong (rejected) |
|---|---|---|
| Lowercase snake_case | `material_id`, `change_type` | `MATERIAL_ID`, `changeType`, `MaterialId` |
| Key fields in KEY only | `material_id` in Kafka KEY | `material_id` also in Kafka VALUE |
| Schema-declared fields only | Fields listed in schema | `status`, `metadata`, `payload`, `supplier_name` |
| `additionalProperties: false` | Only declared fields | Any undeclared field |

### 4.2 Field Contract: crag.supply.approved_vendor.changed

| Field | Location | Required | Type | Notes |
|---|---|---|---|---|
| `material_id` | KEY | Yes | string | e.g., `"CVA-8842"` |
| `supplier_id` | KEY | Yes | string | e.g., `"SUP-205"` |
| `change_type` | VALUE | No | string\|null | `APPROVED`, `SUSPENDED`, `REINSTATED`, `REMOVED` |
| `effective_date` | VALUE | No | string\|null | `"YYYY-MM-DD"` stored as string |
| `reason` | VALUE | No | string\|null | Human-readable reason |
| `authorised_by` | VALUE | No | string\|null | e.g., `"DEMO-PROCUREMENT"` |
| `event_id` | VALUE | No | string\|null | Unique per event, e.g., `"EVT-AVL-0001"` |
| `correlation_id` | VALUE | No | string\|null | Stable across all events in same scenario |
| `occurred_at` | VALUE | No | int64\|null | **Milliseconds since Unix epoch — NOT an ISO string** |

### 4.3 Correlation ID Stability Rule

All events in the same scenario share the same `correlation_id`. Only `event_id` changes per event:

```
Event 1: event_id="EVT-AVL-0001", correlation_id="DEMO-TW2047-001"
Event 2: event_id="EVT-AVL-0002", correlation_id="DEMO-TW2047-001"  ← same
Event 3: event_id="EVT-AVL-0003", correlation_id="DEMO-TW2047-001"  ← same
```

### 4.4 Schema Validation Failure Policy

If schema validation fails during serialization:
1. **HALT immediately** — do not retry with raw JSON
2. **Report the full validation error** with field name and reason
3. **Never** silently bypass Schema Registry

---

## 5. Demo Scenario

### 5.1 Scenario: DEMO-TW2047-001

| Property | Value |
|---|---|
| Scenario ID | `DEMO-TW2047-001` |
| Material | `CVA-8842` — Control Valve Actuator Assembly (CRITICAL) |
| Work Package | `TW-2047` |
| Shipment | `SHP-90017` |
| Primary supplier | `SUP-101` — QUALITY_HOLD, CRITICAL severity |
| Secondary supplier | `SUP-203` — PORT_CONGESTION, HIGH severity (routes via SGSIN) |
| Tertiary/emergency supplier | `SUP-205` — emergency fast-track approval, Aug 2026 |
| Total seeded events | 9 across 7 topics |

### 5.2 Seeded Event Catalogue — All 9 Events

| # | Topic | Kafka Key | Event Type | Description | Demo Purpose |
|---|---|---|---|---|---|
| 1 | `crag.supply.approved_vendor.changed` | `CVA-8842:SUP-101` | APPROVED | Primary supplier baseline qualification | Establishes SUP-101 as first-choice vendor |
| 2 | `crag.supply.approved_vendor.changed` | `CVA-8842:SUP-203` | APPROVED | Secondary supplier baseline qualification | Establishes SUP-203 as backup vendor |
| 3 | `crag.supply.approved_vendor.changed` | `CVA-8842:SUP-205` | APPROVED | Emergency tertiary fast-track approval, Aug 2026 | Shows AVL expansion under supply stress |
| 4 | `crag.turnaround.material.required` | `TW-2047:CVA-8842` | REQUIRED | 1× CVA-8842 needed by 2026-10-10 | Establishes the material demand signal |
| 5 | `crag.supply.supplier.status.changed` | `SUP-101:CVA-8842` | QUALITY_HOLD CRITICAL | Batch non-conformance detected | Primary path blocked |
| 6 | `crag.supply.supplier.status.changed` | `SUP-203:CVA-8842` | PORT_CONGESTION HIGH | Routes via SGSIN — 18-day vessel queue | Secondary path degraded |
| 7 | `crag.supply.port.status.changed` | `SGSIN` | DISRUPTION HIGH | Singapore port congestion — HIGH severity | Explains SUP-203 degradation |
| 8 | `crag.supply.shipment.updated` | `SHP-90017` | DELAYED +7d | ETA Oct 7 → Oct 14 (TRANSPORT_DISRUPTION) | Quantifies delivery risk |
| 9 | `crag.supply.material.readiness.assessed` | `TW-2047:CVA-8842` | CRITICAL | Resilience score 75, status CRITICAL | Summarises overall readiness posture |

### 5.3 AVL Lifecycle Arc for SUP-205 / CVA-8842

For continuous demo playback, the `crag.supply.approved_vendor.changed` topic supports a 3-event lifecycle arc showing a supplier that is approved, suspended for compliance audit, then reinstated:

```
Aug 10  APPROVED    event_id="EVT-AVL-0001"  reason="Emergency fast-track approval"
Sep 15  SUSPENDED   event_id="EVT-AVL-0002"  reason="Urgent compliance audit initiated"
Sep 25  REINSTATED  event_id="EVT-AVL-0003"  reason="Compliance audit cleared — reinstated"
```

All three events share `correlation_id="DEMO-TW2047-001"` and the same Kafka KEY:
```json
{ "material_id": "CVA-8842", "supplier_id": "SUP-205" }
```

Seeded via `continuous_rag/wxo_confluent_mcp/produce_approved_vendor_changed.py`.

---

## 6. Infrastructure & File Layout

### 6.1 Directory Structure

```
continuous_rag/
├── .env                              ← RTCE + cluster credentials (not committed)
├── .env.example                      ← template (committed)
├── README.md
├── scripts/
│   ├── setup.sh                      ← full bootstrap: register → wait 30s → seed
│   ├── register_topics.sh            ← Flink DDL CREATE TABLE for all 7 crag.* topics
│   ├── seed.sh                       ← produce 9 demo events via comprehensive_seed.py
│   ├── reseed.sh                     ← purge (retention=1s, wait 30s, restore) + seed
│   ├── destroy.sh                    ← drop RTCE registrations (crag.* only)
│   ├── status.sh                     ← Confluent cluster health check
│   └── deploy.sh                     ← register WXO connection + toolkit + agent
└── wxo_confluent_mcp/
    ├── deploy.sh                     ← WXO-specific deployment (connection/toolkit/agent)
    ├── remove.sh                     ← clean teardown of all WXO resources
    ├── comprehensive_seed.py         ← produce all 9 events (8 of 9 topics)
    ├── produce_approved_vendor_changed.py ← produce AVL lifecycle events (event 3)
    ├── purge_topics.py               ← retention-based purge for reseed
    ├── diagnose.py                   ← MCP smoke test: queryData for each topic
    ├── agents/
    │   └── native/
    │       └── crag_rag_agent_v1.yaml
    ├── connections/
    │   └── confluent_rtce.yaml
    └── toolkits/
        └── confluent_mcp.yaml
```

### 6.2 Confluent MCP Toolkit Configuration

**Toolkit YAML (`toolkits/confluent_mcp.yaml`):**
```yaml
name: confluent_mcp_v1
kind: mcp
transport: streamable_http
url: https://mcp.us-east-1.aws.confluent.cloud/mcp/v1/context-engine/organizations/89eabd20-d480-4a30-b32b-9e2cee0c4e60/environments/env-o7qy3j/kafka-clusters/lkc-0xddjd2
app_id:
  - confluent_rtce_v1
tools:
  - listTopics
  - getMetadata
  - queryData
```

**Connection YAML (`connections/confluent_rtce.yaml`):**
```yaml
name: confluent_rtce_v1
kind: basic
type: team
```

Credentials are set via:
```bash
orchestrate connections set-credentials confluent_rtce_v1 \
  --username "$CONFLUENT_RTCE_API_KEY" \
  --password "$CONFLUENT_RTCE_API_SECRET"
```

---

## 7. Environment Variables

All variables are required in `continuous_rag/.env` (separate from the root `.env` used by the TSCI backend).

| Variable | Purpose | Source |
|---|---|---|
| `CONFLUENT_BOOTSTRAP_SERVERS` | Kafka broker endpoint for event production | Confluent Cloud cluster settings |
| `CONFLUENT_API_KEY` | Kafka producer API key | Confluent Cloud API key (cluster-level) |
| `CONFLUENT_API_SECRET` | Kafka producer API secret | Confluent Cloud API key (cluster-level) |
| `CONFLUENT_SCHEMA_REGISTRY_URL` | Schema Registry endpoint for JSON serialization | Confluent Cloud Schema Registry |
| `CONFLUENT_SCHEMA_REGISTRY_API_KEY` | Schema Registry API key | Confluent Cloud Schema Registry credentials |
| `CONFLUENT_SCHEMA_REGISTRY_API_SECRET` | Schema Registry API secret | Confluent Cloud Schema Registry credentials |
| `CONFLUENT_REST_URL` | Confluent REST Proxy endpoint | Confluent Cloud cluster REST endpoint |
| `CONFLUENT_CLUSTER_ID` | Cluster ID (e.g., `lkc-0xddjd2`) | Confluent Cloud cluster page |
| `CONFLUENT_ENV_ID` | Environment ID (e.g., `env-o7qy3j`) | Confluent Cloud environment page |
| `CONFLUENT_FLINK_ENV_ID` | Flink environment ID | Derived from Terraform state or Confluent CLI |
| `CONFLUENT_FLINK_COMPUTE_POOL_ID` | Flink compute pool (for DDL statements) | `terraform output` or Confluent CLI |
| `WXO_BASE_URL` | watsonx Orchestrate API base URL | wxO instance settings |
| `WXO_API_KEY` | wxO API key for agent/toolkit registration | wxO API keys page |
| `CONFLUENT_RTCE_API_KEY` | RTCE Basic Auth username | Confluent RTCE credentials (separate from cluster) |
| `CONFLUENT_RTCE_API_SECRET` | RTCE Basic Auth password | Confluent RTCE credentials (separate from cluster) |
| `CONFLUENT_MCP_URL` | Full RTCE MCP server URL | Constructed from org/env/cluster IDs |

> **Note:** `CONFLUENT_RTCE_API_KEY` and `CONFLUENT_RTCE_API_SECRET` are **different credentials** from `CONFLUENT_API_KEY`/`CONFLUENT_API_SECRET`. RTCE uses HTTP Basic Auth to the MCP endpoint; cluster credentials are for Kafka producer and Flink DDL operations.

---

## 8. Deployment Steps

### 8.1 Step-by-Step: First-Time Setup

```bash
# Step 1: Copy and populate environment file
cp continuous_rag/.env.example continuous_rag/.env
# Edit: CONFLUENT_*, WXO_*, CONFLUENT_RTCE_* variables

# Step 2: Register all 7 crag.* topics in RTCE (Flink DDL)
bash continuous_rag/scripts/register_topics.sh

# Step 3: Wait 30–60 seconds for RTCE to index the new tables
sleep 60

# Step 4: Seed all 9 demo events
bash continuous_rag/scripts/seed.sh

# Step 5: Smoke-test — all 7 topics must return status: success
python continuous_rag/wxo_confluent_mcp/diagnose.py

# Step 6: Deploy WXO connection, toolkit, and agent
bash continuous_rag/wxo_confluent_mcp/deploy.sh
```

Or run steps 1–4 in one command (does not include WXO deployment):
```bash
bash continuous_rag/scripts/setup.sh
```

### 8.2 Operations Reference

| Script | Command | What It Does | Touches RTCE | Touches Cluster |
|---|---|---|---|---|
| `setup.sh` | `bash continuous_rag/scripts/setup.sh` | Full bootstrap: register → wait 30s → seed | Creates 7 tables | No |
| `register_topics.sh` | `bash continuous_rag/scripts/register_topics.sh` | Flink DDL CREATE TABLE for 7 topics | Creates 7 tables | No |
| `seed.sh` | `bash continuous_rag/scripts/seed.sh` | Produce 9 demo events | No | Writes events |
| `reseed.sh` | `bash continuous_rag/scripts/reseed.sh` | Purge (retention=1s, wait, restore) + reseed | No | Modifies retention |
| `destroy.sh` | `bash continuous_rag/scripts/destroy.sh` | Drop RTCE registrations for 7 crag.* topics | Drops 7 tables | No |
| `status.sh` | `bash continuous_rag/scripts/status.sh` | Confluent cluster connectivity and health check | No | Read-only |
| `deploy.sh` | `bash continuous_rag/wxo_confluent_mcp/deploy.sh` | Register wxO connection + toolkit + agent | No | No |
| `remove.sh` | `bash continuous_rag/wxo_confluent_mcp/remove.sh` | Remove wxO agent, toolkit, and connection | No | No |
| `diagnose.py` | `python continuous_rag/wxo_confluent_mcp/diagnose.py` | Smoke test: queryData for each of 7 topics | No | No |

---

## 9. UI Integration

### 9.1 AvlLiveTab Page

The `crag_rag_agent_v1` agent is integrated into the TSCI control tower UI via the `AvlLiveTab` page. This page provides a chat interface that routes questions to `crag_rag_agent_v1` rather than the primary TSCI agent.

**Environment variable required in `ui/.env` or `ui/.env.local`:**
```bash
VITE_WXO_CRAG_AGENT_NAME=crag_rag_agent_v1
```

**Behaviour:**
- The `AvlLiveTab` page reads `import.meta.env.VITE_WXO_CRAG_AGENT_NAME` to identify the target agent
- Questions submitted on this page go directly to `crag_rag_agent_v1`
- The agent retrieves live topic data and returns grounded answers referencing correlation IDs
- If `VITE_WXO_CRAG_AGENT_NAME` is unset, the page displays a configuration error banner

### 9.2 Separate from Main Agent Chat

The `AvlLiveTab` uses a separate wxO chat session from the main `RiskTowerPage`. The two agents do not share context. A user navigating from `RiskTowerPage` (which uses `tsci_primary_agent_v1`) to `AvlLiveTab` starts a fresh conversation with `crag_rag_agent_v1`.

---

## 10. Acceptance Criteria

| ID | Criterion | Verified By |
|---|---|---|
| AC-001 | `crag_rag_agent_v1` responds to AVL questions (e.g., "What is the AVL status of CVA-8842?") with grounded answers referencing live `crag.*` topic data | Manual chat test in wxO UI |
| AC-002 | `listTopics()` via `confluent_mcp_v1` returns all 7 `crag.*` topic names | `diagnose.py` output lists all 7 topics |
| AC-003 | `queryData()` against each of the 7 `crag.*` topics returns `status: success` with ≥1 row | `diagnose.py` per-topic query passes |
| AC-004 | Agent answers include the `correlation_id` field from retrieved events (`DEMO-TW2047-001`) | Chat response inspection |
| AC-005 | Agent handles topics with zero rows gracefully — returns a clear "no data found" message, not an error | Empty topic query test |
| AC-006 | `reseed.sh` restores all 9 demo events without modifying RTCE table registrations | RTCE tables remain after reseed; diagnose.py passes |
| AC-007 | `destroy.sh` removes only `crag.*` RTCE registrations — production `supply.*` / `turnaround.*` topics are untouched | Query production topics post-destroy: unchanged |
| AC-008 | `CONFLUENT_RTCE_API_KEY` and `CONFLUENT_RTCE_API_SECRET` authenticate successfully to the RTCE MCP endpoint | 200 response from MCP server; `diagnose.py` succeeds |
| AC-009 | `AvlLiveTab` page in the UI correctly routes questions to `crag_rag_agent_v1` when `VITE_WXO_CRAG_AGENT_NAME` is set | UI smoke test: AvlLiveTab returns crag agent responses |
| AC-010 | Zero impact on `tsci_primary_agent_v1`, TSCI backend, or any `supply.*` / `turnaround.*` Kafka topics after full continuous RAG deployment | Integration test: TSCI end-to-end scenario passes unchanged |

---

## 11. Troubleshooting

| Error / Symptom | Cause | Fix |
|---|---|---|
| `TABLE_NOT_MATERIALIZED` on all topics immediately after setup | RTCE indexing not complete | Wait 30–60 seconds, re-run `diagnose.py` |
| `TABLE_NOT_MATERIALIZED` after waiting | Topics empty — seed not run or purged | `bash continuous_rag/scripts/seed.sh` |
| `DP_INVALID_TABLE` from queryData | Topic dropped directly without removing RTCE registration | `bash continuous_rag/scripts/register_topics.sh` then `seed.sh` |
| `401 Unauthorized` from `diagnose.py` | Wrong RTCE credentials | Check `CONFLUENT_RTCE_API_KEY` + `CONFLUENT_RTCE_API_SECRET` in `continuous_rag/.env` |
| `confluent: command not found` | Confluent CLI not installed | Install Confluent CLI (`brew install confluentinc/tap/confluent-cli`), then `confluent login` |
| `could not read compute_pool_id` | Flink compute pool ID not set | Set `CONFLUENT_FLINK_COMPUTE_POOL_ID` in `.env` or run `terraform apply` in `confluent/terraform/` |
| Schema validation error during seed | Field naming violation | Use lowercase snake_case only; `material_id`/`supplier_id` must be in KEY not VALUE |
| `occurred_at` schema error | ISO string provided instead of int64 ms | Use `int(time.time() * 1000)` — not `datetime.isoformat()` |
| Producer timeout | Broker unreachable | Verify `CONFLUENT_BOOTSTRAP_SERVERS` in `continuous_rag/.env` |
| Agent returns "I don't have access to that information" | `confluent_mcp_v1` toolkit not attached | Re-run `bash continuous_rag/wxo_confluent_mcp/deploy.sh` |
| `AvlLiveTab` shows configuration error banner | `VITE_WXO_CRAG_AGENT_NAME` not set | Add `VITE_WXO_CRAG_AGENT_NAME=crag_rag_agent_v1` to `ui/.env.local` and rebuild |

---

## 12. Out of Scope

The following capabilities are **explicitly not provided** by `crag_rag_agent_v1`:

| Out of Scope | Rationale |
|---|---|
| Writing to Kafka topics | Read-only retrieval agent; `queryData` is SELECT only |
| Calling TSCI backend REST API | Uses Confluent MCP toolkit directly; no dependency on TSCI backend |
| Scoring or ranking mitigation options | Scoring is handled by the TSCI scoring engine via `tsci_primary_agent_v1` |
| Initiating or tracking approval workflows | Approval lifecycle is managed by the TSCI approval tools |
| Querying production `supply.*` / `turnaround.*` topics | Agent is scoped to `crag.*` topics only |
| Aggregation queries (COUNT, AVG, SUM, GROUP BY) | Not supported by Confluent MCP `queryData`; agent must work within SELECT/WHERE/ORDER BY |
| JOINs across topics | Not supported by Confluent MCP `queryData` |
| Persistent memory across sessions | Stateless by design — every query starts fresh |
| Real-time streaming / push notifications | Pull-based MCP queries only; no WebSocket/SSE push |
| Historical analytics beyond topic retention window | Limited to messages within Kafka topic retention period |

---

## 13. Related Specifications

| Spec | Relationship |
|---|---|
| [`05_OPENSEARCH_RAG_SPEC.md`](05_OPENSEARCH_RAG_SPEC.md) | OpenSearch static enterprise knowledge corpus — separate from Confluent RTCE |
| [`03_EVENT_CONTRACTS.yaml`](03_EVENT_CONTRACTS.yaml) | Production topic schemas — `crag.*` topics mirror these schemas with `crag.` prefix |
| [`04_API_AND_TOOL_CONTRACTS.yaml`](04_API_AND_TOOL_CONTRACTS.yaml) | TSCI backend API tools — used by primary agent, not by crag agent |
| [`06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml`](06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml) | Primary agent pool and orchestration — `crag_rag_agent_v1` is independently deployed |
| [`07_APPLICATION_AND_UI_SPEC.md`](07_APPLICATION_AND_UI_SPEC.md) | UI spec — `AvlLiveTab` page and `VITE_WXO_CRAG_AGENT_NAME` integration |
| [`12_DEMO_DATA_AND_SCENARIO.md`](12_DEMO_DATA_AND_SCENARIO.md) | Full demo scenario narrative — CVA-8842 / TW-2047 / SHP-90017 context |
| [`design/continuous-supply-chain-rag.design.md`](design/continuous-supply-chain-rag.design.md) | Technical design document (this spec supersedes it for operational details) |
