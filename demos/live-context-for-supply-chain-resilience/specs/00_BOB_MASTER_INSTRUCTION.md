# Bob Master Implementation Instruction
## Oil & Gas Turnaround Supply Chain Intelligence (TSCI)

> **Authority**: This document is the top-level engineering contract for the TSCI system.
> Every implementation decision must be traceable to a spec section in this repository.
> No component may be built, modified, or deleted unless it is governed by an approved spec.

---

## 1. Document Purpose and Authority

This file is the canonical instruction set for the engineering agent (Bob) responsible for
implementing the TSCI solution. It establishes:

- the architecture boundaries each layer must respect,
- the spec-driven development rules that govern every change,
- the supply chain resilience invariants that must never be violated,
- the implementation quality standards applied to every deliverable,
- the build order and phase gates,
- the checkpoint format used to close each phase.

Any conflict between a downstream spec (02–14) and this document resolves in favour of this
document unless a spec change is explicitly approved and recorded here.

---

## 2. Architecture Boundaries

The system is composed of six layers. Each layer has exclusive ownership of its domain.
Cross-layer dependencies flow only in the permitted directions defined below.

### Layer 1 — Confluent Cloud (Event Transport)
- **Owns**: event transport, all Kafka topic schemas, Schema Registry governance, stream-driven
  risk signals, and all resilience event streams.
- **Topics under governance**:
  - `turnaround.material.required`
  - `supply.shipment.updated`
  - `supply.inventory.changed`
  - `supply.supplier.status.changed`
  - `supply.port.status.changed`
  - `supply.risk.detected`
  - `supply.approved_vendor.changed`
  - `supply.material.readiness.assessed`
  - `supply.action.completed`
- **Schema Registry**: all topic schemas are registered with `BACKWARD_TRANSITIVE`
  compatibility. No consumer may break on a schema that was valid in any prior version.
- **Permitted callers**: Application Backend (producer/consumer), Confluent Intelligence Agent
  (read-only consumer via tools).
- **Not permitted**: UI may never produce or consume Kafka events directly. wxO agents may
  not consume Kafka events directly; they read via Backend tool APIs.

### Layer 2 — Application Backend (Python 3.11 / FastAPI, port 3001)
- **Owns**: domain APIs, typed adapters, deterministic scoring, resilience correlation engine,
  in-memory data store seeded at startup, idempotent event consumers, audit trail persistence.
- **Resilience correlation engine**: recomputes `SupplyChainResilienceProfile` whenever a
  contributing Confluent event arrives; emits `supply.material.readiness.assessed` and
  (when thresholds are breached) `supply.risk.detected` using `risk_rule_v2`.
- **Permitted callers**: UI (REST), wxO agents (REST via registered tools), Confluent
  consumers (internal, background).
- **Not permitted**: Backend must not call wxO agent APIs directly.

### Layer 3 — OpenSearch / RAG
- **Owns**: searchable enterprise knowledge index, retrieval logic, evidence selection,
  citation payloads, and grounded-answer construction.
- **Permitted callers**: Engineering Knowledge Agent (via RAG tool), Backend search endpoint.
- **Not permitted**: RAG must not produce fabricated content when evidence is absent;
  it must return a no-evidence flag and trigger escalation logic.

### Layer 4 — IBM watsonx Orchestrate (wxO)
- **Owns**: runtime agent orchestration, collaborator agent routing, deterministic action
  workflows, human-approval gates, and agent-level audit events.
- **Agents** (8 total):
  - `tsci_primary_agent` — entry point, routes to collaborators
  - `risk_investigation_agent` — drives end-to-end investigation chain
  - `inventory_agent` — inventory and transfer feasibility
  - `procurement_agent` — approved vendor and procurement options
  - `resilience_monitor_agent` — live resilience posture queries
  - `engineering_knowledge_agent` — RAG-grounded engineering evidence
  - `mitigation_agent` — option ranking and recommendation
  - `confluent_intelligence_agent` — stream-level event queries
- **Tools** (22 total): 7 read tools, 3 write tools, 4 resilience tools, 8 Confluent tools.
  Read and write tool sets are strictly separate; a write tool may not appear in a
  read-only agent configuration.
- **Not permitted**: wxO agents may not bypass human approval before executing a write action.

### Layer 5 — React 18 UI (IBM Carbon Design, port 3000)
- **Owns**: control tower visualisation, risk list, resilience posture dashboard,
  investigation chat, approval UI, action status display.
- **Not permitted**: UI must not contain business logic, scoring functions, or risk rules.
  All data comes from Backend REST APIs or wxO embedded experience.

### Layer 6 — Bob (Engineering Agent)
- **Owns**: spec interpretation, code generation, test generation, phase validation.
- **Not permitted**: Bob must not claim access to Shell production data, generate
  unapproved spec changes, or skip a phase gate.

---

## 3. Spec-Driven Development Rules (10 Non-Negotiables)

| # | Rule |
|---|------|
| **SDD-01** | Treat all approved specifications in this repository as authoritative source of truth. Code that contradicts a spec is a bug, not a feature. |
| **SDD-02** | Do not begin a phase until its required input specs and acceptance criteria are present and approved. |
| **SDD-03** | Do not silently change a domain object, event schema, API contract, agent tool contract, retrieval contract, or workflow behaviour. Any such change must follow the spec-change process in Section 8. |
| **SDD-04** | Prefer small, independently testable components. A file that cannot be unit-tested in isolation is too large. |
| **SDD-05** | Generate tests from acceptance criteria before considering an implementation complete. Tests are not optional; they are the proof of compliance. |
| **SDD-06** | Produce synthetic and demo data only. Never claim access to Shell or any operator's production data, credentials, or operational values. |
| **SDD-07** | Keep read tools and write tools strictly separate. A read tool must have no side effects. A write tool must require an explicit approval token. |
| **SDD-08** | Do not perform a business-changing write action without an explicit approval token or approval state recorded in the audit trail. |
| **SDD-09** | All agent recommendations must be explainable using structured facts from tool responses and/or retrieved evidence with citations. Speculation is not permitted. |
| **SDD-10** | If evidence is missing, ambiguous, or conflicting, the agent must escalate to a human rather than invent an answer. |

---

## 4. Supply Chain Resilience Invariants

These rules are absolute. A build that violates any of them is non-compliant regardless of
passing tests.

| ID | Invariant |
|----|-----------|
| **RI-01** | A supplier with an active `HIGH` or `CRITICAL` `SupplierConstraint` must never appear as an unconstrained sourcing option in any mitigation ranking. |
| **RI-02** | `SupplyChainResilienceProfile.unconstrainedApprovedSupplierCount` must exclude suppliers with active `QUALITY_HOLD`, `FORCE_MAJEURE`, or `CAPACITY_CONSTRAINT` constraints. |
| **RI-03** | `ApprovedVendorEntry.status == REVOKED` or `SUSPENDED` unconditionally excludes that supplier from all feasible options. |
| **RI-04** | The `resilience_monitor_agent` must be called in the full investigation orchestration chain — it is not optional. Omitting it violates the workflow contract. |
| **RI-05** | Every agent recommendation output must include the `Resilience_posture` section and `resilience_context` fields as defined in spec 13. |
| **RI-06** | If the resilience profile is stale at recommendation or execution time, the system must surface the `RESILIENCE_PROFILE_STALE` warning to the operator before proceeding. |
| **RI-07** | The `revalidate_supplier_constraint_status` and `revalidate_avl_status` steps in the deterministic workflow are mandatory. They may not be conditionally skipped. |
| **RI-08** | `supply.material.readiness.assessed` must be emitted whenever the resilience posture changes for a critical material, regardless of whether a shipment delay triggered the change. |
| **RI-09** | Port congestion events (`supply.port.status.changed`) must trigger ETA re-evaluation for all active shipments routed through the affected port. |
| **RI-10** | An approved vendor added to the AVL with `APPROVED` status must be reflected in the feasible options set within one event processing cycle. |

---

## 5. Implementation Quality Standards

### 5.1 Type Safety
- All Python modules must use full type annotations (Python 3.12+).
- All Pydantic models must use `model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")`.
- TypeScript/React components must use strict TypeScript; no `any` types in production paths.

### 5.2 Configuration
- All secrets and environment-specific values are managed through environment variables.
- No secret value may appear in source code or in any committed file.
- `.env.example` files must document every required variable with a safe placeholder value.
- The application must fail fast at startup if a required environment variable is missing.

### 5.3 Idempotency
- All Kafka event consumers must be idempotent: processing the same event twice must produce
  the same state as processing it once.
- All write API endpoints must be idempotent using a client-supplied `requestId` field.
- All deterministic workflow actions must record their idempotency key before executing.

### 5.4 Correlation IDs
- Every Kafka event must carry a `correlationId` field in its payload.
- Every Backend API request must propagate `X-Correlation-ID` through all downstream calls.
- Every agent tool response must include the `correlationId` sourced from the triggering event.
- The UI must display the `correlationId` on every risk card and action record.

### 5.5 Structured Logging
- All Backend services must emit JSON-structured logs using a configurable log level.
- Log entries for risk events must include: `correlationId`, `riskId`, `materialCode`,
  `workPackageId`, `eventType`, and `timestamp`.
- No PII or sensitive operational values may appear in logs.

### 5.6 Test Coverage Requirements
| Test Type | Minimum Coverage | Where |
|-----------|-----------------|-------|
| Unit tests | All domain logic, scoring functions, resilience engine | `backend/tests/unit/` |
| Contract tests | All API endpoints, all event schemas | `backend/tests/contract/` |
| Integration tests | Resilience scenarios from spec 10 | `backend/tests/integration/` |
| RAG evaluation tests | Retrieval quality, evidence grounding | `backend/tests/rag/` |
| Agent workflow tests | wxO agent flows, approval gates | `wxo/tests/` |
| E2E smoke test | Demo scenario CVA-8842 → SHP-90017 end to end | `tests/e2e/` |

### 5.7 Seed Data
- In-memory store is seeded at application startup from `backend/seed/` JSON files.
- Seed data is synthetic. All company names, part numbers, and transaction IDs are fabricated.
- Demo scenario seed: shipment `SHP-90017`, PO `CVA-8842`, work package `TW-2047`,
  Pearl GTL context, delay from `2026-10-07` to `2026-10-14`.
- Resilience seed: includes supplier quality hold event, port congestion event, AVL change
  event per spec 12.

---

## 6. Build Order (Phases 1–5)

### Phase 1 — Foundation
**Inputs**: specs 02 (Domain Model), 03 (Event Contracts)
**Deliverables**:
- Kafka topics provisioned (Confluent Terraform or local Docker Kafka)
- Schema Registry schemas registered
- Backend skeleton: FastAPI app, health endpoint, config module, structured logging
- Domain model classes (Pydantic) from spec 02
- In-memory store with seed loader
- Unit tests for domain models and seed loader

**Gate**: All domain model unit tests pass. Health endpoint returns 200.

### Phase 2 — Data and Events
**Inputs**: specs 03 (Event Contracts), 04 (API and Tool Contracts), 12 (Demo Data)
**Deliverables**:
- Kafka producers and consumers (shipment, inventory, supplier status, port status, AVL)
- Resilience correlation engine (consumes events, maintains `SupplyChainResilienceProfile`)
- All 22 tool API endpoints implemented and tested
- Seed data populated for demo scenario
- Contract tests for all API endpoints

**Gate**: All contract tests pass. Demo seed data loads correctly. Resilience profile updates
on event receipt.

### Phase 3 — Intelligence Layer
**Inputs**: specs 05 (RAG), 06 (Agent/Workflow), 09 (Scoring), 13 (Resilience)
**Deliverables**:
- OpenSearch index populated with engineering/procurement knowledge
- RAG retrieval pipeline with evidence and citation payloads
- All 8 wxO agents configured with correct tool bindings
- Deterministic scoring service
- Mitigation ranking with resilience constraint filtering
- Agent workflow tests including approval gate enforcement

**Gate**: SC-001 through SC-007 pass in isolation. RAG returns evidence for all seeded
knowledge queries. Approval gate blocks write tools without token.

### Phase 4 — Resilience and Continuous Flow
**Inputs**: specs 13 (Resilience), 14 (Continuous RAG)
**Deliverables**:
- Full resilience event processing (supplier hold, port congestion, AVL change)
- `supply.material.readiness.assessed` emission logic
- Resilience-driven `supply.risk.detected` (risk_rule_v2)
- Continuous RAG agent with `crag.*` topics
- All resilience integration tests from spec 10

**Gate**: SC-008 through SC-011 pass. Resilience profile updates visible in dashboard.

### Phase 5 — UI and Demo Polish
**Inputs**: specs 07 (UI), 08 (Security/NFR), 11 (Delivery Plan), 12 (Demo Data)
**Deliverables**:
- React 18 IBM Carbon control tower with full demo flow
- Resilience posture dashboard
- Approval UI with audit trail display
- Correlation ID visible on all risk cards
- E2E smoke test covering full demo scenario
- `playbook.md` with copy-paste demo commands

**Gate**: Full demo scenario runs without error. All SC-001 through SC-011 pass end to end.
`playbook.md` validated by a dry run.

---

## 7. Implementation Checkpoint Format

At the close of each phase, the engineering agent must return a checkpoint report in the
following structure. This report is not optional; phase gate approval requires it.

```markdown
## Phase N Checkpoint Report

### Files Created / Changed
- <path> — <one-line description>

### Acceptance Criteria Satisfied
| Criterion | Status | Evidence |
|-----------|--------|----------|

### Automated Test Results
| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|

### Assumptions Made
1. ...

### Unresolved Risks
| Risk | Severity | Mitigation |
|------|----------|------------|

### Next Phase
Phase N+1 — <name>. Blocked on: <any missing inputs>
```

---

## 8. Handling Spec Changes

When an implementation requirement conflicts with an existing spec, or when new information
requires a spec change, the following process is mandatory:

1. **Identify** the specific spec file, section, and field that must change.
2. **Propose** the change in a GitHub issue or PR description with the reason.
3. **Identify** all components, tests, and downstream specs impacted by the change.
4. **Update** the spec file with the approved change and increment the spec version comment
   at the top of the file.
5. **Implement** the code change that reflects the updated spec.
6. **Re-run** all tests that are impacted by the change and confirm they pass.
7. **Update** the Phase Checkpoint Report to reference the spec change.

A code change that contradicts a spec without following this process is a compliance violation
and must be reverted.

---

## 9. Demo Scenario Reference

| Field | Value |
|-------|-------|
| Operator context | Shell Pearl GTL, Ras Laffan, Qatar (synthetic demo) |
| Turnaround work package | TW-2047 |
| Critical material | CVA-8842 — Control Valve Actuator |
| Affected shipment | SHP-90017 |
| Original ETA | 2026-10-07 |
| Delayed ETA | 2026-10-14 |
| Schedule exposure | 7 days |
| Primary constraint | Port congestion — primary supplier |
| Secondary constraint | Quality hold — secondary supplier |
| Mitigation path | Stock transfer from REGIONAL-WH-DEMO |
| Engineering substitute | Not recommended — insufficient current documentation |

This scenario is the end-to-end acceptance test for the full system. Every phase must
preserve the ability to run this scenario successfully.

---

*Spec version: 2.0 — Updated to full implementation authority document.*
