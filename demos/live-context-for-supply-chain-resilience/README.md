# Live Context for Supply Chain Resilience

**IBM products**: IBM Confluent, IBM watsonx Orchestrate, IBM Carbon React

> **⚠ SYNTHETIC DEMONSTRATION DATA ONLY — Not real Shell or Pearl GTL operational data.**

A full-stack AI building block for real-time supply-chain risk detection and mitigation. Built spec-first across five integrated layers: Confluent Kafka event streams → FastAPI risk engine → OpenSearch RAG → IBM watsonx Orchestrate multi-agent orchestration → IBM Carbon React control tower.

---

## Contents

- [When to use this asset](#when-to-use-this-asset)
- [What it demonstrates](#what-it-demonstrates)
- [Spec-Driven Development](#spec-driven-development)
- [Architecture](#architecture)
- [Agent Pool](#agent-pool)
- [Kafka Topics](#kafka-topics)
- [Quick Start — Local Demo](#quick-start--local-demo-no-confluent-or-opensearch-required)
- [Full Deployment](#full-deployment)
- [Backend Tests](#backend-tests)
- [Environment Variables](#environment-variables)
- [Design Principles](#design-principles)
- [Tech Stack](#tech-stack)
- [Acceptance Criteria](#acceptance-criteria)
- [IBM References](#ibm-references)

---

## When to use this asset

Use this building block when you need to show how IBM Confluent, IBM watsonx Orchestrate, and IBM Carbon work together as a governed, end-to-end AI system for industrial operations.

This asset is appropriate when:

- A partner or customer needs a working demo of real-time AI-driven risk detection and mitigation in a manufacturing or energy context.
- A pre-sales or technical team needs a complete business story backed by running code: event streams, multi-agent orchestration, RAG-grounded evidence, and human-in-the-loop approval.
- A solutions architect needs a reference implementation of approval-gated write tools, deterministic scoring, and correlation-ID-traced audit chains.
- A developer wants a spec-driven codebase to learn from or adapt — every file traces to a numbered specification.

---

## What it demonstrates

- **Confluent Cloud** as a real-time event backbone: 9 Kafka topics, Avro Schema Registry, Flink SQL risk-detection jobs
- **IBM watsonx Orchestrate** multi-agent orchestration: 8 specialist agents, 22 tool contracts, approval-gated write tools
- **OpenSearch hybrid RAG**: BM25 + semantic retrieval, grounding enforcement, 8 synthetic engineering documents
- **IBM Carbon React** control tower: 7 pages including live risk dashboard, mitigation scoring, and agent chat
- **Deterministic scoring engine**: weighted composite algorithm — reproducible, auditable, LLM-free
- **Continuous RAG agent** (`crag_rag_agent_v1`): reads 7 live Confluent topics via MCP toolkit in real time
- **Approval-gated writes**: backend rejects write tools with HTTP 403 without a valid approval token
- **Full correlation-ID trace**: every event, API call, tool invocation, audit entry, and Kafka message carries a `correlationId`
- **Spec-driven development**: 17 numbered specification documents; all code changes require a spec change first

---

## Spec-Driven Development

This asset was built entirely spec-first. Every implementation file traces to a numbered specification in [`specs/`](specs/). No code was written before its governing spec existed.

| # | Spec | Description |
|---|---|---|
| — | [`CTO_BRIEF.md`](specs/CTO_BRIEF.md) | Executive one-pager: business case, value proposition, key risks, success metrics |
| — | [`00_BOB_MASTER_INSTRUCTION.md`](specs/00_BOB_MASTER_INSTRUCTION.md) | Bob AI agent workflow rules, tool permissions, and spec change process |
| 01 | [`01_PRODUCT_REQUIREMENTS.md`](specs/01_PRODUCT_REQUIREMENTS.md) | FR-001–FR-037, user stories, acceptance criteria, definition of done |
| 02 | [`02_DOMAIN_MODEL.md`](specs/02_DOMAIN_MODEL.md) | 16 domain entities, 14 enumerations, relationships, invariants |
| 03 | [`03_EVENT_CONTRACTS.md`](specs/03_EVENT_CONTRACTS.md) | 9 Kafka topic schemas, header contract, ordering guarantees |
| 04 | [`04_API_AND_TOOL_CONTRACTS.md`](specs/04_API_AND_TOOL_CONTRACTS.md) | 10 REST routers, 22 WXO tool contracts, error model, approval lifecycle |
| 05 | [`05_OPENSEARCH_RAG_SPEC.md`](specs/05_OPENSEARCH_RAG_SPEC.md) | Index structure, hybrid retrieval pipeline, grounding rules, corpus scope |
| 06 | [`06_WXO_AGENT_AND_WORKFLOW_SPEC.md`](specs/06_WXO_AGENT_AND_WORKFLOW_SPEC.md) | 8-agent pool, routing logic, deterministic workflow steps, collaboration patterns |
| 07 | [`07_APPLICATION_AND_UI_SPEC.md`](specs/07_APPLICATION_AND_UI_SPEC.md) | 7 UI pages, shared Carbon components, WXO chat integration, env vars |
| 08 | [`08_SECURITY_OBSERVABILITY_NFR.md`](specs/08_SECURITY_OBSERVABILITY_NFR.md) | Auth, secrets, OpenTelemetry, non-functional requirements |
| 09 | [`09_SCORING_AND_DECISION_SPEC.md`](specs/09_SCORING_AND_DECISION_SPEC.md) | Weighted composite scoring model, near-equivalence detection, confidence thresholds |
| 10 | [`10_TEST_AND_EVALUATION_SPEC.md`](specs/10_TEST_AND_EVALUATION_SPEC.md) | Unit, integration, contract, e2e, and agent evaluation test definitions |
| 11 | [`11_PHASE_DELIVERY_PLAN.md`](specs/11_PHASE_DELIVERY_PLAN.md) | Phased delivery milestones, dependencies, exit criteria |
| 12 | [`12_DEMO_DATA_AND_SCENARIO.md`](specs/12_DEMO_DATA_AND_SCENARIO.md) | CVA-8842 scenario narrative, seed event sequences, persona descriptions |
| 13 | [`13_SUPPLY_CHAIN_RESILIENCE_SPEC.md`](specs/13_SUPPLY_CHAIN_RESILIENCE_SPEC.md) | Resilience profiles, scoring dimensions, constraint rules, staleness policy |
| 14 | [`14_CONTINUOUS_RAG_AGENT_SPEC.md`](specs/14_CONTINUOUS_RAG_AGENT_SPEC.md) | `crag_rag_agent_v1`: 7 `crag.*` topics, RTCE toolkit, AC-001–AC-010 |

→ Full reading guide, role-based ordering, and cross-reference index: [`specs/README.md`](specs/README.md)

### Spec change process

1. **Propose** — update the relevant spec with a change log entry describing what is changing and why
2. **Impact analysis** — use the cross-reference index in `specs/README.md` to identify all downstream specs, files, and tests
3. **Update** — apply the change to the spec; update downstream specs if contracts are affected
4. **Implement** — update implementation code and tests to match; never change code before the spec
5. **Verify** — all automated tests pass; all acceptance criteria in the changed spec are met

---

## Architecture

```
Sense → Correlate → Retrieve → Reason → Recommend → Approve → Act
```

| Layer | Technology | Endpoint |
|---|---|---|
| Event backbone | Confluent Cloud — Kafka + Schema Registry + Flink SQL | Confluent Cloud |
| Backend API | Python 3.12 / FastAPI | `:3001 / /api` |
| Knowledge retrieval | OpenSearch 2.x — hybrid BM25 + semantic RAG | `:9200` |
| Agent orchestration | IBM watsonx Orchestrate — 8 agents, 22 tools | IBM Cloud |
| Control Tower UI | React 18 + IBM Carbon v11 / TypeScript / Vite | `:3000` |
| Continuous RAG | `crag_rag_agent_v1` + Confluent MCP toolkit | IBM Cloud + RTCE |

---

## Agent Pool

Eight specialist agents — each with a narrow, well-defined set of tools. The `procurement_agent` cannot call write tools. The `mitigation_agent` cannot call RAG. Each agent is independently testable and auditable.

| Agent | Role |
|---|---|
| `tsci_primary_agent` | Entry point; routes user intent to the right collaborator |
| `risk_investigation_agent` | Retrieves risk, shipment, work package, and shortage facts |
| `inventory_agent` | Finds available transfer stock across permitted locations |
| `procurement_agent` | Queries approved suppliers with live constraint status |
| `resilience_monitor_agent` | Provides the full supply network resilience picture |
| `engineering_knowledge_agent` | Retrieves RAG-grounded engineering and substitution evidence |
| `mitigation_agent` | Calls the deterministic scoring service and ranks options |
| `confluent_intelligence_agent` | Reads Kafka event traces directly for situational context |

Write tools (`execute_inventory_transfer`, `execute_supplier_expedite`, `request_mitigation_approval`) require a valid approval token — enforced at both the wxO workflow layer and the backend API layer independently.

---

## Kafka Topics

| Topic | Purpose |
|---|---|
| `turnaround.material.required` | Material demand from work packages |
| `supply.shipment.updated` | Shipment ETA and status changes |
| `supply.inventory.changed` | Inventory balance changes at warehouses |
| `supply.supplier.status.changed` | Supplier quality holds, capacity constraints, force majeure |
| `supply.port.status.changed` | Port congestion and closure events |
| `supply.risk.detected` | Risk events produced by Flink (`risk_rule_v1` + `risk_rule_v2`) |
| `supply.approved_vendor.changed` | AVL additions, revocations, and status changes |
| `supply.material.readiness.assessed` | Live resilience posture snapshots per material |
| `supply.action.completed` | Approved action execution outcomes |

---

## Quick Start — Local Demo (No Confluent or OpenSearch Required)

The backend runs in demo mode with an in-memory store seeded at startup. No external services needed.

### 1 — Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # set DEMO_USERNAME and DEMO_PASSWORD; leave Confluent/OpenSearch blank
python run.py
# → http://localhost:3001/api/docs
```

### 2 — UI

```bash
cd ui
npm install
npm run dev
# → http://localhost:3000
```

### 3 — Demo walkthrough

1. Click **"Simulate Shipment Delay"** on the Dashboard.
2. A CRITICAL risk appears — click the row to open Risk Detail.
3. Inspect **Mitigation Options**, score breakdown, and constraints.
4. Click **"Request Approval"** (TRANSFER recommended).
5. Approve — transfer executes and risk status changes to MITIGATED.
6. Open **Ask Bob** and use the suggested prompts to explore evidence.

### 4 — Launch all services at once

```bash
bash scripts/demo_runner.sh        # macOS / Linux / WSL
.\scripts\demo_runner.ps1          # Windows PowerShell
```

---

## Full Deployment

### Confluent Event Backbone

**Prerequisites**: Confluent Cloud account with Flink compute pool enabled, Terraform ≥ 1.0

```bash
cd confluent/terraform
cp terraform.tfvars.example terraform.tfvars   # fill in credentials
terraform init && terraform apply
```

Provisions: Kafka cluster, Schema Registry, Flink compute pool, 9 topics, Flink SQL risk-detection jobs, API keys, RBAC service account.

```bash
cd confluent/python
pip install -r requirements.txt
cp .env.example .env                                     # fill from terraform output
python producers/produce_material_requirement.py
python producers/produce_shipment_update.py
# Flink detects late delivery → produces supply.risk.detected
python consumers/consume_risk_detected.py                # forwards to backend API
```

### wxO Agent Deployment

```bash
# Standard pack — 7 agents, no Confluent dependency
cd wxo/standard && bash import_standard.sh

# Confluent extension — adds confluent_intelligence_agent
cd wxo/confluent && bash import_confluent.sh

# One-shot full deploy (agents + seed + tests)
bash deploy_confluent_agent.sh
```

### Continuous RAG Agent (`crag_rag_agent_v1`)

```bash
bash continuous_rag/scripts/setup.sh               # register crag.* topics + seed 9 demo events
bash continuous_rag/wxo_confluent_mcp/deploy.sh    # deploy agent + toolkit to wxO
```

| Command | Purpose |
|---|---|
| `bash continuous_rag/scripts/setup.sh` | Full bootstrap |
| `bash continuous_rag/scripts/reseed.sh` | Purge and re-seed demo events |
| `bash continuous_rag/scripts/destroy.sh` | Drop RTCE registrations |
| `bash continuous_rag/scripts/status.sh` | Show cluster and credential status |

---

## Backend Tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -v
```

~77 tests across: `test_scoring`, `test_risk_detector`, `test_approval`, `test_inventory`, `test_idempotency`, `test_resilience`, `test_api`.

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and `ui/.env.example` → `ui/.env.local`.

| Group | Key variables |
|---|---|
| Demo auth | `DEMO_USERNAME`, `DEMO_PASSWORD` |
| Confluent | `CONFLUENT_BOOTSTRAP_SERVERS`, `CONFLUENT_API_KEY`, `CONFLUENT_API_SECRET` |
| Schema Registry | `CONFLUENT_SCHEMA_REGISTRY_URL`, `SCHEMA_REGISTRY_API_KEY`, `SCHEMA_REGISTRY_API_SECRET` |
| OpenSearch | `OPENSEARCH_HOST`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD` |
| wxO | `WXO_BASE_URL`, `WXO_API_KEY` |
| UI | `VITE_WXO_BASE_URL`, `VITE_WXO_API_KEY`, `VITE_WXO_AGENT_NAME`, `VITE_WXO_CRAG_AGENT_NAME` |
| Demo mode | `DEMO_MODE=true`, `DEMO_FACILITY_LABEL`, `DEMO_WARNING=SYNTHETIC_DATA_ONLY` |

Leave Confluent and OpenSearch blank to run in local demo mode with no external dependencies.

---

## Design Principles

| Principle | What it means in practice |
|---|---|
| **Spec-driven** | Every file traces to a numbered spec in `specs/`. Code changes require a spec change first. |
| **Deterministic scoring** | LLMs explain; the scoring engine uses explicit weighted inputs only. Rankings are reproducible and auditable. |
| **Approval-gated writes** | No inventory transfer or supplier expedite executes without an APPROVED record — enforced at the API level, not just the agent level. |
| **Grounding enforced** | Substitution claims require retrieved engineering evidence (`grounded=true`). Missing evidence blocks the option. |
| **Continuous resilience** | `SupplyChainResilienceProfile` recomputed on every supplier, port, and AVL event — not on demand. |
| **Idempotent events** | Duplicate `eventId`s are silently ignored. Write actions are idempotent by design. |
| **Correlation IDs** | Every event, API call, tool invocation, audit entry, and Kafka message carries a `correlationId`. |
| **Synthetic data** | No real Shell, Pearl GTL, or operational data anywhere in this codebase. |

---

## Tech Stack

| Component | Technology | Version |
|---|---|---|
| Backend language | Python | 3.12+ |
| Backend framework | FastAPI | 0.115.5 |
| Data validation | Pydantic | 2.9.2 |
| Kafka client | confluent-kafka | 2.6.1 |
| Search client | opensearch-py | 2.7.1 |
| Frontend language | TypeScript | 5.4 |
| Frontend framework | React | 18.3 |
| UI component library | IBM Carbon React | 1.71 |
| Build tool | Vite | 5.3 |
| Infrastructure | Terraform | ≥ 1.0 |
| Agent runtime | IBM watsonx Orchestrate | — |
| Event platform | Confluent Cloud | — |
| Knowledge store | OpenSearch | 2.x |

---

## Acceptance Criteria

| SC | Description | Status |
|---|---|:---:|
| SC-001 | Delayed shipment produces a detected risk | ✅ |
| SC-002 | Agent explains impacted work package and required date | ✅ |
| SC-003 | Agent identifies at least one feasible alternative | ✅ |
| SC-004 | Engineering substitute not recommended without evidence | ✅ |
| SC-005 | Write action cannot execute before approval | ✅ |
| SC-006 | End-to-end correlation ID visible throughout | ✅ |
| SC-007 | UI shows event → risk → evidence → recommendation → approval → action | ✅ |
| SC-008 | Supplier quality hold updates resilience profile and triggers risk when all tiers constrained | ✅ |
| SC-009 | Dashboard shows live constrained / unconstrained supplier count | ✅ |
| SC-010 | Port congestion event triggers ETA re-evaluation for affected shipments | ✅ |
| SC-011 | New approved supplier immediately available in mitigation options | ✅ |

---

## IBM References

- IBM Confluent: https://www.ibm.com/products/confluent
- IBM watsonx Orchestrate: https://www.ibm.com/products/watsonx-orchestrate
- IBM watsonx Orchestrate ADK: https://developer.ibm.com/components/watson-orchestrate/
- Confluent Iceberg Sink integration with watsonx.data: https://www.ibm.com/docs/en/watsonxdata/saas?topic=integrations-integrating-confluent-apache-iceberg-sink-connector
- IBM Carbon Design System: https://carbondesignsystem.com
