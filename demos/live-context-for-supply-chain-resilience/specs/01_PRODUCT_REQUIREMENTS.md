# Product Requirements Specification
## Oil & Gas Turnaround Supply Chain Intelligence (TSCI)
### Version 2.0

---

## 1. Executive Summary

Turnaround operations at large process plants — refineries, LNG facilities, GTL plants — require
critical maintenance materials to arrive on time. A single delayed part can idle a multi-million
dollar work package and push a plant's return to service by days or weeks.

The Turnaround Supply Chain Intelligence (TSCI) system converts supply-chain disruption signals
into contextual, explainable, actionable risk assessments in near real time. It maintains a
continuous picture of the **supply chain resilience posture** for every critical material — across
the full approved-vendor network — so that constraints in any sourcing tier are surfaced before
they cascade into turnaround schedule risk.

The system is anchored to a demo scenario at Shell Pearl GTL (Ras Laffan, Qatar) using fully
synthetic transaction data. It demonstrates how IBM watsonx Orchestrate agents, Confluent Cloud
event streams, OpenSearch RAG, and a deterministic scoring backend can collectively replace
manual supply-chain correlation with a governed, evidence-backed intelligence layer.

---

## 2. Problem Statement

Turnaround planners, maintenance teams, procurement specialists, and supply-chain managers can
access purchase-order status, shipment tracking, inventory balances, and work-package schedules
in their respective enterprise systems. What they cannot easily do is:

1. **Correlate in real time** — determine instantly whether a shipment delay threatens a specific
   work package on the critical path.
2. **Assess resilience depth** — know whether alternative suppliers in the approved vendor list
   (AVL) are themselves constrained by quality holds, capacity issues, or force majeure.
3. **Surface inventory options** — identify transferable stock across warehouse locations that
   could cover the shortfall.
4. **Ground substitution claims** — confirm whether an engineering substitute has current, valid
   technical documentation before recommending it.
5. **Act with governance** — execute a procurement or transfer action through a workflow that
   enforces human approval and generates a complete audit trail.

The manual effort to answer these five questions during an active turnaround can take hours.
By then the schedule impact is already locked in.

---

## 3. Stakeholders and Personas

### 3.1 Primary Persona — Turnaround Planner

| Attribute | Detail |
|-----------|--------|
| **Role** | Owns the turnaround master schedule and critical-path work packages |
| **Primary goal** | Know immediately when a supply disruption threatens a work package, and know what actionable options exist |
| **Secondary goal** | Have confidence that recommended options are feasible (no constrained suppliers, no unverified substitutes) |
| **Pain point today** | Must manually cross-reference 3–5 systems to understand supply risk; no single view of resilience posture |
| **Success state** | Receives a ranked, evidence-backed mitigation recommendation with a one-click approval path |

### 3.2 Secondary Persona — Supply Chain Manager

| Attribute | Detail |
|-----------|--------|
| **Role** | Manages approved vendor relationships, AVL governance, and procurement strategy |
| **Primary goal** | Maintain live visibility of which suppliers are constrained across all active materials |
| **Pain point today** | AVL changes and supplier quality events are communicated ad hoc; reactive rather than proactive |
| **Success state** | Real-time dashboard showing constrained vs unconstrained supplier count per critical material |

### 3.3 Secondary Persona — Procurement Specialist

| Attribute | Detail |
|-----------|--------|
| **Role** | Executes sourcing actions: expediting shipments, raising emergency POs, arranging logistics |
| **Primary goal** | Receive a specific, approved action instruction with all supporting data attached |
| **Pain point today** | Gets incomplete or inconsistent data when asked to act urgently; no traceability on who recommended what |
| **Success state** | Action instruction includes correlation ID, supporting evidence, approval record, and deterministic workflow output |

### 3.4 Secondary Persona — Maintenance Planner

| Attribute | Detail |
|-----------|--------|
| **Role** | Owns work package scoping, resource assignment, and execution sequencing |
| **Primary goal** | Understand schedule exposure as early as possible so rescheduling options can be evaluated |
| **Pain point today** | Informed of supply risk late; limited ability to sequence around delayed materials |
| **Success state** | Receives risk notification with schedule exposure (days) and available mitigation paths before work package start date |

### 3.5 Secondary Persona — Reliability / Engineering Reviewer

| Attribute | Detail |
|-----------|--------|
| **Role** | Technical authority for engineering substitution decisions |
| **Primary goal** | Ensure no substitute is used in a critical application without current, validated documentation |
| **Pain point today** | Ad-hoc requests for substitution approval arrive without evidence attached |
| **Success state** | Any substitution path surfaces the RAG-retrieved documentation evidence; escalates if evidence is insufficient |

---

## 4. Primary User Journey — Shipment Delay to Mitigated

| Step | Actor | Action | System Response |
|------|-------|--------|-----------------|
| 1 | Logistics system | Shipment ETA updated: SHP-90017 moves from 2026-10-07 to 2026-10-14 | Confluent receives `supply.shipment.updated` event |
| 2 | Backend | Event consumed by risk processor | Validates event schema; correlates to material requirement for TW-2047 |
| 3 | Backend | Checks inventory at all permitted locations | Determines available unreserved stock is insufficient to cover the 7-day gap |
| 4 | Backend | Emits risk event | `supply.risk.detected` with `risk_rule_v2`, resilience flags populated from current `SupplyChainResilienceProfile` |
| 5 | wxO | `tsci_primary_agent` receives risk event notification | Routes to `risk_investigation_agent` |
| 6 | wxO | `risk_investigation_agent` orchestrates investigation | Calls: `get_shipment_details`, `get_work_package`, `get_material_requirement`, `get_inventory_by_location` |
| 7 | wxO | `resilience_monitor_agent` called (mandatory) | Returns live `SupplyChainResilienceProfile` for CVA-8842: primary supplier port-congested, secondary on quality hold |
| 8 | wxO | `procurement_agent` queries AVL | Returns feasible unconstrained suppliers; excludes constrained ones per RI-01 |
| 9 | wxO | `engineering_knowledge_agent` queries RAG | Returns evidence on approved substitute; evidence is dated — insufficient for recommendation |
| 10 | wxO | `mitigation_agent` ranks options | Three options scored: (1) stock transfer REGIONAL-WH-DEMO, (2) expedite with tertiary supplier, (3) substitute rejected due to evidence gap |
| 11 | Planner | Reviews recommendation in UI | Sees ranked options, evidence, resilience posture, correlation ID, and approval button |
| 12 | Planner | Approves stock transfer | Deterministic workflow executes; `supply.action.completed` emitted; risk status updated to MITIGATED |

---

## 5. Resilience Journey — Continuous Parallel Flow

This journey runs independently of the primary journey and continuously updates the system's
resilience picture for all critical materials.

| Step | Trigger | System Action |
|------|---------|---------------|
| R1 | `supply.supplier.status.changed` (quality hold on primary supplier) | Resilience correlation engine updates `SupplyChainResilienceProfile`; decrements `unconstrainedApprovedSupplierCount` |
| R2 | Profile threshold breached (count < minimum) | Backend emits `supply.risk.detected` (risk_rule_v2) even without a shipment delay |
| R3 | Backend emits `supply.material.readiness.assessed` | Control tower dashboard updates readiness status for CVA-8842 |
| R4 | `supply.port.status.changed` (congestion at primary port) | Backend re-evaluates ETA impact for all shipments routed via that port; contributing shipments re-assessed |
| R5 | `supply.approved_vendor.changed` (new APPROVED supplier added to AVL) | Feasible options set updated immediately; open risk events re-evaluated |
| R6 | Operator queries resilience posture | `resilience_monitor_agent` returns live profile: constrained count, unconstrained count, inventory coverage, transfer locations |

---

## 6. Functional Requirements

### 6.1 Core Event Processing

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-001** | Ingest `supply.shipment.updated` events from Confluent in real time | Must Have | Foundation of primary journey |
| **FR-002** | Validate event schema against Schema Registry on every message; reject malformed events with a structured error log | Must Have | Prevents bad data corrupting risk state |
| **FR-003** | Detect a material-readiness risk when shipment ETA exceeds material required date and available unreserved inventory is insufficient at any permitted location | Must Have | Core risk detection logic |
| **FR-004** | Correlate material part number to a turnaround work package and required-by date using the seeded material requirements store | Must Have | Links supply disruption to schedule impact |
| **FR-005** | Calculate schedule exposure in days: `exposureDays = eta - requiredDate` | Must Have | Quantifies business impact |

### 6.2 Inventory and Sourcing

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-006** | Retrieve inventory balances across all permitted warehouse locations; report unreserved quantity at each | Must Have | Enables stock transfer mitigation |
| **FR-007** | Retrieve the current approved vendor list (AVL) for a given material; include each supplier's live constraint status | Must Have | Enables alternative sourcing assessment |
| **FR-008** | Filter the feasible sourcing options set to exclude suppliers with active `HIGH` or `CRITICAL` constraints or `REVOKED`/`SUSPENDED` AVL status | Must Have | Resilience invariant RI-01, RI-03 |
| **FR-009** | Retrieve logistics lead time and delivery window for each feasible supplier | Should Have | Enables on-time feasibility scoring |

### 6.3 Knowledge Retrieval and Evidence

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-010** | Retrieve engineering and procurement knowledge through RAG with a hybrid dense + BM25 query against the OpenSearch index | Must Have | Grounds recommendations in enterprise knowledge |
| **FR-011** | Return a citation payload with every knowledge-grounded conclusion: document ID, title, section, relevance score, and extracted passage | Must Have | NFR-002 explainability |
| **FR-012** | When evidence for a substitution claim is absent or dated beyond the configured recency threshold, return `evidenceStatus: INSUFFICIENT` and do not recommend the substitute | Must Have | SDD-10, NFR-005 |

### 6.4 Mitigation and Scoring

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-013** | Generate at least three mitigation classes where seeded data permits: (a) wait / expedite original shipment, (b) inventory transfer from alternative location, (c) alternate approved supplier, (d) approved engineering substitute | Must Have | Gives operators real choices |
| **FR-014** | Score each mitigation option using deterministic inputs across four dimensions: schedule risk, technical risk, supply risk, cost risk | Must Have | Removes LLM subjectivity from ranking |
| **FR-015** | Rank options in ascending total-risk order; present the lowest-risk feasible option as the primary recommendation | Must Have | Clear, defensible recommendation output |
| **FR-016** | Include `resilience_context` and `Resilience_posture` section in every recommendation output per spec 13 | Must Have | Resilience invariant RI-05 |

### 6.5 Agent Orchestration

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-017** | `tsci_primary_agent` acts as the entry point for all user queries; routes to specialist collaborators based on intent | Must Have | Single entry point; clean routing |
| **FR-018** | `risk_investigation_agent` must call `resilience_monitor_agent` as a mandatory step in every full investigation chain | Must Have | Resilience invariant RI-04 |
| **FR-019** | `resilience_monitor_agent` must be able to answer: "What is the resilience posture of this material across the full supply network?" | Must Have | FR-025 implementation |
| **FR-020** | `engineering_knowledge_agent` must surface the retrieved evidence passages and citation metadata in its response | Must Have | FR-011 implementation |
| **FR-021** | `mitigation_agent` must not surface a constrained supplier as a recommended option | Must Have | RI-01 |

### 6.6 Approval and Action

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-022** | No write tool may execute without an explicit approval token issued by the human operator | Must Have | SDD-08, SC-005 |
| **FR-023** | Deterministic workflow executes only the approved action type; no scope expansion at runtime | Must Have | Safety by design |
| **FR-024** | `supply.action.completed` event emitted on successful action execution; includes action type, outcome, correlation ID, and approving operator | Must Have | Full audit trail |
| **FR-025** | Audit trail records: source event, risk detected, investigation steps, recommendation, approval decision, action taken | Must Have | NFR-001 traceability |

### 6.7 Resilience Event Processing

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-026** | Ingest `supply.supplier.status.changed` events; update live supplier constraint state for each affected material within one event processing cycle | Must Have | Resilience journey step R1 |
| **FR-027** | Ingest `supply.port.status.changed` events; re-evaluate ETA impact for all shipments routed through the affected port | Must Have | Resilience journey step R4; SC-010 |
| **FR-028** | Ingest `supply.approved_vendor.changed` events; reflect AVL changes immediately in the approved supplier set | Must Have | Resilience journey step R5; SC-011 |
| **FR-029** | Maintain a `SupplyChainResilienceProfile` per critical material / work-package combination; recompute on every contributing event | Must Have | RI-02; NFR-011 |
| **FR-030** | Emit `supply.material.readiness.assessed` whenever the resilience posture changes for a critical material | Must Have | RI-08; resilience journey step R3 |
| **FR-031** | Emit `supply.risk.detected` using `risk_rule_v2` when supplier-tier constraints eliminate all timely sourcing options — independent of any shipment delay | Must Have | SC-008 |

### 6.8 Dashboard and UI

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| **FR-032** | Control tower displays all active risks with status, severity, material, work package, schedule exposure, and correlation ID | Must Have | SC-007 |
| **FR-033** | Dashboard shows live resilience posture per critical material: readiness status, constrained supplier count, unconstrained supplier count, available transfer locations | Must Have | SC-009; FR-023 implementation |
| **FR-034** | Risk detail view shows the full investigation chain: event → risk → evidence → options → recommendation → approval → action | Must Have | SC-007 |
| **FR-035** | Correlation ID is visible on every risk card and action record in the UI | Must Have | SC-006; NFR-001 |
| **FR-036** | Approval UI presents recommendation, evidence citations, resilience posture, and risk scores before requesting operator decision | Must Have | Informed consent before action |
| **FR-037** | Support conversational investigation through wxO agent embedded experience | Should Have | FR-016 implementation |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Measurable Target |
|----|----------|-------------|-------------------|
| **NFR-001** | Traceability | Every risk event must carry a `correlationId` traceable from source event through action | 100% of risk events have `correlationId`; verifiable in audit log |
| **NFR-002** | Explainability | Recommendation must include structured facts, evidence citations, score breakdown, and active constraints | Automated test: recommendation object contains all required fields |
| **NFR-003** | Reliability | Event processing is idempotent: duplicate events produce no state change beyond the first | Duplicate-event integration test passes |
| **NFR-004** | Security | Read and write credentials are separate; write tools require approval token; no secrets in source code | Security review checklist 100% pass |
| **NFR-005** | Grounding | Engineering substitution claims require retrieved RAG evidence with a recency-valid citation | SC-004 passes; `evidenceStatus: INSUFFICIENT` returned for undocumented substitutes |
| **NFR-006** | Safe failure | If RAG evidence is missing or conflicting, agent escalates to human; does not fabricate an answer | SDD-10 integration test passes |
| **NFR-007** | Observability | All backend services emit JSON-structured logs; risk event logs include `correlationId`, `riskId`, `materialCode`, `workPackageId` | Log format validated in contract test |
| **NFR-008** | Testability | All external dependencies (Kafka, OpenSearch, wxO) are simulatable via injectable adapters | Test suite runs without live external services |
| **NFR-009** | Portability | All environment-specific values are externalized to `.env` files; no hardcoded hosts, ports, or credentials | Application starts from `.env.example` values |
| **NFR-010** | Demo isolation | All transaction data is synthetic; no real operator data used; seed data explicitly labelled `DEMO` | Code review confirms no real data in seed files |
| **NFR-011** | Resilience latency | `SupplyChainResilienceProfile` updated within the event processing pipeline; staleness flagged if profile age exceeds configured threshold at recommendation time | `RESILIENCE_PROFILE_STALE` warning surfaced in staleness integration test |
| **NFR-012** | AVL correctness | Supplier feasibility never evaluated against a stale AVL; last AVL event timestamp recorded in the profile | Profile object contains `avlLastUpdatedAt`; stale-AVL test passes |

---

## 8. Success Criteria

Each criterion has a clear pass/fail definition. All 11 must pass for Phase 5 gate approval.

| ID | Criterion | Pass Definition | Fail Definition |
|----|-----------|-----------------|-----------------|
| **SC-001** | Delayed shipment produces a detected risk | `supply.risk.detected` event emitted within the demo flow for SHP-90017 | Event not emitted, or emitted with missing required fields |
| **SC-002** | Agent explains impacted work package and required date | Agent response includes `workPackageId: TW-2047` and `requiredDate: 2026-10-07` in structured output | Either field absent or incorrect |
| **SC-003** | Agent identifies at least one alternative when seeded data permits | Mitigation options list contains ≥ 1 feasible option (stock transfer or tertiary supplier) | Options list is empty or contains only rejected options |
| **SC-004** | Engineering substitute not recommended without evidence | When substitute evidence is `INSUFFICIENT`, substitute option is absent from recommendation or explicitly marked NOT_RECOMMENDED | Substitute appears as a ranked recommendation despite insufficient evidence |
| **SC-005** | Write action cannot execute before approval | Calling a write tool without an approval token returns 403; action is not executed | Write executes without a valid approval token |
| **SC-006** | End-to-end correlation ID is visible | Same `correlationId` present in: source event, risk record, agent tool responses, audit log entry, and UI risk card | `correlationId` absent or different at any link in the chain |
| **SC-007** | UI shows full demo flow | Control tower displays: event received → risk raised → investigation complete → recommendation → approval UI → action taken → risk resolved | Any step missing from the UI flow |
| **SC-008** | Supplier quality hold produces updated resilience profile and risk event | After `supply.supplier.status.changed` (quality hold) ingested: `SupplyChainResilienceProfile.constrainedSupplierCount` incremented; if threshold breached, `supply.risk.detected` emitted | Profile not updated, or risk not emitted when threshold breached |
| **SC-009** | Dashboard shows live constrained/unconstrained supplier count | Resilience posture dashboard reflects updated counts within one event processing cycle | Counts stale or absent from dashboard |
| **SC-010** | Port congestion event triggers ETA re-evaluation | After `supply.port.status.changed` ingested: all shipments routed through affected port have their ETAs re-evaluated; affected shipments re-assessed for risk | ETA re-evaluation not triggered |
| **SC-011** | New APPROVED AVL entry immediately available in mitigation options | After `supply.approved_vendor.changed` (new APPROVED status) ingested: new supplier appears in feasible options set for next mitigation query | New supplier absent from options set |

---

## 9. Out of Scope — Initial Demo

The following are explicitly excluded from the current scope. Including them without explicit
spec approval is a compliance violation.

- Direct connection to Shell or any operator's production ERP, SAP, or supply-chain systems
- Autonomous procurement commitment without human approval
- Autonomous engineering substitution approval (requires human sign-off in all cases)
- Autonomous maintenance rescheduling or work-package deferral
- Real financial exposure calculations using operator cost data
- OT / SCADA system integration or control
- Real-time integration with live external logistics APIs (simulated adapters only)
- Multi-plant turnaround correlation beyond the Pearl GTL demo scenario
- Mobile or native app delivery (web UI only)
- Authentication and identity management beyond demo-mode API key

---

## 10. Assumptions and Dependencies

### 10.1 Assumptions

| # | Assumption |
|---|-----------|
| A-01 | All transaction data is synthetic. The Pearl GTL context is used as a public industry anchor only. |
| A-02 | The in-memory store is sufficient for the demo. No database persistence is required for Phase 1–5. |
| A-03 | Confluent Cloud is the event platform. Local Kafka (Docker) is an acceptable substitute for development. |
| A-04 | wxO agent configuration is managed through YAML spec files checked into the `wxo/` directory. |
| A-05 | OpenSearch is accessible and the knowledge index is pre-populated from the `backend/seed/knowledge/` directory. |
| A-06 | The demo is presented by a human operator in a controlled environment; no public internet exposure is assumed. |
| A-07 | All 22 tool API endpoints are implemented in the Backend before any wxO agent is deployed. |

### 10.2 Dependencies

| Dependency | Type | Required By Phase |
|------------|------|------------------|
| Confluent Cloud account with Schema Registry | External SaaS | Phase 1 |
| IBM watsonx Orchestrate instance | External SaaS | Phase 3 |
| OpenSearch 2.x instance | Infrastructure | Phase 3 |
| Python 3.12 runtime | Local | Phase 1 |
| Node.js 20 LTS | Local | Phase 5 |
| `specs/02_DOMAIN_MODEL.yaml` approved | Internal | Phase 1 |
| `specs/03_EVENT_CONTRACTS.yaml` approved | Internal | Phase 2 |
| `specs/04_API_AND_TOOL_CONTRACTS.yaml` approved | Internal | Phase 2 |
| `specs/06_WXO_AGENT_AND_WORKFLOW_SPEC.yaml` approved | Internal | Phase 3 |

---

*Spec version: 2.0 — Full product requirements with all personas, journeys, FR-001–FR-037,
NFR-001–NFR-012, SC-001–SC-011, out of scope, and dependencies.*
