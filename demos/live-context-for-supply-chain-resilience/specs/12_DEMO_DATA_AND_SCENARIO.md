# Demo Data and Scenario Specification

**Document ID:** TSCI-SPEC-12  
**Version:** 2.0  
**Status:** Implemented — seed data live  
**Related specs:** 09_SCORING_AND_DECISION_SPEC, 13_SUPPLY_CHAIN_RESILIENCE_SPEC

---

## ⚠️ SYNTHETIC DATA DISCLAIMER

**Everything in this document is synthetic demonstration data.**  
No identifiers, organisation names, quantities, or transactions described here represent real operational data from any facility, company, or system. The scenario is designed solely to demonstrate the capabilities of the TSCI solution. Do not state or imply that any of these identifiers come from Shell, Pearl GTL, or any real energy company.

---

## 1. Purpose

This document provides the complete catalogue of seeded demo entities, the narrative for the primary demo scenario, the expected scoring output, the resilience seed events, and the step-by-step UI walkthrough. It is the single reference for anyone running, resetting, or extending the demonstration.

---

## 2. Demo Scenario Narrative

### Context

A turnaround is underway at **Pearl GTL Demo Facility** (a synthetic reference facility in Qatar). Work package **TW-2047** — a control-valve overhaul on synthetic asset **DEMO-UNIT-14** — is scheduled to begin **2026-10-11**. The job requires one unit of **CVA-8842** (control-valve actuator assembly) to be on-site by **2026-10-10**.

### The Problem

1. **Shipment delay:** SHP-90017, carrying the primary CVA-8842 unit from the primary supplier (SUP-101), was originally scheduled to arrive 2026-10-07. Due to severe port congestion at the Port of Singapore (SGSIN), it has been re-estimated to arrive **2026-10-14** — four days after the required-by date.

2. **Supplier constraints:** Before the delay was even reported, the primary supplier SUP-101 had already been placed on a **QUALITY_HOLD** at CRITICAL severity due to batch non-conformance. This means the primary supplier cannot accelerate or re-ship until cleared (estimated 2026-10-20). The secondary supplier SUP-203 routes through Singapore and is effectively unable to deliver within the window either.

3. **Zero local inventory:** The destination site (PEARL-DEMO) has **zero on-hand inventory** of CVA-8842.

### The Supply Network State

- **SUP-101 (Primary):** QUALITY_HOLD / CRITICAL — blocked until 2026-10-20
- **SUP-203 (Secondary):** PORT_CONGESTION / HIGH via SGSIN — cannot deliver in window
- **SUP-205 (Tertiary/Alternate):** APPROVED, no active constraint — can deliver by **2026-10-09**
- **REGIONAL-WH-DEMO:** 5 units on-hand, 4 available (1 reserved for future job) — safe to transfer 1 unit without jeopardising next requirement (2026-11-25)

### The Resolution

The TSCI agent investigates, scores all options deterministically, and presents a ranked recommendation. **TRANSFER from REGIONAL-WH-DEMO** is the top-ranked option (score ≈ 19). The human planner approves the transfer, the inventory is moved, and the risk is marked MITIGATED.

---

## 3. Seeded Entities Catalogue

### 3.1 Materials

| ID | Description | Mandatory | Has Substitute | Substitute Requires Eng. Approval | Min Approved Supplier Count |
|---|---|---|---|---|---|
| CVA-8842 | Control-valve actuator assembly | True | True | True | 2 |

### 3.2 Work Packages

| ID | Turnaround | Asset | Planned Start | Status |
|---|---|---|---|---|
| TW-2047 | TA-DEMO-2026 | DEMO-UNIT-14 | 2026-10-11T06:00:00Z | ACTIVE |

### 3.3 Material Requirements

| ID | Work Package | Material | Qty Required | Required By | Mandatory |
|---|---|---|---|---|---|
| MR-7781 | TW-2047 | CVA-8842 | 1 | 2026-10-10T00:00:00Z | True |

### 3.4 Purchase Orders

| PO ID | Supplier | PO Line | Material |
|---|---|---|---|
| PO-DEMO-45008723 | SUP-101 | 10 | CVA-8842 |

### 3.5 Shipments

| ID | Status | Original ETA | Current ETA | Destination | Port of Departure | Port of Entry | Delay Reason |
|---|---|---|---|---|---|---|---|
| SHP-90017 | DELAYED | 2026-10-07T10:00:00Z | 2026-10-14T10:00:00Z | PEARL-DEMO | SGSIN | DOHAH | TRANSPORT_DISRUPTION |

### 3.6 Inventory Positions

| Location ID | Material | On-Hand | Reserved | Available | Notes |
|---|---|---|---|---|---|
| PEARL-DEMO | CVA-8842 | 0 | 0 | 0 | Destination site — zero stock |
| REGIONAL-WH-DEMO | CVA-8842 | 5 | 1 | 4 | Regional warehouse; nextKnownRequirementDate = 2026-11-25 |

> Note: The inventory fixture seeds REGIONAL-WH-DEMO with `available=4`, but the safe-transfer quantity considering the next requirement is **1 unit**. The transfer option feasibility check uses `source_available_qty=1` (safe excess above next requirement) against `required_qty=1`.

### 3.7 Suppliers

| ID | Name | Tier | AVL Status | Active Constraint | Constraint Severity | Can Deliver By | Incremental Cost |
|---|---|---|---|---|---|---|---|
| SUP-101 | Demo Actuator Technologies Ltd. | PRIMARY | APPROVED | QUALITY_HOLD | CRITICAL | 2026-10-20+ (blocked) | — |
| SUP-203 | Demo Gulf Valve Systems | SECONDARY | APPROVED | PORT_CONGESTION | HIGH | Pushed past 2026-10-10 | — |
| SUP-205 | Demo Precision Valve Corp. | TERTIARY | APPROVED | None | — | **2026-10-09** | USD 18,000 |

### 3.8 Port Status

| Port Code | Port Name | Disruption Type | Severity | Active From | Est. Clearance |
|---|---|---|---|---|---|
| SGSIN | Port of Singapore | CONGESTION | HIGH | 2026-09-28T00:00:00Z | 2026-10-15T00:00:00Z |

### 3.9 Supplier Constraints

| Supplier | Material | Type | Severity | Active From | Est. Resolution |
|---|---|---|---|---|---|
| SUP-101 | CVA-8842 | QUALITY_HOLD | CRITICAL | 2026-09-25T00:00:00Z | 2026-10-20T00:00:00Z |
| SUP-203 | CVA-8842 | PORT_CONGESTION | HIGH | 2026-09-28T00:00:00Z | 2026-10-15T00:00:00Z |

### 3.10 Approved Vendor List (AVL)

| Supplier ID | Material ID | AVL Status | Effective Date |
|---|---|---|---|
| SUP-101 | CVA-8842 | APPROVED | 2024-01-01 |
| SUP-203 | CVA-8842 | APPROVED | 2024-03-15 |
| SUP-205 | CVA-8842 | APPROVED | 2025-06-01 |

### 3.11 Demo Correlation ID

`DEMO-TW2047-001` — used as the `correlationId` propagated through all events generated during the demo flow.

### 3.12 Computed Resilience Profile (Seed State)

| Field | Value |
|---|---|
| workPackageId | TW-2047 |
| materialId | CVA-8842 |
| readinessStatus | CRITICAL |
| resilienceScore | ~75 (> 60 threshold) |
| daysToRequired | 14 (from scenario start 2026-09-26) |
| availableAtDestination | 0 |
| shortfall | 1 |
| unconstrainedApprovedSupplierCount | 1 (SUP-205 only) |
| feasibleTransferLocationCount | 1 (REGIONAL-WH-DEMO) |
| feasibleAlternateSupplierCount | 1 (SUP-205) |
| primarySupplierStatus | QUALITY_HOLD/CRITICAL |
| secondarySupplierStatus | PORT_CONGESTION/HIGH |

---

## 4. Demo Flow Sequence

### Step 1 — Trigger the Risk (API or UI)

**Action:** POST `/api/demo/simulate-delay` with body `{"shipment_id": "SHP-90017", "requirement_id": "MR-7781"}`  
**What happens:** The risk detector evaluates SHP-90017 ETA vs MR-7781 requiredBy. PEARL-DEMO available=0 → shortage_quantity=1 → risk detected.  
**Expected output:** `{"risk_detected": true, "risk_id": "RSK-...", "severity": "CRITICAL" or "HIGH"}`

### Step 2 — View the Risk

**Action:** GET `/api/risks/{risk_id}` or navigate to Risk Detail in UI  
**Expected output:**
- riskType: `LATE_DELIVERY`
- severity: CRITICAL or HIGH (depends on current date vs requiredBy)
- facts: `{shortage_quantity: 1, current_eta: "2026-10-14", required_by: "2026-10-10"}`
- correlationId: `DEMO-TW2047-001`

### Step 3 — View Resilience Posture

**Action:** GET `/api/resilience/profile?work_package_id=TW-2047&material_id=CVA-8842` or open Resilience Posture panel in UI  
**Expected output:**
- readinessStatus: CRITICAL
- resilienceScore: ~75
- primarySupplierStatus: QUALITY_HOLD/CRITICAL
- secondarySupplierStatus: PORT_CONGESTION/HIGH
- unconstrainedApprovedSupplierCount: 1
- profileAgeSecs: (small positive number)
- stale: false

### Step 4 — View Mitigation Options

**Action:** GET `/api/risks/{risk_id}/options`  
**Expected output — ranked feasible options:**

| Rank | Option | Score | Feasibility |
|---|---|---|---|
| 1 | TRANSFER from REGIONAL-WH-DEMO | ~19 | FEASIBLE |
| 2 | ALTERNATE_SUPPLIER SUP-205 | ~28 | FEASIBLE |
| 3 | WAIT | ~57 | FEASIBLE |

**Infeasible options:**

| Option | Reason |
|---|---|
| EXPEDITE SUP-101 | SUPPLIER_CONSTRAINED: QUALITY_HOLD/CRITICAL active |
| EXPEDITE SUP-203 | SUPPLIER_CONSTRAINED: PORT_CONGESTION/HIGH active |
| SUBSTITUTE | NO_ENGINEERING_EVIDENCE: no approved engineering evidence in RAG corpus |

### Step 5 — Request Approval

**Action:** POST `/api/approvals` with `risk_id`, `option_id` (TRANSFER), `recommendation_summary`  
**Expected output:** `{"approval_request_id": "APR-...", "status": "PENDING"}`  
**Human approves:** POST `/api/approvals/{approval_request_id}/approve`  
**Expected output:** `{"status": "APPROVED", "expiry": "<+24h>"}`

### Step 6 — Execute Transfer

**Action:** POST `/api/actions/inventory-transfer` with `approval_request_id`, `risk_id`, `option_id`, `source=REGIONAL-WH-DEMO`, `destination=PEARL-DEMO`, `material_id=CVA-8842`, `quantity=1`  
**Expected output:** `{"status": "EXECUTED", "transfer_id": "TXN-..."}`  
**Side effects:**
- REGIONAL-WH-DEMO available: 4 → 3
- PEARL-DEMO available: 0 → 1
- Risk status: → MITIGATED
- Audit log entry created

---

## 5. Mitigation Option Scoring Detail

| Option | Schedule Risk | Technical Risk | Supply Risk | Cost (normalised) | Total Score |
|---|---|---|---|---|---|
| WAIT | 85 | 5 | 60 | 0 | **57.25** |
| TRANSFER (REGIONAL-WH-DEMO) | 20 | 10 | 25 | ~2 (USD 3,500) | **~19.45** |
| ALTERNATE_SUPPLIER (SUP-205) | 35 | 15 | 30 | ~8 (USD 18,000) | **~28.55** |
| SUBSTITUTE | N/A | 40–60 | variable | variable | **INFEASIBLE** |
| EXPEDITE SUP-101 | N/A | N/A | N/A | N/A | **INFEASIBLE** |
| EXPEDITE SUP-203 | N/A | N/A | N/A | N/A | **INFEASIBLE** |

**Near-equivalent check:** TRANSFER (19.45) vs ALTERNATE_SUPPLIER (28.55) → difference = 9.1 → **not near-equivalent** → single recommendation: TRANSFER.

---

## 6. Resilience Seed Events (Continuous RAG — 9 Events)

The following 9 events are seeded by `continuous_rag/scripts/seed_crag_events.py` to populate the `crag.*` topics for the continuous RAG demo:

| # | Topic | Event | Key Fields |
|---|---|---|---|
| 1 | `supply.approved_vendor.changed` | SUP-101 / CVA-8842 APPROVED | avlStatus=APPROVED, effectiveDate=2024-01-01 |
| 2 | `supply.approved_vendor.changed` | SUP-203 / CVA-8842 APPROVED | avlStatus=APPROVED, effectiveDate=2024-03-15 |
| 3 | `supply.approved_vendor.changed` | SUP-205 / CVA-8842 APPROVED | avlStatus=APPROVED, effectiveDate=2025-06-01 |
| 4 | `supply.supplier.status.changed` | SUP-101 QUALITY_HOLD/CRITICAL | affectedFrom=2026-09-25, estResolution=2026-10-20 |
| 5 | `supply.port.status.changed` | SGSIN CONGESTION/HIGH | affectedFrom=2026-09-28, estClear=2026-10-15 |
| 6 | `supply.shipment.updated` | SHP-90017 DELAYED newEta=2026-10-14 | correlationId=DEMO-TW2047-001 |
| 7 | `supply.material.readiness.assessed` | TW-2047/CVA-8842 CRITICAL | resilienceScore=75, unconstrainedCount=1 |
| 8 | `supply.risk.detected` | risk_rule_v1 LATE_DELIVERY/CRITICAL | shipmentId=SHP-90017, materialId=CVA-8842 |
| 9 | `supply.risk.detected` | risk_rule_v2 SUPPLIER_FAILURE/CRITICAL | allTiersConstrained=true, materialId=CVA-8842 |

---

## 7. Reset Behaviour

POST `/api/demo/reset` performs the following:

1. Clears all `SupplyRisk` records from the in-memory store.
2. Clears all `MitigationOption` records.
3. Clears all `ApprovalRequest` records.
4. Restores all inventory positions to seed values (PEARL-DEMO available=0, REGIONAL-WH-DEMO available=4).
5. Restores all shipment statuses to seed values (SHP-90017 DELAYED, ETA 2026-10-14).
6. Preserves `SupplierConstraint`, `PortStatus`, and `ApprovedVendorEntry` seed state (they are already set by `reset_to_seed()`).
7. Clears any audit log entries created during the demo run.

After reset, GET `/api/risks` returns `total == 0` (verified by `test_api.py::TestDemoReset`).

---

## 8. UI Walkthrough (6 Steps)

1. **Open the Control Tower dashboard** at `http://localhost:5173/`  
   — Observe the critical materials grid showing CVA-8842 with CRITICAL resilience posture indicator.  
   — The port disruption banner shows SGSIN CONGESTION/HIGH affecting 1 shipment.

2. **Trigger the demo** by clicking "Simulate SHP-90017 Delay" or using the API.  
   — A CRITICAL risk card appears for TW-2047 / CVA-8842.

3. **Click the risk card** to open the Risk Detail page.  
   — Resilience Posture panel shows: primary=QUALITY_HOLD/CRITICAL, secondary=PORT_CONGESTION/HIGH, unconstrained count=1, resilienceScore=75.  
   — Mitigation table shows TRANSFER and ALTERNATE_SUPPLIER as feasible; EXPEDITE and SUBSTITUTE shown as infeasible with reason.

4. **Open the Agent Panel** and ask: *"What are the options for CVA-8842?"*  
   — Agent returns ranked options, includes Resilience_posture section, notes that REGIONAL-WH-DEMO has 1 transferable unit.

5. **Click "Request Approval" on TRANSFER option**.  
   — Approval request created. Navigate to the Approval page to approve.

6. **Approve and execute**.  
   — Risk status changes to MITIGATED. PEARL-DEMO inventory shows 1 unit available.

### Step 6 — Execute Transfer and Verify Mitigation

**Action:** POST `/api/actions/inventory-transfer` with `approval_request_id`, `source_location_id=REGIONAL-WH-DEMO`, `destination_location_id=PEARL-DEMO`, `quantity=4`  
**Expected output:** Transfer executed, inventory at PEARL-DEMO updated to 4 units, risk status → `MITIGATED`  
**Audit trail:** GET `/api/demo/audit` returns 6 audit entries (source event → risk → tools called → recommendation → approval → transfer executed)

---

## 9. Continuous RAG Demo Events

Nine events are seeded across the seven `crag.*` topics for correlation ID `DEMO-TW2047-001`.

| # | Topic | Event type | Key fields |
|---|---|---|---|
| 1 | `crag.turnaround.material.required` | material_required | requirementId=REQ-TW2047-001, materialId=CVA-8842, requiredBy=2026-10-10 |
| 2 | `crag.supply.shipment.updated` | shipment_delayed | shipmentId=SHP-90017, originalEta=2026-10-07, currentEta=2026-10-14 |
| 3 | `crag.supply.risk.detected` | risk_detected_critical | riskId=RISK-001, severity=CRITICAL, resilienceFlags populated |
| 4 | `crag.supply.supplier.status.changed` | quality_hold | supplierId=SUP-101, constraintType=QUALITY_HOLD, severity=CRITICAL |
| 5 | `crag.supply.supplier.status.changed` | port_congestion | supplierId=SUP-203, constraintType=PORT_CONGESTION, severity=HIGH |
| 6 | `crag.supply.approved_vendor.changed` | new_supplier_approved | supplierId=SUP-205, materialId=CVA-8842, changeType=APPROVED |
| 7 | `crag.supply.port.status.changed` | port_congestion | portCode=SGSIN, disruptionType=CONGESTION, severity=HIGH |
| 8 | `crag.supply.material.readiness.assessed` | readiness_critical | readinessStatus=CRITICAL, unconstrainedApprovedSupplierCount=1 |
| 9 | `crag.supply.approved_vendor.changed` | avl_reinstated | supplierId=SUP-205, changeType=APPROVED, effectiveDate=2026-10-05 |

These events enable `crag_rag_agent_v1` to answer questions like:
- *"Which suppliers are constrained for CVA-8842?"*
- *"What is the current readiness status of TW-2047?"*
- *"Has SUP-205 been approved for CVA-8842?"*

---

## 10. Reset Behaviour

POST `/api/demo/reset` clears and re-seeds:

| What is cleared | What is re-seeded |
|---|---|
| All RiskEvents | SHP-90017 reset to original ETA 2026-10-07 |
| All ApprovalRequests | PEARL-DEMO inventory reset to 0 |
| All audit log entries | REGIONAL-WH-DEMO inventory reset to 5 (4 available) |
| All idempotency keys | Risk status cleared |
| SupplierConstraints (runtime) | Seed supplier constraints re-applied |
| PortStatus (runtime) | Port disruptions re-applied |

The reset does **not** clear `crag.*` Confluent topics. Use `bash infra/continuous_rag/scripts/reseed.sh` to purge and re-seed those.

---

## 11. Acceptance Criteria

| SC | Description | Verified by |
|---|---|---|
| SC-001 | Simulate delay produces CRITICAL risk | `POST /api/demo/simulate-delay` → risk appears |
| SC-002 | Agent explains TW-2047 and required date 2026-10-10 | Agent response contains work package and requiredBy |
| SC-003 | At least one feasible alternative identified | TRANSFER option feasible in `/api/risks/{id}/options` |
| SC-004 | SUBSTITUTE infeasible without evidence | NO_ENGINEERING_EVIDENCE returned, option.feasible=false |
| SC-005 | Execute transfer blocked without approval | 409 APPROVAL_REQUIRED returned |
| SC-006 | correlationId `DEMO-TW2047-001` visible end-to-end | Audit trail, risk event, tool responses all carry it |
| SC-007 | UI shows event → risk → options → approval → action | Full UI walkthrough passes |

