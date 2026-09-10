# Phase Delivery Plan

**Document ID:** TSCI-SPEC-11  
**Version:** 2.0  
**Status:** All phases implemented  
**Related specs:** 01_PRODUCT_REQUIREMENTS, 03_EVENT_CONTRACTS, 04_API_AND_TOOL_CONTRACTS, 10_TEST_AND_EVALUATION_SPEC

---

## 1. Purpose

This document defines the five-phase delivery plan for the Oil & Gas Turnaround Supply Chain Intelligence (TSCI) solution. It describes what was built in each phase, the acceptance gate that must pass before the next phase begins, and the current implementation status. It supersedes the earlier ten-phase outline and consolidates delivery into the five functional layers that match the implemented codebase.

---

## 2. Phase Overview

| Phase | Goal | Key Deliverables | Estimated Duration |
|---|---|---|---|
| **P1** | Event backbone & domain model | Confluent topics, Terraform, event schemas, domain models, seed data | 1–2 weeks |
| **P2** | Backend API & scoring | 10 routers, deterministic scoring, approval service, audit log, in-memory store, unit tests | 2–3 weeks |
| **P3** | RAG & agent tools | OpenSearch index, RAG service, 22 wxO tools, agent YAML definitions, contract tests | 2–3 weeks |
| **P4** | UI & approval workflow | 9 UI pages, Carbon components, wxO chat integration, approval flow, E2E demo path | 2–3 weeks |
| **P5** | Resilience & continuous RAG | Resilience engine, 4 resilience tools, `crag_rag_agent_v1`, 7 `crag.*` Kafka topics, continuous RAG scripts | 2–3 weeks |

**Total estimated duration:** 9–14 weeks for full first implementation.

---

## 3. Phase 1 — Event Backbone & Domain Model

### 3.1 Objective

Establish the Confluent event infrastructure and the typed domain model that all subsequent phases depend on. No business logic is implemented in this phase — only the data structures and connectivity.

### 3.2 Deliverables

**Confluent / Kafka**
- Terraform configuration for Confluent Cloud environment and cluster (see [`confluent/terraform/`](../confluent/terraform/))
- Core topics created: `supply.shipment.updated`, `supply.inventory.changed`, `turnaround.material.required`, `supply.risk.detected`
- Schema Registry schemas registered for all four core topics with `BACKWARD_TRANSITIVE` compatibility
- Topic-level ACLs configured per security spec

**Domain Models** (see [`backend/app/domain/models.py`](../backend/app/domain/models.py))
- `Material` — materialId, description, mandatory flag, approved substitute flag
- `WorkPackage` — workPackageId, turnaroundId, assetId, plannedStart
- `MaterialRequirement` — requirementId, workPackageId, materialId, quantityRequired, requiredBy, mandatory
- `Shipment` — shipmentId, poId, poLineId, materialId, status, currentEta, destinationLocationId, portOfDeparture
- `InventoryPosition` — locationId, materialId, onHand, reserved, available
- `SupplyRisk` — riskId, riskType, severity, facts dict, correlationId
- `MitigationOption` — optionId, riskId, type, feasible, scores, approvalRequirements
- `ApprovalRequest` — approvalRequestId, optionId, optionHash, status, expiry
- `SupplierConstraint` — supplierId, materialId, constraintType, constraintSeverity, affectedFromDate
- `PortStatus` — portCode, disruptionType, severity, affectedFromDate
- `ApprovedVendorEntry` — supplierId, materialId, avlStatus, effectiveDate
- `SupplyChainResilienceProfile` — composite profile with all 6 required fields

**Seed Data** (see [`backend/app/store/in_memory_store.py`](../backend/app/store/in_memory_store.py))
- All demo entities from spec-12 seeded at startup
- `store.reset_to_seed()` restores full demo state deterministically

**Event producer simulator** for core supply topics (`confluent/python/`)

### 3.3 Acceptance Gate

- [ ] Terraform apply completes without error in a clean environment
- [ ] All four Confluent topics exist with correct Schema Registry schemas
- [ ] Domain model invariants tested: available = onHand - reserved
- [ ] Demo scenario entities queryable via `store.get_*` calls
- [ ] Resilience profile computable from seed data: `resilienceScore > 60`, `readinessStatus = CRITICAL`

---

## 4. Phase 2 — Backend API & Scoring

### 4.1 Objective

Build all API routers, the deterministic scoring engine, the approval service, and the in-memory store. All unit tests pass before this phase closes.

### 4.2 Deliverables

**API Routers** (see [`backend/app/routers/`](../backend/app/routers/))

| Router | Prefix | Key Endpoints |
|---|---|---|
| `health` | `/health` | GET — liveness check |
| `demo` | `/api/demo` | POST simulate-delay, POST reset |
| `risks` | `/api/risks` | GET list, GET `{id}`, GET `{id}/options` |
| `shipments` | `/api/shipments` | GET `{id}` |
| `inventory` | `/api/inventory` | GET options |
| `work_packages` | `/api/work-packages` | GET `{id}` |
| `suppliers` | `/api/suppliers` | GET options |
| `actions` | `/api/actions` | POST inventory-transfer, POST expedite |
| `approvals` | `/api/approvals` | POST request, POST `{id}/approve` |
| `rag` | `/api/rag` | POST query |

**Scoring engine** (see [`backend/app/domain/scoring.py`](../backend/app/domain/scoring.py))
- `ScoringWeights(scheduleRisk=0.45, technicalRisk=0.25, supplyRisk=0.20, incrementalCost=0.10)`
- `calculate_score(input: ScoringInput) -> float`
- `apply_hard_constraints(input: ScoringInput) -> ScoringInput`
- `compute_risk_severity(mandatory, shortage_qty, hours_until_required) -> str`
- `rank_options(options: list[MitigationOption]) -> list[MitigationOption]`
- `are_near_equivalent(a, b) -> bool` — threshold = 5.0 points

**Approval service** (see [`backend/app/services/approval_service.py`](../backend/app/services/approval_service.py))
- `validate_for_execution(approvalRequestId, optionId)` — checks status, expiry, hash match
- `_option_hash(option)` — deterministic hash of option fields used for tamper detection
- All write endpoints require a valid, non-expired, hash-matched approval record

**Audit log** — every approved action is recorded with timestamp, approver, option snapshot

**In-memory store** (see [`backend/app/store/in_memory_store.py`](../backend/app/store/in_memory_store.py))
- Thread-safe upsert methods for all domain entity types
- `reset_to_seed()` — full demo state restoration

### 4.3 Acceptance Gate

- [ ] All 14 unit tests in `test_scoring.py` pass
- [ ] All 7 tests in `test_risk_detector.py` pass
- [ ] All 6 tests in `test_approval.py` pass
- [ ] `test_inventory.py` and `test_idempotency.py` pass
- [ ] GET `/health` returns HTTP 200
- [ ] POST `/api/demo/simulate-delay` with SHP-90017/MR-7781 returns `risk_detected=True`
- [ ] POST `/api/actions/inventory-transfer` without approval returns HTTP 403 `APPROVAL_REQUIRED`

---

## 5. Phase 3 — RAG & Agent Tools

### 5.1 Objective

Build the OpenSearch knowledge foundation, the RAG retrieval service, and all 22 wxO tools. Define all agent YAML specifications. Contract tests must pass.

### 5.2 Deliverables

**OpenSearch RAG** (see [`backend/app/services/rag_service.py`](../backend/app/services/rag_service.py) and [`specs/05_OPENSEARCH_RAG_SPEC.md`](./05_OPENSEARCH_RAG_SPEC.md))
- Index mappings with dense vector field for embeddings
- Hybrid retrieval: BM25 + embedding similarity
- Entity extraction from query (materialId, supplierId, workPackageId)
- Metadata filters: materialId, documentType, supplierId
- Evidence response contract: `documentId`, `title`, `excerpt`, `relevanceScore`, `documentType`
- No-answer behaviour: returns empty evidence list rather than fabricating
- Conflict behaviour: returns both conflicting documents, does not resolve autonomously

**Synthetic knowledge documents** (used as RAG corpus for demo)
- Material specifications and certification requirements for CVA-8842
- Engineering compatibility assessments
- Supplier qualification records
- Turnaround planning guides and substitution procedures

**wxO Tools — Read (18 tools)** from [`wxo/tsci_tools.yaml`](../wxo/tsci_tools.yaml)

| Category | Tools |
|---|---|
| Work package / requirements | `get_work_package_details`, `get_material_requirements` |
| Risk | `get_risk_details`, `list_open_risks` |
| Inventory | `get_inventory_positions`, `get_supplier_options` |
| Shipment | `get_shipment_status` |
| Mitigation | `get_mitigation_options`, `get_recommendation` |
| RAG | `search_engineering_knowledge`, `get_engineering_evidence` |
| Resilience | `get_resilience_profile`, `get_avl_status`, `get_port_status`, `get_supplier_resilience_status` |
| Approval | `get_approval_status`, `request_approval` |

**wxO Tools — Write (4 tools)**

| Tool | Approval Required | Action |
|---|---|---|
| `execute_inventory_transfer` | Yes | Moves inventory, updates risk status |
| `execute_supplier_expedite` | Yes | Records expedite request; blocked if supplier constrained |
| `execute_alternate_supplier_order` | Yes | Records order with alternate supplier |
| `update_risk_status` | Yes | Marks risk MITIGATED or ESCALATED |

**Agent YAML definitions** (see [`wxo/`](../wxo/))
- `tsci_primary_agent.yaml` — routing agent, delegates to collaborators
- `tsci_tools.yaml` — all 22 tool definitions with input/output schemas

### 5.3 Acceptance Gate

- [ ] RAG returns correct documents for all 30 evaluation questions in §8 of spec-10
- [ ] Retrieval hit rate @ 5 ≥ 0.90 on synthetic gold set
- [ ] All tool contract tests pass (100% of defined contracts)
- [ ] `search_engineering_knowledge` returns empty evidence list (not fabricated text) for unknown queries
- [ ] `get_avl_status` correctly marks SUP-101 and SUP-203 as constrained

---

## 6. Phase 4 — UI & Approval Workflow

### 6.1 Objective

Build the Control Tower React UI with all nine pages, integrate wxO chat, and implement the full approval workflow end-to-end. The complete demo scenario must be walkable from a browser.

### 6.2 Deliverables

**UI Pages** (see [`ui/src/pages/`](../ui/src/pages/) and [`specs/07_APPLICATION_AND_UI_SPEC.md`](./07_APPLICATION_AND_UI_SPEC.md))

| Page | Route | Purpose |
|---|---|---|
| Dashboard | `/` | Critical materials grid, resilience posture strip, port disruption banner |
| Risk Detail | `/risks/:id` | Full risk detail, resilience posture panel, mitigation table |
| Timeline | `/timeline` | Gantt-style turnaround timeline |
| Inventory | `/inventory` | Inventory positions by location and material |
| Suppliers | `/suppliers` | Supplier network with constraint status |
| Mitigation Comparison | `/risks/:id/mitigate` | Side-by-side option comparison with scores |
| Evidence Viewer | `/evidence/:docId` | RAG document display |
| Approval | `/approvals/:id` | Approval request detail and approve/reject action |
| Agent Panel | Embedded on Risk Detail | wxO chat integration |

**Carbon Design System** components throughout — consistent with IBM engineering standards.

**wxO Chat Integration**
- Chat panel embedded on the Risk Detail page
- Suggested prompts for resilience, supplier, and mitigation queries
- Approval action triggers from agent response

**Approval UI**
- Approval request creation from the Mitigation Comparison page
- Approval detail page showing option snapshot, hash, expiry
- Approve / Reject buttons that call the backend approval endpoint

### 6.3 Acceptance Gate

- [ ] Full demo scenario walkable: browser → risk visible → agent queried → options compared → approval submitted → transfer executed → risk status MITIGATED
- [ ] SUBSTITUTE option shown as infeasible with `NO_ENGINEERING_EVIDENCE` reason
- [ ] EXPEDITE for SUP-101 shown as infeasible with `QUALITY_HOLD/CRITICAL` reason
- [ ] Resilience posture panel visible on Risk Detail showing: `primarySupplierStatus=QUALITY_HOLD/CRITICAL`, `unconstrainedApprovedCount=1`, `resilienceScore≈75`
- [ ] Approval enforcement: clicking "Execute" before approval returns visible error

---

## 7. Phase 5 — Resilience & Continuous RAG

### 7.1 Objective

Build the supply chain resilience layer (event streams, resilience engine, 4 resilience tools) and the `crag_rag_agent_v1` continuous RAG agent with its 7 `crag.*` Kafka topics. All resilience tests must pass.

### 7.2 Deliverables

**Resilience Event Topics** (4 Confluent topics)

| Topic | Purpose |
|---|---|
| `supply.supplier.status.changed` | Supplier constraint events (QUALITY_HOLD, CLEARED, etc.) |
| `supply.port.status.changed` | Port disruption events (CONGESTION, CLEARED) |
| `supply.approved_vendor.changed` | AVL additions, suspensions, revocations |
| `supply.material.readiness.assessed` | Computed resilience posture changes |

**Resilience Correlation Engine** (see [`backend/app/services/resilience_engine.py`](../backend/app/services/resilience_engine.py))
- `compute_resilience_profile(store, work_package_id, material_id) -> SupplyChainResilienceProfile`
- Triggered on every contributing event
- Emits `supply.material.readiness.assessed` when readinessStatus or resilienceScore changes
- `risk_rule_v2`: fires `supply.risk.detected` when all sourcing tiers are constrained and inventory = 0

**Resilience API Router** (see [`backend/app/routers/resilience.py`](../backend/app/routers/resilience.py))
- GET `/api/resilience/profile` — full profile with `profileAgeSecs` and `stale` flag
- GET `/api/resilience/avl` — AVL entries with constrained/unconstrained counts
- GET `/api/resilience/port-status` — port disruption status
- GET `/api/resilience/supplier-status` — live supplier constraint state
- POST `/api/resilience/recompute` — force profile recomputation (admin use)
- GET `/api/resilience/history` — profile change history

**Continuous RAG Topics** (7 `crag.*` Kafka topics)

| Topic | Purpose |
|---|---|
| `crag.document.indexed` | RAG corpus updates |
| `crag.query.received` | Agent query log |
| `crag.response.generated` | Agent response log |
| `crag.evidence.cited` | Evidence citation tracking |
| `crag.feedback.received` | Answer quality feedback |
| `crag.corpus.refresh` | Corpus refresh trigger |
| `crag.agent.health` | Agent health heartbeat |

**`crag_rag_agent_v1`** (see [`wxo/crag_rag_agent_v1.yaml`](../wxo/crag_rag_agent_v1.yaml))
- Confluent MCP toolkit integration via Real-Time Confluent Events (RTCE)
- Reads live events from `supply.*` topics to provide real-time context to RAG answers
- 9 demo events seeded for demo playback (see spec-12 §resilience seed events)

**Resilience Test Suite** — `test_resilience.py` (255 lines, 22 tests) all passing

**Setup scripts** (see [`continuous_rag/scripts/`](../continuous_rag/scripts/))
- `setup.sh` — creates `crag.*` topics, registers schemas, seeds demo events
- `seed_crag_events.py` — seeds the 9 continuous RAG demo events

### 7.3 Acceptance Gate

- [ ] All 22 tests in `test_resilience.py` pass
- [ ] `compute_resilience_profile` returns `resilienceScore > 60` and `readinessStatus = CRITICAL` for TW-2047/CVA-8842 from seed data
- [ ] GET `/api/resilience/avl?material_id=CVA-8842` returns `unconstrained_approved_count = 1`
- [ ] EXPEDITE blocked at execution time if supplier constraint is still ACTIVE (`SUPPLIER_CONSTRAINED` error returned)
- [ ] `crag_rag_agent_v1` responds to resilience posture questions using live Confluent topic data
- [ ] All 7 `crag.*` topics created and schemas registered
- [ ] `store.reset_to_seed()` restores all resilience seed data

---

## 8. Current Implementation Status

All five phases are implemented. Test summary:

| Test File | Tests | Status |
|---|---|---|
| `test_scoring.py` | 14 | ✅ All passing |
| `test_risk_detector.py` | 7 (approx 7 methods) | ✅ All passing |
| `test_approval.py` | 6 | ✅ All passing |
| `test_inventory.py` | ~5 | ✅ All passing |
| `test_idempotency.py` | ~3 | ✅ All passing |
| `test_resilience.py` | 22 | ✅ All passing |
| `test_api.py` | ~20 | ✅ All passing |

Total: **~77 tests passing** across all phases.

---

## 9. Deployment Order for Production Path

When deploying to a new environment, follow this order:

```
1. Confluent Cloud — terraform apply (topics + schemas + ACLs)
2. Backend service — deploy with env vars; confirm /health
3. Run seed script — python scripts/seed_demo.py
4. OpenSearch — create index, ingest synthetic documents
5. wxO platform — import tools, agents, toolkits
6. UI — build and deploy (VITE_API_BASE_URL pointing to backend)
7. Continuous RAG — run continuous_rag/scripts/setup.sh
8. Verify demo flow — POST /api/demo/simulate-delay → agent query → approval → action
```

Never deploy Phase 3+ before Phase 1 and 2 are verified — agent tools depend on the API being stable and the schema contracts registered.
