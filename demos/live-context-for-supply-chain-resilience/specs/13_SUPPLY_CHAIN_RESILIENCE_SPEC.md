# Supply Chain Resilience Specification

**Document ID:** TSCI-SPEC-13  
**Version:** 2.0  
**Status:** Implemented  
**Related specs:** 02_DOMAIN_MODEL, 03_EVENT_CONTRACTS, 09_SCORING_AND_DECISION_SPEC, 10_TEST_AND_EVALUATION_SPEC, 12_DEMO_DATA_AND_SCENARIO

---

## 1. Purpose

This specification defines the **Supply Chain Resilience** capability layer of the TSCI solution. Where the core risk layer (spec-03, spec-09) reacts to a shipment delay event, the resilience layer maintains a continuous, real-time readiness posture for every critical material across the full multi-tier supplier network — before, during, and after a disruption.

The resilience layer introduces four new Confluent event streams, a stateful correlation engine, four API endpoints, four wxO tools, and the `ResilienceMonitorAgent` collaborator. It feeds directly into the mitigation scoring model to ensure that feasibility constraints and option rankings reflect the live state of the supply network.

---

## 2. Design Principles

1. **Proactive, not reactive.** Resilience risk must be detectable the moment supplier constraints or port disruptions are known — not only when a shipment delay arrives.
2. **Multi-tier visibility.** PRIMARY, SECONDARY, TERTIARY, and SPOT tier suppliers are tracked independently. A constraint at one tier must not mask exposure at another.
3. **Governed sourcing options.** Only suppliers with `APPROVED` AVL status and no active `HIGH` or `CRITICAL` constraint may be presented as feasible mitigation candidates.
4. **Immutable events, mutable state.** Confluent events are the source of truth. `SupplierConstraint`, `PortStatus`, `ApprovedVendorEntry`, and `SupplyChainResilienceProfile` are derived state, recomputed from events on every contributing update.
5. **Explainable posture.** Every resilience score must be traceable to its four dimension values and the event IDs that caused them.
6. **Safe failure.** If the resilience profile is stale at recommendation or action time, the staleness must be surfaced and the user warned before any action proceeds.

---

## 3. Resilience Profile Structure

`SupplyChainResilienceProfile` is the primary output of the resilience correlation engine. It is stored in the in-memory store and exposed via the resilience API.

| Field | Type | Description |
|---|---|---|
| `work_package_id` | `str` | Work package this profile belongs to |
| `material_id` | `str` | Material this profile covers |
| `readiness_status` | `str` | CONFIRMED / AT_RISK / CRITICAL (derived from resilienceScore) |
| `resilience_score` | `float` | Composite score 0–100 (lower = better) |
| `supplier_coverage_score` | `float` | D1 dimension score before weighting (0–100) |
| `inventory_buffer_score` | `float` | D2 dimension score before weighting (0–100) |
| `shipment_exposure_score` | `float` | D3 dimension score before weighting (0–100) |
| `port_disruption_score` | `float` | D4 dimension score before weighting (0–100) |
| `unconstrained_approved_supplier_count` | `int` | Approved suppliers with no active HIGH/CRITICAL constraint |
| `primary_supplier_status` | `str` | `constraintType/constraintSeverity` or `CLEAR` for primary tier supplier |
| `secondary_supplier_status` | `str` | Same for secondary tier supplier |
| `available_at_destination` | `float` | Available inventory at the destination location |
| `shortfall` | `float` | Max(0, requiredQuantity - availableAtDestination) |
| `feasible_transfer_location_count` | `int` | Locations with safe excess stock |
| `feasible_alternate_supplier_count` | `int` | Unconstrained APPROVED suppliers not including primary |
| `computed_at` | `datetime` | UTC timestamp of last computation |
| `source_event_ids` | `list[str]` | IDs of events that triggered this computation |

---

## 4. Event Triggers for Profile Recomputation

The `SupplyChainResilienceProfile` for a `(workPackageId, materialId)` pair must be recomputed when any of the following changes:

| Trigger | Condition | Affected Dimension(s) |
|---|---|---|
| `SupplierConstraint` created / updated / cleared | For any supplier linked to the material via AVL | D1 (supplier coverage) |
| `PortStatus` changed | For any port used in a routing for a shipment carrying the material | D4 (port disruption), potentially D3 |
| `ApprovedVendorEntry` changed | For any supplier linked to the material | D1 (supplier coverage) |
| `InventoryPosition` changed | For the material at any location | D2 (inventory buffer) |
| `Shipment` ETA changed | For the primary shipment carrying the material | D3 (shipment exposure) |

After recomputation, `supply.material.readiness.assessed` is emitted if `readinessStatus` or `resilienceScore` changes by more than the configured threshold.

---

## 5. Resilience Scoring Model

### 5.1 Composite Formula

```
resilienceScore =
  (supplier_coverage_score × 0.30) +
  (inventory_buffer_score  × 0.25) +
  (shipment_exposure_score × 0.25) +
  (port_disruption_score   × 0.20)
```

All four weights must sum to exactly 1.0. This invariant is verified by `test_scoring.py::TestScoringWeights::test_weights_sum_to_one`.

### 5.2 D1 — Supplier Coverage (weight 0.30)

Counts approved suppliers with no active `HIGH` or `CRITICAL` constraint across all tiers.

| Unconstrained Approved Count | D1 Score |
|---|---|
| ≥ 3 | 0 |
| 2 | 25 |
| 1 | 60 |
| 0 | 100 |

A supplier is **constrained** if it has an active `SupplierConstraint` record with `constraintSeverity` of `HIGH` or `CRITICAL` and `constraintType` other than `CLEARED`.

### 5.3 D2 — Inventory Buffer (weight 0.25)

| State | D2 Score |
|---|---|
| Available at destination ≥ required quantity | 0 |
| Transfer from another location covers shortfall | 30 |
| Partial coverage only | 70 |
| Zero coverage at any location | 100 |

### 5.4 D3 — Shipment Exposure (weight 0.25)

Measures days late for the primary shipment relative to the required-by date.

| Days Late | D3 Score |
|---|---|
| 0 or early | 0 |
| 1–3 days | 30 |
| 4–7 days | 60 |
| > 7 days | 100 |

### 5.5 D4 — Port / Logistics Disruption (weight 0.20)

Uses the highest severity active disruption across all ports in the routing chain for shipments linked to this material.

| Active Disruption Severity | D4 Score |
|---|---|
| None | 0 |
| LOW | 20 |
| MEDIUM | 50 |
| HIGH or CRITICAL | 100 |

### 5.6 Readiness Status Thresholds

| Status | Condition |
|---|---|
| **CONFIRMED** | `resilienceScore ≤ 25` |
| **AT_RISK** | `resilienceScore` 26–60 |
| **CRITICAL** | `resilienceScore > 60` |

**Verified by:** `test_resilience.py::TestSC008_QualityHoldUpdatesProfile::test_readiness_status_is_critical` and `test_all_clear_yields_low_score`.

---

## 6. Supplier Constraint Model

### 6.1 `SupplierConstraint` Entity

| Field | Type | Description |
|---|---|---|
| `supplier_id` | `str` | Supplier identifier |
| `material_id` | `str` | Material affected by constraint |
| `constraint_type` | `str` | One of: QUALITY_HOLD, PORT_CONGESTION, CAPACITY_CONSTRAINT, FORCE_MAJEURE, CLEARED |
| `constraint_severity` | `str` | LOW / MEDIUM / HIGH / CRITICAL |
| `affected_from_date` | `datetime` | When the constraint began |
| `estimated_resolution_date` | `datetime` (optional) | Expected clearance date |
| `source_event_id` | `str` | Confluent event ID that created this record |
| `note` | `str` (optional) | Human-readable context |

### 6.2 Constraint Types

| Type | Meaning | Typical Severity | Mitigation Impact |
|---|---|---|---|
| `QUALITY_HOLD` | Supplier batch non-conformance | CRITICAL | Blocks EXPEDITE; excludes from ALTERNATE_SUPPLIER if HIGH/CRITICAL |
| `PORT_CONGESTION` | Routing port disrupted | HIGH | Supplier effectively unable to deliver; blocks EXPEDITE |
| `CAPACITY_CONSTRAINT` | Supplier at production capacity | HIGH | Blocks ALTERNATE_SUPPLIER option |
| `FORCE_MAJEURE` | Unforeseeable external event | CRITICAL | Blocks all options from that supplier |
| `CLEARED` | Constraint lifted | LOW | Restores supplier to unconstrained pool |

### 6.3 Constraint Lifecycle

```
[Initial state]
    → QUALITY_HOLD / CRITICAL   (supply.supplier.status.changed event)
    → active in SupplierConstraint table
    → supplier excluded from unconstrained count
    → ResilienceProfile recomputed

    → CLEARED                    (supply.supplier.status.changed event)
    → SupplierConstraint.constraintType = CLEARED
    → supplier restored to unconstrained count
    → ResilienceProfile recomputed
```

**Verified by:** `test_resilience.py::TestSC012_ConstraintExclusion::test_clearing_constraint_makes_supplier_unconstrained`.

---

## 7. Port Disruption Model

### 7.1 `PortStatus` Entity

| Field | Type | Description |
|---|---|---|
| `port_code` | `str` | IATA/UN LOCODE (e.g., SGSIN, DOHAH) |
| `port_name` | `str` | Human-readable port name |
| `disruption_type` | `str` | CONGESTION / STRIKE / WEATHER / CLOSURE / CLEARED |
| `severity` | `str` | LOW / MEDIUM / HIGH / CRITICAL |
| `affected_from_date` | `datetime` | Start of disruption |
| `estimated_clear_date` | `datetime` (optional) | Expected clearance |
| `source_event_id` | `str` | Confluent event that created this record |

### 7.2 ETA Impact Calculation

When a `PortStatus` is updated for port P:
1. Find all active `Shipment` records where `portOfDeparture == P` or `portOfEntry == P` and `status != DELIVERED`.
2. For each such shipment, re-evaluate whether the delayed ETA now causes a shortage for any linked `MaterialRequirement`.
3. If a new shortage condition is detected, trigger risk_rule_v1 → emit `supply.risk.detected`.
4. Recompute `SupplyChainResilienceProfile` for each affected `(workPackageId, materialId)` pair.

**Verified by:** `test_resilience.py::TestSC010_PortStatusEndpoint`.

---

## 8. Approved Vendor List (AVL) Model

### 8.1 `ApprovedVendorEntry` Entity

| Field | Type | Description |
|---|---|---|
| `supplier_id` | `str` | Supplier identifier |
| `material_id` | `str` | Material this approval covers |
| `avl_status` | `str` | APPROVED / SUSPENDED / REVOKED / REINSTATED |
| `effective_date` | `date` | Date qualification became effective |
| `expiry_date` | `date` (optional) | Qualification expiry |
| `reason` | `str` (optional) | Reason for current status |

### 8.2 Status Transitions

```
APPROVED → SUSPENDED     (quality concern, pending investigation)
APPROVED → REVOKED       (permanent disqualification)
SUSPENDED → APPROVED     (investigation cleared: REINSTATED)
SUSPENDED → REVOKED      (investigation confirmed failure)
REVOKED → (no transition — permanently excluded)
```

**Feasibility rule:** Only `APPROVED` (or `REINSTATED`) suppliers with no active `HIGH`/`CRITICAL` constraint may appear as feasible `ALTERNATE_SUPPLIER` or `EXPEDITE` candidates.

**Verified by:** `test_resilience.py::TestSC009_AvlEndpoint::test_avl_tertiary_supplier_is_unconstrained` and `TestSC011_NewAvlEntryAppearsImmediately`.

---

## 9. ResilienceMonitorAgent

### 9.1 Role

The `ResilienceMonitorAgent` is a wxO collaborator agent. It is the runtime interface between the resilience domain state and the planner. Primary routing agent delegates to it on queries about supply network posture, supplier constraints, port disruptions, and AVL status.

### 9.2 Tool Assignments

| Tool | API Call | Purpose |
|---|---|---|
| `get_resilience_profile` | GET `/api/resilience/profile` | Full profile with all 6+ fields |
| `get_avl_status` | GET `/api/resilience/avl` | All AVL entries + constrained/unconstrained counts |
| `get_port_status` | GET `/api/resilience/port-status` | Port disruption type, severity, impacted shipment count |
| `get_supplier_resilience_status` | GET `/api/resilience/supplier-status` | Live constraint state for a specific supplier |

### 9.3 Agent Behaviour Rules

- Must never present a supplier with an active `HIGH` or `CRITICAL` constraint as a feasible option.
- When `resilienceScore > 60` (CRITICAL), must proactively surface escalation context without being asked.
- When all PRIMARY and SECONDARY tier suppliers are constrained, must scan TERTIARY and SPOT tier AVL entries.
- Every response must include the `Resilience_posture` section with: primary supplier status, secondary supplier status, `unconstrainedApprovedSupplierCount`, and `resilienceScore`.
- Must call `get_avl_status` before presenting any ALTERNATE_SUPPLIER or EXPEDITE recommendation.

### 9.4 Suggested Prompts (UI Panel)

- What is the resilience posture of this material across the supply network?
- Why are the primary and secondary suppliers constrained?
- Which approved suppliers remain unconstrained?
- How is port congestion affecting our supply options?
- Has the Approved Vendor List changed since this risk was opened?

---

## 10. Staleness Detection

The resilience profile has a maximum useful age of **300 seconds**. If `profileAgeSecs > 300` at the time of a recommendation or action request:

1. The GET `/api/resilience/profile` response includes `"stale": true`.
2. The agent recommendation includes a `RESILIENCE_PROFILE_STALE` warning in the response body.
3. The warning does not block the recommendation — it informs the user that the posture may not reflect the very latest events.
4. Any write action submitted while the profile is stale should prompt a confirmation step in the UI before proceeding.

**Verified by:** `test_resilience.py::TestResilienceProfileEndpoint::test_profile_stale_flag_present`.

---

## 11. API Endpoints — Resilience Layer

All endpoints implemented in [`backend/app/routers/resilience.py`](../backend/app/routers/resilience.py).

| Method | Path | Query Params | Description |
|---|---|---|---|
| GET | `/api/resilience/profile` | `work_package_id`, `material_id` | Returns full `SupplyChainResilienceProfile` with `profileAgeSecs` and `stale` flag |
| GET | `/api/resilience/avl` | `material_id` | Returns all `ApprovedVendorEntry` records + `unconstrained_approved_count` |
| GET | `/api/resilience/port-status` | `port_code`, `material_id` (optional) | Returns port disruption detail + `impacted_shipment_count` |
| GET | `/api/resilience/supplier-status` | `supplier_id`, `material_id` | Returns `status` (ACTIVE / CLEARED), `constraint_type`, `constraint_severity` |
| POST | `/api/resilience/recompute` | body: `{work_package_id, material_id}` | Forces profile recomputation (admin / demo use) |
| GET | `/api/resilience/history` | `work_package_id`, `material_id` | Returns profile change history with timestamps |

**Error codes:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Unknown materialId, portCode, or supplierId |
| `RESILIENCE_PROFILE_STALE` | 200 (warning in body) | `profileAgeSecs > 300` |
| `SUPPLIER_CONSTRAINED` | 422 | Action attempted when supplier constraint still ACTIVE |
| `AVL_STATUS_CHANGED` | 422 | AVL status changed since recommendation was generated |

---

## 12. Integration with Mitigation Scoring

The resilience layer feeds into the mitigation scoring model in two ways:

### 12.1 Feasibility Gate

Before an option is scored, hard constraints derived from resilience state are applied:
- If `SupplierConstraint.constraint_severity IN (HIGH, CRITICAL)` and `constraint_type != CLEARED` → option is INFEASIBLE for ALTERNATE_SUPPLIER and EXPEDITE.
- If `ApprovedVendorEntry.avl_status IN (SUSPENDED, REVOKED)` → INFEASIBLE for ALTERNATE_SUPPLIER.
- These checks happen at **option generation time** and at **approval execution time** (revalidation step).

### 12.2 Resilience Context in Recommendation

The `resilienceContext` object is attached to every recommendation:
```json
{
  "primarySupplierStatus": "QUALITY_HOLD/CRITICAL",
  "secondarySupplierStatus": "PORT_CONGESTION/HIGH",
  "unconstrainedApprovedSupplierCount": 1,
  "resilienceScore": 75,
  "readinessStatus": "CRITICAL"
}
```

---

## 13. Invariants That Must Never Be Violated

1. A supplier with `SupplierConstraint.constraint_severity IN (HIGH, CRITICAL)` and `constraint_type != CLEARED` must never appear as a feasible `ALTERNATE_SUPPLIER` or `EXPEDITE` candidate.
2. A supplier with `ApprovedVendorEntry.avl_status IN (SUSPENDED, REVOKED)` must never appear as a feasible candidate for any active option type.
3. `resilienceScore` must always equal `(D1×0.30) + (D2×0.25) + (D3×0.25) + (D4×0.20)` to within ±0.1.
4. The four scoring dimension weights must always sum to exactly 1.0.
5. `readinessStatus` must always match the `resilienceScore` threshold table (CONFIRMED ≤ 25, AT_RISK 26–60, CRITICAL > 60).
6. `supply.material.readiness.assessed` must be emitted whenever the `readinessStatus` changes, and must carry the `correlationId` from the triggering event.
7. Any write action endpoint must re-validate supplier constraint and AVL status at execution time, not only at approval time. A constraint that became active after approval must block execution and return `SUPPLIER_CONSTRAINED`.

---

## 14. Demo Scenario Resilience Values

The following values represent the computed resilience profile for TW-2047 / CVA-8842 from the seeded demo state.

| Dimension | Raw Score | Weight | Contribution |
|---|---|---|---|
| D1: Supplier coverage | 60 (1 unconstrained) | 0.30 | 18.0 |
| D2: Inventory buffer | 100 (zero coverage at destination) | 0.25 | 25.0 |
| D3: Shipment exposure | 60 (4–7 days late) | 0.25 | 15.0 |
| D4: Port disruption | 100 (SGSIN HIGH) | 0.20 | 20.0 |
| **Total** | — | — | **78.0 (seed value ≈ 75)** |

**readinessStatus:** CRITICAL (> 60)  
**primarySupplierStatus:** QUALITY_HOLD/CRITICAL (SUP-101)  
**secondarySupplierStatus:** PORT_CONGESTION/HIGH (SUP-203)  
**unconstrainedApprovedSupplierCount:** 1 (SUP-205 only)  
**feasibleTransferLocationCount:** 1 (REGIONAL-WH-DEMO, 1 safe unit)  
**feasibleAlternateSupplierCount:** 1 (SUP-205, can deliver 2026-10-09)

**What the `ResilienceMonitorAgent` response must include:**

```
Resilience_posture:
  material: CVA-8842
  work_package: TW-2047
  readinessStatus: CRITICAL
  resilienceScore: 75
  primarySupplier: SUP-101 – QUALITY_HOLD / CRITICAL (blocked until ~2026-10-20)
  secondarySupplier: SUP-203 – PORT_CONGESTION / HIGH (routes through SGSIN)
  unconstrainedApprovedSuppliers: 1 (SUP-205 – Tertiary – unconstrained)
  portDisruption: SGSIN CONGESTION / HIGH – estimated clearance 2026-10-15
  recommendation: Escalate. Only 1 unconstrained approved supplier remains. Transfer from REGIONAL-WH-DEMO is the lowest-risk feasible option.
```

---

## 15. Acceptance Criteria (Resilience Layer)

| ID | Criterion | Verified By |
|---|---|---|
| SC-008 | A QUALITY_HOLD/CRITICAL supplier event updates the resilience profile and emits `supply.material.readiness.assessed` | `test_resilience.py::TestSC008` |
| SC-009 | Dashboard shows live constrained/unconstrained supplier count for CVA-8842 | `test_resilience.py::TestSC009` |
| SC-010 | Port-congestion event triggers ETA re-evaluation for SHP-90017 in the demo flow | `test_resilience.py::TestSC010` |
| SC-011 | A newly APPROVED AVL supplier appears in `get_avl_status` within the same processing cycle | `test_resilience.py::TestSC011` |
| SC-012 | Constrained suppliers are excluded from feasible mitigation candidates with constraint reason visible | `test_resilience.py::TestSC012` |
| SC-013 | `ResilienceMonitorAgent` routes correctly on "supply network" and "constrained supplier" queries | Agent eval §9.1 |
| SC-014 | Recommendation always includes `Resilience_posture` section with primary/secondary status and `resilienceScore` | Agent eval §9.1 |
| SC-015 | EXPEDITE workflow step is blocked if supplier constraint is still ACTIVE at execution time | `test_api.py::TestApprovalEnforcement` |
| SC-016 | `RESILIENCE_PROFILE_STALE` warning is surfaced when profile age exceeds 300s threshold | `test_resilience.py::TestResilienceProfileEndpoint::test_profile_stale_flag_present` |
