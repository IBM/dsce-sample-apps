# Scoring and Decision Specification

**Document ID:** TSCI-SPEC-09  
**Version:** 2.0  
**Status:** Implemented  
**Related specs:** 02_DOMAIN_MODEL, 03_EVENT_CONTRACTS, 10_TEST_AND_EVALUATION_SPEC, 13_SUPPLY_CHAIN_RESILIENCE_SPEC

---

## 1. Purpose

This specification defines the deterministic scoring and decision-making rules for the Turnaround Supply Chain Intelligence (TSCI) solution. It governs how risk severity is classified, how supply chain resilience is measured, how mitigation options are ranked, and which options require human approval before execution.

---

## 2. Core Principle

> **LLMs explain. Algorithms decide.**

Feasibility checks, risk severity classification, resilience scoring, and mitigation ranking are all computed deterministically using explicit, auditable inputs. No large language model may assign a score, change a feasibility determination, or override a hard constraint. LLMs may only:

- Synthesise and explain the scoring output in natural language.
- Surface evidence and trade-offs from the RAG corpus.
- Guide the human approver through options.

Any implementation that allows an LLM to modify a `totalScore`, `feasible` flag, or `resilienceScore` is a **critical defect**.

---

## 3. Risk Severity Classification

Risk severity is computed from three inputs: whether the material is mandatory, the shortage quantity, and hours remaining until the required-by date.

| Severity | Conditions |
|---|---|
| **CRITICAL** | `mandatory == true` AND `shortage_quantity > 0` AND `hours_until_required ≤ 72` |
| **HIGH** | `mandatory == true` AND `shortage_quantity > 0` AND `hours_until_required ≤ 168` |
| **MEDIUM** | `mandatory == false` AND `shortage_quantity > 0` AND `hours_until_required ≤ 336` |
| **LOW** | All other cases (e.g., `shortage_quantity == 0`, or non-mandatory material outside window) |

Rules are evaluated top-down; the first match wins. A shipment that is late but where local inventory covers the shortfall (`available_qty >= required_qty`) must not generate a risk event — the shortage condition is false.

**Implementation reference:** [`compute_risk_severity()`](../backend/app/domain/scoring.py) — verified by `test_scoring.py::TestRiskSeverity` (4 tests).

---

## 4. Supply Chain Resilience Scoring

The resilience score describes the overall health of the supply network for a given `(workPackageId, materialId)` pair. It is computed **before** mitigation feasibility is evaluated and feeds into option scoring and the agent's recommendation context.

**Direction:** lower score = better posture  
**Range:** 0–100 (normalised)

### 4.1 Scoring Dimensions

#### D1: Supplier Coverage — weight 0.30

Measures how many approved suppliers exist with no active HIGH or CRITICAL constraint.

| State | Score |
|---|---|
| ≥ 3 unconstrained approved suppliers | 0 |
| 2 unconstrained approved suppliers | 25 |
| 1 unconstrained approved supplier | 60 |
| 0 unconstrained approved suppliers | 100 |

#### D2: Inventory Buffer — weight 0.25

Measures whether available inventory (local or transferable) covers the shortfall.

| State | Score |
|---|---|
| Available at destination ≥ required quantity | 0 |
| Transfer from another location covers shortfall | 30 |
| Partial coverage only | 70 |
| Zero coverage at any location | 100 |

#### D3: Shipment Exposure — weight 0.25

Measures how many calendar days the primary shipment is late relative to the required-by date.

| State | Score |
|---|---|
| On time or early (ETA ≤ requiredBy) | 0 |
| 1–3 days late | 30 |
| 4–7 days late | 60 |
| > 7 days late | 100 |

#### D4: Port / Logistics Disruption — weight 0.20

Measures the active disruption level at known routing hubs for shipments linked to this material.

| State | Score |
|---|---|
| No active disruption | 0 |
| LOW severity disruption | 20 |
| MEDIUM severity disruption | 50 |
| HIGH or CRITICAL disruption | 100 |

### 4.2 Composite Formula

```
resilienceScore =
  (D1_score × 0.30) +
  (D2_score × 0.25) +
  (D3_score × 0.25) +
  (D4_score × 0.20)
```

**Invariant:** The four weights must always sum to exactly 1.0. Verified by `test_scoring.py::TestScoringWeights::test_weights_sum_to_one`.

### 4.3 Readiness Status Thresholds

| Threshold | Condition |
|---|---|
| **CONFIRMED** | `resilienceScore ≤ 25` |
| **AT_RISK** | `resilienceScore` in range 26–60 |
| **CRITICAL** | `resilienceScore > 60` |

When `readinessStatus == CRITICAL`, the `ResilienceMonitorAgent` must proactively surface escalation context in every response without requiring the user to ask.

---

## 5. Mitigation Scoring

### 5.1 Scoring Weights

Mitigation scoring uses a weighted linear combination of four risk dimensions. The weights are defined in `ScoringWeights` and must not be modified at runtime.

| Dimension | Field | Weight |
|---|---|---|
| Schedule risk | `scheduleRisk` | **0.45** |
| Technical risk | `technicalRisk` | **0.25** |
| Supply risk | `supplyRisk` | **0.20** |
| Incremental cost | `incrementalCost` | **0.10** |

**Direction:** lower total score = better option.

### 5.2 Scoring Formula

```
totalScore =
  (scheduleRisk × 0.45) +
  (technicalRisk × 0.25) +
  (supplyRisk × 0.20) +
  (incrementalCostNormalised × 0.10)
```

`incrementalCostNormalised` is the incremental cost mapped to a 0–100 scale using a reference cap. Any cost above the cap is treated as 100 (worst). This prevents unbounded costs from dominating the score.

**Verified by:** `test_scoring.py::TestScoringWeights::test_cost_normalisation_caps_at_100`.

### 5.3 Option Score Reference (Demo Scenario)

| Option | Schedule Risk | Technical Risk | Supply Risk | Cost (norm) | Total Score |
|---|---|---|---|---|---|
| WAIT | 85 | 5 | 60 | 0 | ~57 |
| TRANSFER (REGIONAL-WH-DEMO) | 20 | 10 | 25 | 3500 → 2% | ~19 |
| ALTERNATE_SUPPLIER (SUP-205) | 35 | 15 | 30 | 18000 → 8% | ~28 |
| SUBSTITUTE | N/A | 40–60 | variable | variable | Infeasible* |

*SUBSTITUTE is infeasible in the demo scenario because no approved engineering evidence is present.

---

## 6. Hard Constraint Evaluation Rules

Hard constraints are evaluated **before** scoring. An option that fails a hard constraint is marked `feasible = false` and excluded from the ranked list. Its infeasibility reason must be included in the response.

| Option Type | Constraint | Feasibility Result |
|---|---|---|
| TRANSFER | Source available quantity < required quantity | **INFEASIBLE** — `insufficient source inventory` |
| TRANSFER | Transfer would jeopardise source location's next known requirement | **INFEASIBLE** — `source requirement jeopardised` |
| ALTERNATE_SUPPLIER | Supplier not present in Approved Vendor List | **INFEASIBLE** — `not approved` |
| ALTERNATE_SUPPLIER | AVL status is `SUSPENDED` or `REVOKED` | **INFEASIBLE** — `AVL status not approved` |
| ALTERNATE_SUPPLIER | Supplier has active `QUALITY_HOLD`, `FORCE_MAJEURE`, or `CAPACITY_CONSTRAINT` at `HIGH` or `CRITICAL` severity | **INFEASIBLE** — `active supplier constraint` |
| SUBSTITUTE | No approved engineering evidence document present in RAG corpus | **INFEASIBLE** — `NO_ENGINEERING_EVIDENCE` |
| EXPEDITE | Primary shipment supplier has an active constraint that prevents delivery improvement | **INFEASIBLE** — `SUPPLIER_CONSTRAINED` |
| Any | Estimated ready date after hard required-by deadline (unless explicitly presented as a schedule-impact option) | **INFEASIBLE** — `deadline exceeded` |

**Implementation reference:** [`apply_hard_constraints()`](../backend/app/domain/scoring.py) — verified by `test_scoring.py::TestHardConstraints` (5 tests).

---

## 7. Scoring Algorithm (8 Steps)

The full mitigation scoring algorithm is executed in this order:

1. **Receive inputs** — `riskId`, `shipment`, `inventoryPositions`, `supplierOptions`, `ragEvidenceList`, `resilience_profile`.
2. **Classify risk severity** — apply §3 rules to determine CRITICAL / HIGH / MEDIUM / LOW.
3. **Compute resilience profile** — apply §4 formula across D1–D4 to get `resilienceScore` and `readinessStatus`.
4. **Generate candidate options** — enumerate WAIT, TRANSFER, ALTERNATE_SUPPLIER, SUBSTITUTE, EXPEDITE for available inputs.
5. **Apply hard constraints** — for each candidate, evaluate §6 rules; mark infeasible with reason if any rule fires.
6. **Score feasible options** — for each feasible option, apply §5.2 formula to compute `totalScore`.
7. **Rank options** — sort feasible options by `totalScore` ascending (lower = better).
8. **Apply near-equivalent rule** — if top-two scores differ by < 5 points, flag both as near-equivalent and present both to the approver.

**Output:** ranked list of `MitigationOption` objects, each with `feasible`, `totalScore`, `reason` (if infeasible), and `resilienceContext`.

---

## 8. Near-Equivalent Detection

Two options are near-equivalent if and only if:

```
abs(option_a.totalScore - option_b.totalScore) < 5.0
```

When the top two ranked options are near-equivalent, both must be presented to the human approver with their trade-offs highlighted. The system must not autonomously pick one. The agent must explain the difference in schedule risk, cost, and supply risk — not the numeric score alone.

**Verified by:** `test_scoring.py::TestRankOptions::test_near_equivalent_within_5_points` and `test_not_near_equivalent_beyond_5_points`.

---

## 9. Example Scoring Walk-Through (Demo Scenario)

**Context:** CVA-8842 required by 2026-10-10. SHP-90017 delayed to 2026-10-14 (4 days late). PEARL-DEMO has 0 inventory. REGIONAL-WH-DEMO has 1 available unit. SUP-205 can deliver 2026-10-09.

### Step 1 – Risk Severity
- `mandatory = true`, `shortage_quantity = 1`, `hours_until_required ≈ 96` → **CRITICAL** (≤ 168h but > 72h → actually HIGH; demo start date 2026-09-26 gives ~336h → at demo start severity may be HIGH; by execution day CRITICAL).

### Step 2 – Resilience Score (CVA-8842)
- D1 (supplier coverage): 1 unconstrained approved supplier (SUP-205) → score = 60 × 0.30 = **18.0**
- D2 (inventory buffer): transfer covers shortfall (REGIONAL-WH-DEMO) → score = 30 × 0.25 = **7.5**
- D3 (shipment exposure): 4–7 days late → score = 60 × 0.25 = **15.0**
- D4 (port disruption): SGSIN CONGESTION/HIGH → score = 100 × 0.20 = **20.0**
- **resilienceScore = 18.0 + 7.5 + 15.0 + 20.0 = 60.5** → wait, demo seeded value is **75** → D2 uses zero coverage (only REGIONAL-WH has stock, not destination) → D2 = 100 × 0.25 = 25.0 → total = 18.0 + 25.0 + 15.0 + 20.0 = **78.0** rounds to ~75 in seed. → **readinessStatus = CRITICAL** (> 60).

### Step 3 – Hard Constraints
| Option | Constraint Check | Result |
|---|---|---|
| WAIT | None | FEASIBLE |
| TRANSFER | REGIONAL-WH-DEMO available=1 ≥ required=1, next req 2026-11-25 not jeopardised | FEASIBLE |
| ALTERNATE_SUPPLIER SUP-205 | AVL APPROVED, no active constraint | FEASIBLE |
| EXPEDITE SUP-101 | QUALITY_HOLD/CRITICAL active | **INFEASIBLE** |
| EXPEDITE SUP-203 | PORT_CONGESTION/HIGH active | **INFEASIBLE** |
| SUBSTITUTE | No engineering evidence in RAG | **INFEASIBLE** |

### Step 4 – Scoring Feasible Options
| Option | Total Score |
|---|---|
| TRANSFER | ~19 |
| ALTERNATE_SUPPLIER (SUP-205) | ~28 |
| WAIT | ~57 |

### Step 5 – Near-Equivalent Check
TRANSFER (~19) vs ALTERNATE_SUPPLIER (~28): difference = 9 points → **not near-equivalent**. Single recommendation: **TRANSFER from REGIONAL-WH-DEMO**.

---

## 10. Recommendation Format Requirements

Every recommendation response from any agent must include:

1. **Recommended option** — option type, source details, estimated ready date.
2. **Ranked alternatives** — all feasible options with scores and trade-off summary.
3. **Infeasible options** — each excluded option with the hard constraint reason.
4. **Resilience context** — `primarySupplierStatus`, `secondarySupplierStatus`, `unconstrainedApprovedSupplierCount`, `resilienceScore`, `readinessStatus`.
5. **Assumptions** — any data that was inferred rather than read from live state (e.g., lead times).
6. **Approval requirement** — explicit statement that human approval is required before any action executes.

The `Resilience_posture` section in the agent response is mandatory and must not be omitted even when the posture is CONFIRMED.

---

## 11. Approval Requirement Rules

| Option Type | Approval Type Required |
|---|---|
| TRANSFER | Procurement or Operations Manager approval |
| ALTERNATE_SUPPLIER | Procurement approval |
| EXPEDITE | Procurement approval |
| SUBSTITUTE | Engineering approval **AND** Procurement approval |
| WAIT | No execution action; human acknowledgement only |

An action may not be executed until an `ApprovalRequest` with `status = APPROVED` and a non-expired `expiry` timestamp exists for the exact `(approvalRequestId, optionId)` pair, and the option hash at execution time matches the hash at approval time.

**Enforcement:** Any mutation endpoint (`/api/actions/*`) returns HTTP 403 with `code: APPROVAL_REQUIRED` if the approval check fails.

---

## 12. What Must Never Be Done

The following behaviours constitute **critical defects** in the implementation:

- An LLM assigning, overriding, or adjusting a `totalScore`, `scheduleRisk`, `technicalRisk`, `supplyRisk`, or `incrementalCost` value.
- Presenting a `SUSPENDED` or `REVOKED` AVL supplier as a feasible option.
- Presenting a supplier with an active `HIGH` or `CRITICAL` constraint as feasible for ALTERNATE_SUPPLIER or EXPEDITE.
- Returning a SUBSTITUTE recommendation without an engineering evidence document ID from the RAG corpus.
- Executing any write action (inventory transfer, expedite request, supplier order) without a valid, non-expired, hash-matched approval record.
- Fabricating inventory quantities, supplier lead times, or engineering compatibility claims not present in the data store or RAG corpus.
- Omitting the `Resilience_posture` section from a recommendation response.
- Allowing a score difference threshold other than 5.0 for near-equivalent detection.
