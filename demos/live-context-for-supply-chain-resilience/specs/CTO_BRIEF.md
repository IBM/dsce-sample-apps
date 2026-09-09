# CTO Brief
## Oil & Gas Turnaround Supply Chain Intelligence (TSCI)
### Executive Summary for Technical Leadership

---

## 1. What This System Does and Why It Matters

A major oil & gas turnaround — a planned shutdown for maintenance and inspection of a process
plant — requires thousands of critical materials to arrive on time across a window of weeks.
A single delayed part on the critical path can idle a work package worth millions in lost
production per day.

The Turnaround Supply Chain Intelligence (TSCI) system addresses one high-value question:

> **"Is this material going to be here on time, and if not, what exactly should we do about it —
> right now, with evidence?"**

Today, answering that question requires a planner to manually cross-reference shipment tracking,
inventory systems, the approved vendor list, engineering documentation, and the turnaround
schedule. That takes hours. TSCI does it in seconds, with a ranked, governed, evidence-backed
recommendation ready for one-click human approval.

The system also maintains a **continuous supply chain resilience posture** — a live picture of
how many approved suppliers are unconstrained for each critical material — so that a quality
hold, port congestion event, or AVL change is surfaced before it becomes a schedule crisis.

---

## 2. Business Value

| Problem Today | What TSCI Delivers |
|--------------|-------------------|
| Supply disruption identified hours or days late | Risk detected within one event processing cycle of a shipment update |
| Manual correlation across 3–5 systems | Single governed intelligence layer correlates events automatically |
| Alternative suppliers assessed without constraint visibility | AVL queried with live constraint status; constrained suppliers filtered out by rule |
| Engineering substitutes proposed without documentation check | RAG evidence retrieved before substitute is considered; insufficient evidence blocks recommendation |
| Actions taken without audit trail | Every action requires approval token; full chain logged from source event to outcome |
| Resilience depth unknown until it is too late | Continuous `SupplyChainResilienceProfile` per material, updated on every supplier, port, or AVL event |

---

## 3. Demo Scenario — Pearl GTL Turnaround

The demo is anchored at **Shell Pearl GTL, Ras Laffan, Qatar** — one of the world's largest
gas-to-liquids facilities — as a public industry context. All transaction data is **fully
synthetic**. No real operational data is used.

### The scenario in plain English

A control valve actuator (**CVA-8842**) is required for turnaround work package **TW-2047**
(a critical inspection and replacement activity on Unit 14). The required-by date is
**2026-10-07**.

Shipment **SHP-90017** is delayed. Its new ETA is **2026-10-14** — seven days past the
required date. Meanwhile:
- The primary supplier's port is congested, making expediting ineffective.
- The secondary supplier is on a quality hold.
- The tertiary supplier is unconstrained but has a longer lead time.

The system must determine whether the work package is at risk, what options exist, and which
one to propose for human approval — with the full evidence trail attached.

### What the demo shows

| Moment | What the operator sees |
|--------|----------------------|
| T+0 | Shipment delay event arrives in Confluent |
| T+5s | Risk raised: TW-2047 at risk, 7-day exposure, SHP-90017 causal event |
| T+15s | Investigation complete: primary and secondary suppliers both constrained, REGIONAL-WH-DEMO has transferable stock |
| T+20s | Mitigation ranked: (1) stock transfer — lowest risk, (2) tertiary supplier expedite, (3) substitute — blocked, evidence insufficient |
| T+25s | Correlation ID visible on risk card, resilience posture displayed |
| T+30s | Operator approves stock transfer; action executed; risk closed |

---

## 4. Architecture at a Glance

```
Sense → Correlate → Retrieve → Reason → Recommend → Approve → Act
```

| Layer | Technology | What It Does |
|-------|-----------|-------------|
| **Event Transport** | Confluent Cloud Kafka + Schema Registry | Receives shipment, inventory, supplier status, port status, AVL events; enforces schema contracts |
| **Backend** | Python 3.11 FastAPI (port 3001) | Risk detection, resilience correlation engine, deterministic scoring, 22 tool APIs, in-memory store |
| **Knowledge** | OpenSearch 2.x + RAG | Hybrid retrieval of engineering/procurement evidence; citation payloads for every grounded claim |
| **Agents** | IBM watsonx Orchestrate (8 agents) | Orchestrates investigation, resilience checks, mitigation ranking, and approval workflow |
| **UI** | React 18 + IBM Carbon (port 3000) | Control tower: risk list, resilience posture dashboard, evidence panel, approval UI |
| **Engineering** | IBM Bob | Spec-driven implementation; code and test generation from approved contracts |

### Kafka Topics (9)

| Topic | Purpose |
|-------|---------|
| `turnaround.material.required` | Material demand from work packages |
| `supply.shipment.updated` | Shipment ETA and status changes |
| `supply.inventory.changed` | Inventory balance changes at warehouses |
| `supply.supplier.status.changed` | Supplier quality holds, capacity constraints, force majeure |
| `supply.port.status.changed` | Port congestion and closure events |
| `supply.risk.detected` | Risk events produced by backend (risk_rule_v1 + risk_rule_v2) |
| `supply.approved_vendor.changed` | AVL additions, revocations, and status changes |
| `supply.material.readiness.assessed` | Live resilience posture snapshots per material |
| `supply.action.completed` | Approved action execution outcomes |

### wxO Agents (8)

| Agent | Role |
|-------|------|
| `tsci_primary_agent` | Entry point; intent routing to collaborators |
| `risk_investigation_agent` | Orchestrates full investigation chain |
| `inventory_agent` | Inventory query and transfer feasibility |
| `procurement_agent` | AVL query and approved sourcing options |
| `resilience_monitor_agent` | Live resilience posture queries (mandatory in chain) |
| `engineering_knowledge_agent` | RAG-grounded engineering/procurement evidence |
| `mitigation_agent` | Deterministic option ranking and recommendation |
| `confluent_intelligence_agent` | Stream-level event queries for situational awareness |

---

## 5. Key Design Decisions

### 5.1 Deterministic Scoring — Not LLM Ranking

Mitigation options are ranked by a deterministic scoring function in the Backend, not by
the LLM. The four scoring dimensions (schedule risk, technical risk, supply risk, cost risk)
are computed from structured data fields. The LLM explains the recommendation; it does not
make it. This means the ranking is reproducible, auditable, and testable.

**Why it matters**: In a safety-critical industrial context, a planner needs to trust that
the top-ranked option is top-ranked for a specific, defensible reason — not because a
language model happened to prefer it.

### 5.2 Approval Gates — Human in the Loop, Always

No write action executes without an approval token issued by a human operator. The Backend
enforces this at the API level: write tool calls without a valid token return HTTP 403. The
wxO workflow will not call a write tool unless the approval state is set.

**Why it matters**: Autonomous procurement or transfer actions in an active turnaround can
cascade into unintended cost, contractual, and operational consequences. The system is a
decision-support and execution-assist tool, not an autonomous agent.

### 5.3 Evidence Grounding — No Fabrication Permitted

Engineering substitution claims require RAG-retrieved evidence with a recency-valid citation.
If the retrieved evidence is absent or dated beyond the configured threshold, the system
returns `evidenceStatus: INSUFFICIENT` and suppresses the substitution option from the
recommendation. The agent escalates rather than invents.

**Why it matters**: In oil & gas, using an unapproved or undocumented substitute in a
critical application is a safety and compliance risk, not just an operational one.

### 5.4 Supply Chain Resilience Posture — Continuous, Not On-Demand

The `SupplyChainResilienceProfile` for each critical material is maintained continuously by
the resilience correlation engine as supplier, port, and AVL events arrive — not computed
on demand when a risk is raised. This means the system can detect resilience degradation
before a shipment delay occurs.

**Why it matters**: By the time a shipment delay triggers an alert, the window to act may
already be narrow. Knowing that a supplier's quality hold has reduced the unconstrained
option count to zero — three days earlier — gives the operator time to respond.

### 5.5 Spec-Driven Build — Contracts First, Code Second

The system is built from 15 authoritative specification files that define every domain object,
event schema, API contract, agent tool, scoring rule, and acceptance criterion before any
code is written. Implementation is validated against these contracts at each phase gate.

**Why it matters**: A complex multi-layer system (Kafka + FastAPI + OpenSearch + wxO + React)
can accumulate integration debt rapidly if contracts are informal. Spec-driven development
forces explicit decisions about interfaces before implementation, and makes changes traceable.

---

## 6. What Is Real vs Synthetic in the Demo

| Component | Real | Synthetic / Simulated |
|-----------|------|----------------------|
| IBM watsonx Orchestrate platform | ✅ Real wxO instance | — |
| Confluent Cloud Kafka | ✅ Real Confluent cluster | — |
| OpenSearch index | ✅ Real OpenSearch instance | — |
| FastAPI backend | ✅ Real running service | — |
| React UI | ✅ Real running UI | — |
| Shell Pearl GTL context | ❌ | Used as industry anchor only |
| Transaction data (SHP-90017, CVA-8842, TW-2047) | ❌ | Fully synthetic seed data |
| Supplier names and capabilities | ❌ | Fabricated for demo |
| Engineering documentation | ❌ | Synthetic knowledge articles in OpenSearch |
| Inventory balances | ❌ | Seeded in-memory store |
| Financial values | ❌ | Not used in demo |

---

## 7. Technology Choices and Rationale

| Technology | Choice | Why |
|-----------|--------|-----|
| Event platform | Confluent Cloud | Schema Registry, BACKWARD_TRANSITIVE compatibility enforcement, managed infrastructure |
| Backend language | Python 3.12 FastAPI | Strong typing with Pydantic, async support, fast iteration, familiar to IBM team |
| Knowledge retrieval | OpenSearch + hybrid RAG | Hybrid dense + BM25 delivers better recall than vector-only on short technical queries |
| Agent platform | IBM watsonx Orchestrate | Native tool registration, deterministic workflow support, human approval patterns |
| UI framework | React 18 + IBM Carbon | IBM design system, accessible, proven for enterprise dashboards |
| Data contract enforcement | Pydantic `extra="forbid"` | Fails fast on unexpected fields rather than silently ignoring them |
| Scoring approach | Deterministic multi-dimension | Reproducible, auditable, testable — no LLM subjectivity in the ranking |

---

## 8. Production Path

This demo establishes the architecture, contracts, and agent patterns required for a
production deployment. The following steps would be required to move from demo to production:

| Step | What It Involves |
|------|-----------------|
| 1. Data integration | Replace synthetic seed store with live feeds from ERP (SAP MM), logistics APIs, and warehouse management systems |
| 2. AVL integration | Connect approved vendor list to real procurement master data; consume live supplier status events |
| 3. Identity and access | Add enterprise SSO; role-based access control for approval actions |
| 4. Persistence | Replace in-memory store with a transactional database (PostgreSQL or equivalent) |
| 5. Knowledge index | Populate OpenSearch with real engineering standards, procurement policy documents, and historical turnaround records |
| 6. Audit and compliance | Connect audit trail to enterprise record-keeping and change management systems |
| 7. Scaling | Confluent consumer group scaling; Backend horizontal scaling behind a load balancer |
| 8. Monitoring | Wire structured logs to enterprise observability platform (Instana, Splunk, or equivalent) |

---

## 9. Risk Mitigations Built In

| Risk | Mitigation Built Into the System |
|------|----------------------------------|
| LLM hallucination on critical recommendations | Deterministic scoring; RAG grounding requirement; escalation on missing evidence |
| Autonomous action causing operational harm | Mandatory human approval token before any write tool executes |
| Stale resilience data causing wrong recommendation | `RESILIENCE_PROFILE_STALE` warning surfaced at recommendation time; AVL timestamp recorded in profile |
| Schema drift breaking event consumers | Schema Registry with `BACKWARD_TRANSITIVE` compatibility; consumers validated against registered schema |
| Compliance audit gaps | Correlation ID end-to-end; full audit trail from source event to action outcome |
| Demo data exposure | All seed data is synthetic; `.env` files excluded from version control; no real credentials in code |

---

## 10. Approval Requested

Approval to proceed with the full technical implementation using this architecture and the
phased spec-driven build approach defined in `specs/00_BOB_MASTER_INSTRUCTION.md`.

The system is designed to be demonstrable, extensible, and safe. It does not replace
the human decision-maker — it gives them better information, faster, with a governed
path to action.

---

*CTO Brief version: 2.0 — Updated to full executive brief with architecture, design decisions,
production path, and risk mitigations.*

---

## 8. Production Path

Moving from demo to production requires the following steps:

| Step | Action | Effort estimate |
|---|---|---|
| 1 | Replace in-memory store with a persistent database (PostgreSQL or equivalent) | Medium |
| 2 | Connect live Confluent topics to ERP/logistics adapters instead of demo producers | High |
| 3 | Populate OpenSearch with real engineering documentation corpus | Medium |
| 4 | Configure IBM Cloud IAM RBAC for production wxO instance | Low |
| 5 | Replace demo user approval with enterprise SSO-backed approval workflow | Medium |
| 6 | Enable structured audit logging to SIEM/log management platform | Low |
| 7 | Configure Confluent Schema Registry for production topic governance | Low |
| 8 | Run full acceptance test suite against production-like seed data | Medium |

The architecture requires no redesign for production — only adapters and persistence backends change.

---

## 9. Risk Mitigations Built In

| Risk | Mitigation |
|---|---|
| LLM hallucination of inventory or supplier data | Deterministic scoring engine — LLMs only explain, never decide |
| Unauthorised inventory transfer | Approval gate with SHA-256 option hash — execution blocked if recommendation changed post-approval |
| Stale resilience data driving wrong recommendation | RESILIENCE_PROFILE_STALE warning surfaced at recommendation and execution time |
| Engineering substitution without validation | Substitution option marked infeasible unless RAG retrieves approved engineering evidence (grounded=true) |
| Duplicate event processing causing phantom risks | Idempotency keys on all event consumers — duplicate eventIds silently ignored |
| Constrained supplier appearing as valid option | Hard constraint: QUALITY_HOLD/FORCE_MAJEURE/CAPACITY_CONSTRAINT at HIGH/CRITICAL excludes supplier from all feasible options |
| Loss of traceability | End-to-end correlationId propagated from source event through every API call, agent tool, audit entry, and Kafka message |
| Demo data leaking into production | Fully synthetic seed data with DEMO_WARNING=SYNTHETIC_DATA_ONLY flag — no Shell or Pearl GTL operational data anywhere in the codebase |

