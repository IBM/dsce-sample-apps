# Test and Evaluation Specification

**Document ID:** TSCI-SPEC-10  
**Version:** 2.0  
**Status:** Implemented — all tests passing  
**Related specs:** 09_SCORING_AND_DECISION_SPEC, 13_SUPPLY_CHAIN_RESILIENCE_SPEC, 04_API_AND_TOOL_CONTRACTS

---

## 1. Purpose

This specification defines the full testing strategy for the TSCI solution: what is tested, at which level, with which data, and what constitutes a pass. It is the authoritative source for test inventory, coverage targets, agent evaluation criteria, and CI execution order.

---

## 2. Testing Philosophy

1. **Determinism first.** Every scoring, feasibility, and resilience computation must be provable by a unit test with exact expected values.
2. **No mocks for domain logic.** Hard constraint evaluation and scoring are tested against the real implementation — not stubbed.
3. **Contract tests are mandatory.** All event schemas and API shapes must have at least one contract test before any integration can be declared stable.
4. **Agent evaluation is qualitative but gated.** Agent outputs are assessed for correctness of tool selection, absence of fabrication, and required response sections. Numeric targets are demo quality gates, not production SLA claims.
5. **Idempotency is a first-class test concern.** Any consumer or write endpoint that can receive duplicate events must have an explicit idempotency test.

---

## 3. Test Pyramid

| Level | Scope | Framework | Target |
|---|---|---|---|
| Unit | Domain logic, scoring, risk detection, approval, resilience engine | pytest | ≥ 80% line coverage |
| Integration | API endpoints, full demo flow, approval enforcement, reset | pytest + FastAPI TestClient | ≥ 70% endpoint coverage |
| Contract | Event schema compatibility, API OpenAPI shape, wxO tool I/O | pytest + jsonschema | 100% of defined contracts |
| End-to-End | Full demo scenario from browser through agent to action | Manual + Playwright (future) | Demo scenario must complete |
| Agent Evaluation | Tool selection, fabrication checks, response section compliance | Prompt + evaluation harness | See §9 |

---

## 4. Unit Test Catalogue

### 4.1 `test_scoring.py` — 139 lines — 14 tests

**Location:** [`backend/tests/test_scoring.py`](../backend/tests/test_scoring.py)

#### `TestRiskSeverity` (4 tests)

| Test | Scenario | Expected |
|---|---|---|
| `test_critical_within_72h` | mandatory=True, shortage=1, hours=48 | `CRITICAL` |
| `test_high_within_168h` | mandatory=True, shortage=1, hours=100 | `HIGH` |
| `test_medium_shortage_not_mandatory` | mandatory=False, shortage=1, hours=48 | `MEDIUM` |
| `test_low_no_shortage` | mandatory=True, shortage=0, hours=48 | `LOW` |

#### `TestScoringWeights` (3 tests)

| Test | Scenario | Expected |
|---|---|---|
| `test_weights_sum_to_one` | Sum all four weights | Exactly 1.0 (tolerance < 1e-9) |
| `test_lower_risk_scores_lower` | TRANSFER (all 10s) vs WAIT (all 90s) | TRANSFER score < WAIT score |
| `test_cost_normalisation_caps_at_100` | incremental_cost=999,999, all risks=0 | totalScore == 10.0 (cost component capped) |

#### `TestHardConstraints` (5 tests)

| Test | Option | Condition | Expected |
|---|---|---|---|
| `test_transfer_infeasible_insufficient_inventory` | TRANSFER | source_available=0.5, required=1.0 | feasible=False, reason contains "insufficient source inventory" |
| `test_transfer_infeasible_jeopardised` | TRANSFER | available=5, required=1, next_req_jeopardised=True | feasible=False |
| `test_alternate_supplier_infeasible_unapproved` | ALTERNATE_SUPPLIER | supplier_approved=False | feasible=False, reason contains "not approved" |
| `test_substitute_infeasible_no_evidence` | SUBSTITUTE | engineering_evidence_present=False | feasible=False, reason contains "NO_ENGINEERING_EVIDENCE" |
| `test_transfer_feasible_adequate_inventory` | TRANSFER | source_available=2.0, required=1.0 | feasible=True |

#### `TestRankOptions` (4 tests)

| Test | Scenario | Expected |
|---|---|---|
| `test_ranks_by_total_score_ascending` | WAIT=80, TRANSFER=20, EXPEDITE=50 | Ranked: TRANSFER, EXPEDITE, WAIT |
| `test_excludes_infeasible` | WAIT=80 (feasible), SUBSTITUTE=10 (infeasible) | Ranked list contains only WAIT |
| `test_near_equivalent_within_5_points` | TRANSFER=20.0, EXPEDITE=24.0 | `are_near_equivalent` returns True |
| `test_not_near_equivalent_beyond_5_points` | TRANSFER=20.0, EXPEDITE=26.0 | `are_near_equivalent` returns False |

---

### 4.2 `test_risk_detector.py` — 102 lines — 7 tests

**Location:** [`backend/tests/test_risk_detector.py`](../backend/tests/test_risk_detector.py)

| Test | Scenario | Expected |
|---|---|---|
| `test_on_time_no_risk` | ETA +2 days, required_by +5 days | No risk (returns None) |
| `test_late_no_inventory_detects_risk` | ETA +10 days, required_by +2 days, available=0 | LATE_DELIVERY / CRITICAL, correlationId preserved |
| `test_late_sufficient_inventory_no_risk` | ETA +10 days, required_by +2 days, available=5 | No risk (inventory covers shortfall) |
| `test_non_mandatory_no_risk` | ETA +10 days, required_by +2 days, mandatory=False, available=0 | No risk |
| `test_risk_contains_facts` | ETA +5 days, required_by +1 day, available=0 | Risk event has `shortage_quantity` and `current_eta` in facts dict |
| `test_severity_high_within_168h` | ETA +10 days, required_by +5 days (120h), available=0 | severity == HIGH |

---

### 4.3 `test_approval.py` — 94 lines — 6 tests

**Location:** [`backend/tests/test_approval.py`](../backend/tests/test_approval.py)

Each test calls `store.reset_to_seed()` in `setup_method` to guarantee isolation.

| Test | Scenario | Expected |
|---|---|---|
| `test_action_without_approval_raises` | `validate_for_execution` with nonexistent approvalId | `AppError` with `code == APPROVAL_REQUIRED` |
| `test_approved_valid_passes` | APPROVED status, future expiry, hash matches | Returns approval record with `status == APPROVED` |
| `test_pending_approval_raises` | PENDING status | `AppError` with `code == APPROVAL_REQUIRED` |
| `test_expired_approval_raises` | APPROVED status, expiry -1h in the past | `AppError` with `code == APPROVAL_REQUIRED`, message contains "expired" |
| `test_option_changed_after_approval_raises` | Approved, then option mutated (incremental_cost changed) | `AppError` with `code == APPROVAL_MISMATCH` |

---

### 4.4 `test_inventory.py` — 39 lines

**Location:** [`backend/tests/test_inventory.py`](../backend/tests/test_inventory.py)

Covers: available inventory calculation (`on_hand - reserved`), zero-inventory edge case, inventory candidate filtering (exclude destination from transfer candidates).

---

### 4.5 `test_idempotency.py` — 27 lines

**Location:** [`backend/tests/test_idempotency.py`](../backend/tests/test_idempotency.py)

Covers: submitting the same `simulate-delay` request twice does not create duplicate risk records. The second call returns the existing risk ID rather than creating a new entry.

---

## 5. Resilience Test Scenarios

### 5.1 `test_resilience.py` — 255 lines

**Location:** [`backend/tests/test_resilience.py`](../backend/tests/test_resilience.py)

All tests use `autouse` fixture `reset_store` which calls `store.reset_to_seed()` before and after every test.

#### `TestSC008_QualityHoldUpdatesProfile` — SC-008

| Test | Expected |
|---|---|
| `test_quality_hold_primary_supplier_is_reflected` | `profile.primary_supplier_status == "QUALITY_HOLD/CRITICAL"` |
| `test_quality_hold_reduces_unconstrained_count` | `profile.unconstrained_approved_supplier_count == 1` (only SUP-205) |
| `test_readiness_status_is_critical` | `profile.readiness_status == "CRITICAL"` and `profile.resilience_score > 60.0` |

#### `TestSC009_AvlEndpoint` — SC-009

| Test | Endpoint | Expected |
|---|---|---|
| `test_avl_returns_entries_for_material` | GET `/api/resilience/avl?material_id=CVA-8842` | HTTP 200, 3+ entries |
| `test_avl_unconstrained_count_is_one` | Same | `unconstrained_approved_count == 1` |
| `test_avl_primary_supplier_marked_constrained` | Same | SUP-101: `constrained=True`, `constraint_type=QUALITY_HOLD`, `constraint_severity=CRITICAL` |
| `test_avl_tertiary_supplier_is_unconstrained` | Same | SUP-205: `constrained=False`, `avl_status=APPROVED` |
| `test_avl_404_for_unknown_material` | GET with `material_id=UNKNOWN-MAT` | HTTP 404, `code=NOT_FOUND` |

#### `TestSC010_PortStatusEndpoint` — SC-010

| Test | Expected |
|---|---|
| `test_sgsin_port_status_returns_congestion` | `disruption_type=CONGESTION`, `severity=HIGH` |
| `test_sgsin_with_material_returns_impacted_shipment_count` | `impacted_shipment_count >= 1` |
| `test_unknown_port_returns_404` | HTTP 404 |

#### `TestSC011_NewAvlEntryAppearsImmediately` — SC-011

| Test | Expected |
|---|---|
| `test_new_avl_entry_visible_in_same_cycle` | After `store.upsert_avl_entry(SUP-999)`, GET AVL returns SUP-999 in entries |

#### `TestSC012_ConstraintExclusion` — SC-012

| Test | Expected |
|---|---|
| `test_constrained_supplier_flagged_in_avl` | SUP-203: `constrained=True`, `constraint_type=PORT_CONGESTION` |
| `test_clearing_constraint_makes_supplier_unconstrained` | After CLEARED event for SUP-101: `constrained=False`, `unconstrained_approved_count == 2` |

#### `TestSupplierResilienceStatusEndpoint`

| Test | Expected |
|---|---|
| `test_active_constraint_for_sup101` | `status=ACTIVE`, `constraint_type=QUALITY_HOLD`, `constraint_severity=CRITICAL` |
| `test_cleared_for_unconstrained_supplier` | SUP-205: `status=CLEARED` |
| `test_404_for_unknown_supplier` | HTTP 404 |

#### `TestResilienceProfileEndpoint`

| Test | Expected |
|---|---|
| `test_profile_endpoint_returns_correct_score` | `readiness_status=CRITICAL`, `resilience_score > 60`, `unconstrained_approved_supplier_count=1`, `primary_supplier_status=QUALITY_HOLD/CRITICAL` |
| `test_profile_age_secs_is_non_negative` | `profile_age_secs >= 0` |
| `test_profile_stale_flag_present` | Response body contains `stale` key |
| `test_profile_dimension_scores_sum_correctly` | `D1×0.30 + D2×0.25 + D3×0.25 + D4×0.20 == resilience_score` (±0.1) |

#### `TestResilienceScoreUnit`

| Test | Scenario | Expected |
|---|---|---|
| `test_all_clear_yields_low_score` | CLEARED all constraints + cleared port disruption | `unconstrained_count == 3`, `readiness_status` in {CONFIRMED, AT_RISK} |

---

## 6. API Integration Tests

### 6.1 `test_api.py` — 147 lines

**Location:** [`backend/tests/test_api.py`](../backend/tests/test_api.py)

#### `TestHealth`
- GET `/health` → HTTP 200, `{"status": "ok"}`

#### `TestDemoSimulate`
| Test | Expected |
|---|---|
| `test_simulate_delay_detects_risk` | POST `/api/demo/simulate-delay` with SHP-90017/MR-7781 → HTTP 200, `risk_detected=True`, `risk_id` present, severity in {CRITICAL, HIGH, MEDIUM} |
| `test_simulate_returns_correlation_id` | With header `x-correlation-id: TEST-CID-123` → response header echoes same value |

#### `TestRisksAPI`
| Test | Expected |
|---|---|
| `test_get_nonexistent_risk_404` | GET `/api/risks/RSK-NOTEXIST` → HTTP 404, `code=NOT_FOUND` |
| `test_list_risks_empty_initially` | GET `/api/risks` after reset → `total == 0` |
| `test_risk_appears_after_simulate` | After simulate-delay → `total == 1` |

#### `TestShipmentsAPI`
| Test | Expected |
|---|---|
| `test_get_shipment` | GET `/api/shipments/SHP-90017` → HTTP 200, `status=DELAYED` |
| `test_shipment_not_found` | GET `/api/shipments/SHP-NOPE` → HTTP 404 |

#### `TestWorkPackageAPI`
- GET `/api/work-packages/TW-2047` → HTTP 200, `work_package_id=TW-2047`, `requirements` array contains `requirement_id=MR-7781`

#### `TestInventoryAPI`
- GET `/api/inventory/options` with `material_id=CVA-8842`, `destination=PEARL-DEMO`, `quantity=1`, `required_by=2026-10-10T00:00:00Z` → candidates include REGIONAL-WH-DEMO

#### `TestMitigationOptions`
- After simulate-delay, GET `/api/risks/{risk_id}/options` → `ranked_options` non-empty; if SUBSTITUTE present, it must have `feasible=False`

#### `TestApprovalEnforcement`
- POST `/api/actions/inventory-transfer` without valid approval → HTTP 403, `code=APPROVAL_REQUIRED`

#### `TestDemoReset`
- After simulate-delay, POST `/api/demo/reset`, GET `/api/risks` → `total == 0`

---

## 7. Contract Test Suite

### 7.1 Event Schema Contracts

| Contract | Schema | Test |
|---|---|---|
| `supply.shipment.updated` | Schema Registry (BACKWARD_TRANSITIVE) | Event payload validates against registered schema |
| `supply.inventory.changed` | Schema Registry | Valid against schema |
| `turnaround.material.required` | Schema Registry | Valid against schema |
| `supply.risk.detected` | Schema Registry | Valid against schema; `riskType` and `severity` required fields present |
| `supply.supplier.status.changed` | Schema Registry | `supplierId`, `materialId`, `constraintType`, `constraintSeverity` required |
| `supply.port.status.changed` | Schema Registry | `portCode`, `disruptionType`, `severity` required |
| `supply.approved_vendor.changed` | Schema Registry | `supplierId`, `materialId`, `avlStatus` required |
| `supply.material.readiness.assessed` | Schema Registry | `workPackageId`, `materialId`, `readinessStatus`, `resilienceScore` required |

### 7.2 API OpenAPI Contracts

Every route documented in the OpenAPI spec must:
- Return the documented HTTP status codes.
- Validate request bodies against the documented schema (422 for invalid input).
- Return response bodies matching the documented shape.

### 7.3 wxO Tool Contracts

| Tool | Input Contract | Output Contract |
|---|---|---|
| `get_resilience_profile` | `work_package_id`, `material_id` required | Returns `profile` with all 6 required fields |
| `get_avl_status` | `material_id` required | Returns `entries` array, `unconstrained_approved_count` integer |
| `get_port_status` | `port_code` required | Returns `disruption_type`, `severity` |
| `get_supplier_resilience_status` | `supplier_id`, `material_id` required | Returns `status`, `constraint_type`, `constraint_severity` |

---

## 8. Agent Evaluation Scenarios

### 8.1 Required Checks (All Agents)

| Check | Pass Condition |
|---|---|
| `tool_selection_accuracy` | Agent calls the correct tool for each query type |
| `no_fabricated_inventory` | All inventory quantities sourced from `get_inventory_positions` or `get_supplier_options` |
| `no_fabricated_supplier` | All supplier names and IDs sourced from `get_avl_status` or `get_supplier_options` |
| `engineering_claim_has_evidence` | Any compatibility claim includes a RAG evidence document ID |
| `recommendation_contains_tradeoffs` | Response includes at least two options with scores |
| `write_requires_approval` | Any action recommendation includes an explicit approval requirement |
| `constrained_supplier_not_presented_as_feasible` | Suppliers with active HIGH/CRITICAL constraints are shown as infeasible with reason |
| `resilience_posture_section_present_in_recommendation` | `Resilience_posture` section present in every recommendation response |
| `resilience_monitor_agent_routes_on_network_query` | "What is the supply network posture for CVA-8842?" routes to ResilienceMonitorAgent |
| `port_disruption_context_included_when_relevant` | When port disruption affects a shipment, the disruption is mentioned in the recommendation |
| `avl_check_performed_before_recommendation` | `get_avl_status` is called before any ALTERNATE_SUPPLIER or EXPEDITE option is presented |

### 8.2 RAG Evaluation — 30 Minimum Questions

**Category: Material lookup (6 questions)**
- What is CVA-8842? / What is a control-valve actuator?
- What is the minimum approved supplier count for this material class?
- Is there an approved substitute for CVA-8842?
- What are the engineering approval requirements for substitution?
- What certifications are required for this material?
- Has CVA-8842 been substituted before in any turnaround?

**Category: Supplier status (6 questions)**
- Who are the approved suppliers for CVA-8842?
- Why is SUP-101 constrained?
- What is the expected resolution date for the SUP-101 quality hold?
- Can SUP-203 deliver in time?
- Why can't we expedite from SUP-203?
- Is SUP-205 approved?

**Category: Shipment and logistics (5 questions)**
- What is the current status of SHP-90017?
- Why is SHP-90017 delayed?
- What is the port congestion status at SGSIN?
- How many days late is the primary shipment?
- When will SHP-90017 arrive if not mitigated?

**Category: Inventory and transfer (5 questions)**
- What inventory of CVA-8842 is available at PEARL-DEMO?
- Is there a nearby warehouse with spare stock?
- Can we transfer from REGIONAL-WH-DEMO?
- Will transferring from REGIONAL-WH-DEMO put any future requirement at risk?
- What is the available quantity at REGIONAL-WH-DEMO?

**Category: Resilience posture (4 questions)**
- What is the resilience posture of CVA-8842?
- How many unconstrained approved suppliers remain?
- What is the resilienceScore for this material?
- Has the AVL changed since this risk was opened?

**Category: Mitigation and approval (4 questions)**
- What are the mitigation options?
- Which option is recommended and why?
- Who needs to approve a transfer from REGIONAL-WH-DEMO?
- What engineering approvals are needed for a substitute?

**RAG quality targets:**

| Metric | Target |
|---|---|
| Retrieval hit rate @ 5 results | ≥ 0.90 on synthetic gold set |
| Evidence correctness | ≥ 0.90 |
| No-answer precision (questions with no evidence) | ≥ 0.95 |

---

## 9. Test Data Requirements

All tests use **synthetic demonstration data only**. No real operational data from any facility.

| Entity | Seeded ID | Key State |
|---|---|---|
| Material | CVA-8842 | CRITICAL, mandatory, has approved substitute |
| Work Package | TW-2047 | plannedStart 2026-10-11, TA-DEMO-2026 |
| Requirement | MR-7781 | quantity=1, requiredBy=2026-10-10, mandatory=True |
| Shipment | SHP-90017 | DELAYED, ETA 2026-10-14, departure SGSIN |
| Inventory (dest) | PEARL-DEMO | available=0 |
| Inventory (transfer) | REGIONAL-WH-DEMO | available=1 (after reservation), nextReq=2026-11-25 |
| Supplier (primary) | SUP-101 | QUALITY_HOLD/CRITICAL active |
| Supplier (secondary) | SUP-203 | PORT_CONGESTION/HIGH active |
| Supplier (tertiary) | SUP-205 | APPROVED, unconstrained, can deliver 2026-10-09 |
| Port | SGSIN | CONGESTION/HIGH |
| Correlation ID | DEMO-TW2047-001 | Used throughout demo flow |

`store.reset_to_seed()` must restore all of the above to their defined state.

---

## 10. CI/CD Test Execution Order

```
1. lint (ruff)
2. typecheck (mypy, if configured)
3. pytest backend/tests/test_scoring.py        # unit — scoring
4. pytest backend/tests/test_risk_detector.py  # unit — risk detection
5. pytest backend/tests/test_approval.py       # unit — approval enforcement
6. pytest backend/tests/test_inventory.py      # unit — inventory
7. pytest backend/tests/test_idempotency.py    # unit — idempotency
8. pytest backend/tests/test_resilience.py     # integration — resilience layer
9. pytest backend/tests/test_api.py            # integration — full API
10. contract schema validation                  # contract — event schemas
11. openapi response shape validation           # contract — API
```

Steps 1–7 must all pass before steps 8–11 run. Any failure stops the pipeline.

---

## 11. Coverage Targets

| Level | Target |
|---|---|
| Unit tests (domain logic) | ≥ 80% line coverage |
| Integration tests (API endpoints) | ≥ 70% route coverage |
| Contract tests | 100% of all defined event and tool contracts |
| Agent evaluation | 100% of §9.1 checks must pass on demo scenario |

---

## 12. Test Environment Setup

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=app --cov-report=term-missing

# Run only resilience tests
pytest tests/test_resilience.py -v

# Run only scoring unit tests
pytest tests/test_scoring.py -v

# Seed demo data (for manual/API testing)
python scripts/seed_demo.py
```

The test environment requires no external services. All state is held in `in_memory_store` which is reset via `store.reset_to_seed()` between tests.
