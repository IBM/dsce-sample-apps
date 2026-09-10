# Domain Model Specification

| Field | Value |
|---|---|
| **Version** | 2.0 |
| **Status** | Approved |
| **Last Updated** | 2025-01 |
| **Replaces** | `02_DOMAIN_MODEL.yaml` v1.0 |
| **Domain** | `turnaround-supply-chain` |
| **Bounded Context** | Oil & Gas Turnaround Supply Chain Intelligence |

---

## 1. Overview

The Turnaround Supply Chain Intelligence (TSCI) domain models the supply chain entities required to detect, assess, and mitigate material-readiness risk for planned oil and gas turnaround events. The domain is centred on the relationship between a **WorkPackage** (a discrete unit of turnaround maintenance work) and the **MaterialRequirements** that must be satisfied before it can begin.

The domain is divided into three functional clusters:

| Cluster | Entities | Responsibility |
|---|---|---|
| **Demand** | WorkPackage, MaterialRequirement | What materials are needed, when, where |
| **Supply** | Material, PurchaseOrder, PurchaseOrderLine, Shipment, InventoryPosition, Supplier | How materials are sourced, tracked, and stocked |
| **Risk & Resilience** | RiskEvent, MitigationOption, ApprovalRequest, SupplierConstraint, PortStatus, ApprovedVendorEntry, SupplyChainResilienceProfile, ResilienceFlags | Detection, ranking, approval, and continuous posture monitoring |

---

## 2. Entity Catalogue

| Entity | Key | Description |
|---|---|---|
| `Material` | `materialId` | Master record for a stockable material item |
| `PurchaseOrder` | `poId` | Header record for a supplier procurement order |
| `PurchaseOrderLine` | `(poId, lineId)` | Line item within a purchase order for one material |
| `Shipment` | `shipmentId` | Physical movement of goods from supplier to destination |
| `InventoryPosition` | `(locationId, materialId)` | Current stock balance at a specific location |
| `WorkPackage` | `workPackageId` | Unit of turnaround maintenance work at an asset |
| `MaterialRequirement` | `requirementId` | Material quantity needed by a work package at a deadline |
| `Supplier` | `supplierId` | Approved vendor capable of supplying one or more materials |
| `SupplierConstraint` | `(supplierId, materialId)` | Live constraint signal for a supplier's fulfillment capability |
| `PortStatus` | `portCode` | Live disruption state for a logistics port or hub |
| `ApprovedVendorEntry` | `(supplierId, materialId)` | Master AVL record for supplier approval per material |
| `SupplyChainResilienceProfile` | `(workPackageId, materialId)` | Computed resilience posture for a critical material/work-package pair |
| `RiskEvent` | `riskId` | Detected supply risk event requiring investigation and action |
| `MitigationOption` | `optionId` | Scored mitigation candidate for a risk event |
| `ApprovalRequest` | `approvalRequestId` | Human-in-the-loop approval record for a mitigation action |
| `ResilienceFlags` | _(embedded)_ | Embedded resilience context flags inside RiskEvent |
| `EventHeader` | _(embedded)_ | Common Kafka event envelope headers |
| `Evidence` | _(embedded)_ | RAG-retrieved document snippet grounding a recommendation |
| `RAGResponse` | _(value object)_ | Structured response from the knowledge retrieval service |
| `ApiError` | _(value object)_ | Machine-readable error returned by all API endpoints |

---

## 3. Entity Definitions

### 3.1 Material

Master record for a stockable item. Criticality drives the minimum approved-supplier requirement.

| Field | Type | Required | Description |
|---|---|---|---|
| `materialId` | string | ✓ | Unique material identifier (e.g., `CVA-8842`) |
| `description` | string | ✓ | Human-readable material description |
| `materialClass` | string | ✓ | Classification code (e.g., `VALVE`, `INSTRUMENT`) |
| `manufacturer` | string | ✓ | OEM manufacturer name |
| `manufacturerPartNumber` | string | ✓ | OEM part number |
| `criticality` | `MaterialCriticality` | ✓ | Risk classification: LOW / MEDIUM / HIGH / CRITICAL |
| `unitOfMeasure` | string | ✓ | Unit (e.g., `EA`, `KG`, `M`) |
| `minimumApprovedSupplierCount` | integer | ✓ | Minimum approved suppliers required for resilience posture |
| `hasApprovedSubstitute` | boolean | ✓ | Whether an approved engineering substitute exists |
| `substituteRequiresEngineeringApproval` | boolean | ✓ | Whether substitute use requires engineering sign-off |

**Business rules:**
- CRITICAL materials must have `minimumApprovedSupplierCount ≥ 2`.
- If `hasApprovedSubstitute = true` and `substituteRequiresEngineeringApproval = true`, the SUBSTITUTE mitigation option requires retrieved engineering evidence before it can be scored as feasible.

**Example:** `{ "materialId": "CVA-8842", "description": "Control Valve Assembly 8842", "criticality": "CRITICAL", "minimumApprovedSupplierCount": 2, "hasApprovedSubstitute": true, "substituteRequiresEngineeringApproval": true }`

---

### 3.2 PurchaseOrder

| Field | Type | Required | Description |
|---|---|---|---|
| `poId` | string | ✓ | Purchase order identifier (e.g., `PO-2026-0042`) |
| `supplierId` | string | ✓ | Supplier who owns this order |
| `orderDate` | date | ✓ | Date order was placed |
| `status` | `POStatus` | ✓ | Current order status |
| `currency` | string | ✓ | ISO 4217 currency code (e.g., `USD`) |

---

### 3.3 PurchaseOrderLine

| Field | Type | Required | Description |
|---|---|---|---|
| `poId` | string | ✓ | Parent purchase order |
| `lineId` | string | ✓ | Line item identifier within the PO |
| `materialId` | string | ✓ | Material being ordered |
| `quantity` | number | ✓ | Ordered quantity |
| `requiredDeliveryDate` | date | ✓ | Contractual delivery deadline |
| `agreedDeliveryDate` | date | ✓ | Agreed delivery date with supplier |

---

### 3.4 Shipment

Tracks physical movement of a PO line item from origin to destination.

| Field | Type | Required | Description |
|---|---|---|---|
| `shipmentId` | string | ✓ | Unique shipment ID (e.g., `SHP-90017`) |
| `poId` | string | ✓ | Associated purchase order |
| `poLineId` | string | ✓ | Associated PO line |
| `materialId` | string | ✓ | Material being shipped |
| `quantity` | number | ✓ | Quantity in this shipment |
| `status` | `ShipmentStatus` | ✓ | Current logistics state |
| `originalEta` | datetime | ✓ | ETA at time of dispatch |
| `currentEta` | datetime | ✓ | Latest known ETA — updated on every `supply.shipment.updated` event |
| `logisticsProvider` | string | ✓ | Carrier or freight-forwarder name |
| `destinationLocationId` | string | ✓ | Destination warehouse or site |
| `portOfDeparture` | string \| null | ✗ | Origin port code (used for port disruption correlation) |
| `portOfEntry` | string \| null | ✗ | Entry port code (used for port disruption correlation) |

**Business rules:**
- When `currentEta` changes, all contributing `SupplyChainResilienceProfile` records must be recomputed.
- If `portOfDeparture` or `portOfEntry` is an affected port in a `PortStatus` record with severity HIGH or CRITICAL, the shipment is treated as effectively delayed.

---

### 3.5 InventoryPosition

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | string | ✓ | Warehouse or site identifier |
| `materialId` | string | ✓ | Material this position refers to |
| `onHand` | number | ✓ | Physical stock count |
| `reserved` | number | ✓ | Quantity allocated to existing requirements |
| `available` | number | ✓ | Computed: `max(onHand - reserved, 0)` |
| `nextKnownRequirementDate` | date \| null | ✗ | Earliest future requirement at this location |

**Invariant:** `available = max(onHand - reserved, 0)` — must never be negative.

---

### 3.6 WorkPackage

| Field | Type | Required | Description |
|---|---|---|---|
| `workPackageId` | string | ✓ | Unique work package ID (e.g., `TW-2047`) |
| `turnaroundId` | string | ✓ | Parent turnaround event |
| `locationId` | string | ✓ | Facility or site where work is executed |
| `assetId` | string | ✓ | Asset or equipment being maintained |
| `plannedStart` | datetime | ✓ | Scheduled work start |
| `plannedEnd` | datetime | ✓ | Scheduled work completion |
| `status` | `WorkPackageStatus` | ✓ | Current readiness state |

---

### 3.7 MaterialRequirement

Links a material need to a work package with a hard deadline.

| Field | Type | Required | Description |
|---|---|---|---|
| `requirementId` | string | ✓ | Unique requirement ID |
| `workPackageId` | string | ✓ | Owning work package |
| `materialId` | string | ✓ | Required material |
| `quantityRequired` | number | ✓ | Quantity needed |
| `requiredBy` | datetime | ✓ | Hard deadline — material must be on site by this date |
| `mandatory` | boolean | ✓ | If true, late delivery triggers risk detection (risk_rule_v1) |

---

### 3.8 Supplier

| Field | Type | Required | Description |
|---|---|---|---|
| `supplierId` | string | ✓ | Unique supplier ID (e.g., `SUP-101`) |
| `name` | string | ✓ | Supplier trading name |
| `approved` | boolean | ✓ | Whether supplier is globally approved |
| `supportedMaterials` | array[string] | ✓ | List of material IDs this supplier can provide |
| `standardLeadTimeDays` | integer | ✓ | Normal order-to-delivery duration in days |
| `tier` | `SupplierTier` | ✓ | Supply tier: PRIMARY / SECONDARY / TERTIARY / SPOT |
| `activeConstraint` | `SupplierConstraint` \| null | ✗ | Live constraint record if currently impaired |
| `qualityRating` | number \| null | ✗ | Quality score 0–100 |
| `onTimeDeliveryRate` | number \| null | ✗ | Historical on-time rate 0.0–1.0 |

---

### 3.9 SupplierConstraint

Tracks live constraint signals from `supply.supplier.status.changed` events.

| Field | Type | Required | Description |
|---|---|---|---|
| `supplierId` | string | ✓ | Constrained supplier |
| `materialId` | string \| null | ✓ | Affected material; null = all materials for this supplier |
| `constraintType` | `ConstraintType` | ✓ | Nature of constraint |
| `constraintSeverity` | `RiskSeverity` | ✓ | Severity: LOW / MEDIUM / HIGH / CRITICAL |
| `affectedFromDate` | datetime | ✓ | When constraint became active |
| `estimatedResolutionDate` | datetime \| null | ✗ | Forecast clear date |
| `sourceEventId` | string | ✓ | Correlates to originating Kafka event |

**Blocking rule:** A supplier is blocked (treated as unconstrained=false) when `constraintType ∈ {QUALITY_HOLD, FORCE_MAJEURE, CAPACITY_CONSTRAINT, PORT_CONGESTION}` AND `constraintSeverity ∈ {HIGH, CRITICAL}`. LEAD_TIME_EXTENSION does not block. CLEARED removes the constraint record.

---

### 3.10 PortStatus

| Field | Type | Required | Description |
|---|---|---|---|
| `portCode` | string | ✓ | UNLOCODE or internal port identifier (e.g., `SGSIN`) |
| `portName` | string | ✓ | Human-readable port name |
| `disruptionType` | `PortDisruptionType` | ✓ | Type of disruption |
| `severity` | `RiskSeverity` | ✓ | Severity level |
| `affectedFromDate` | datetime | ✓ | Disruption start |
| `estimatedClearDate` | datetime \| null | ✗ | Expected clearance |
| `sourceEventId` | string | ✓ | Source Kafka event ID |

---

### 3.11 ApprovedVendorEntry

Master AVL record. Updated by `supply.approved_vendor.changed` events.

| Field | Type | Required | Description |
|---|---|---|---|
| `supplierId` | string | ✓ | Supplier reference |
| `materialId` | string | ✓ | Material reference |
| `status` | `AvlStatus` | ✓ | APPROVED / SUSPENDED / REVOKED |
| `effectiveDate` | date | ✓ | Date status took effect |
| `reason` | string \| null | ✗ | Reason for status change |

**Business rule:** Suppliers with `status ∈ {SUSPENDED, REVOKED}` must not appear as feasible mitigation candidates.

---

### 3.12 SupplyChainResilienceProfile

Computed readiness posture for a `(workPackageId, materialId)` pair. Recomputed on every contributing event arrival.

| Field | Type | Required | Description |
|---|---|---|---|
| `workPackageId` | string | ✓ | Work package reference |
| `materialId` | string | ✓ | Material reference |
| `requirementId` | string | ✓ | Driving material requirement |
| `assessedAt` | datetime | ✓ | Timestamp of last recomputation |
| `readinessStatus` | `ReadinessStatus` | ✓ | CONFIRMED / AT_RISK / CRITICAL / UNKNOWN |
| `daysToRequired` | integer | ✓ | Calendar days until `requiredBy` |
| `availableAtDestination` | number | ✓ | Current available inventory at destination |
| `shortfall` | number | ✓ | `max(quantityRequired - availableAtDestination, 0)` |
| `unconstrainedApprovedSupplierCount` | integer | ✓ | Count of APPROVED, non-blocked suppliers |
| `feasibleTransferLocationCount` | integer | ✓ | Locations with available stock for transfer |
| `feasibleAlternateSupplierCount` | integer | ✓ | Alternate suppliers who can deliver in time |
| `resilienceScore` | number | ✓ | 0–100; lower = better posture |
| `primarySupplierStatus` | string | ✓ | Status of PRIMARY tier supplier |
| `secondarySupplierStatus` | string \| null | ✗ | Status of SECONDARY tier supplier |
| `lastContributingEventId` | string | ✓ | correlationId of last event that triggered recompute |

**Resilience score formula:**
```
resilienceScore = (D1 × 0.30) + (D2 × 0.25) + (D3 × 0.25) + (D4 × 0.20)
```
- D1 — Supplier coverage (0=≥3 unconstrained, 25=2, 60=1, 100=0)
- D2 — Inventory buffer (0=covered, 30=transfer possible, 70=partial, 100=none)
- D3 — Shipment exposure (0=on-time, 30=≤3d late, 60=≤7d late, 100=>7d late)
- D4 — Port disruption (0=CLEARED, 20=LOW, 50=MEDIUM, 100=HIGH/CRITICAL)

**Readiness thresholds:** CONFIRMED ≤ 25 · AT_RISK ≤ 60 · CRITICAL > 60

---

### 3.13 RiskEvent

| Field | Type | Required | Description |
|---|---|---|---|
| `riskId` | string | ✓ | Unique risk ID (e.g., `RISK-001`) |
| `correlationId` | string | ✓ | End-to-end tracing ID — propagated to all downstream calls |
| `eventTime` | datetime | ✓ | When the risk was detected |
| `materialId` | string | ✓ | At-risk material |
| `shipmentId` | string | ✓ | Triggering shipment |
| `requirementId` | string | ✓ | Driving requirement |
| `workPackageId` | string | ✓ | Affected work package |
| `riskType` | `RiskType` | ✓ | LATE_DELIVERY / STOCKOUT / SUPPLIER_FAILURE / QUALITY_HOLD |
| `severity` | `RiskSeverity` | ✓ | LOW / MEDIUM / HIGH / CRITICAL |
| `status` | `POStatus`-like | ✓ | OPEN / INVESTIGATING / MITIGATION_PROPOSED / APPROVED / MITIGATED / CLOSED |
| `facts` | object | ✓ | Raw facts at detection time |
| `resilienceFlags` | `ResilienceFlags` | ✓ | Embedded resilience context snapshot |

---

### 3.14 MitigationOption

| Field | Type | Required | Description |
|---|---|---|---|
| `optionId` | string | ✓ | Unique option ID |
| `riskId` | string | ✓ | Parent risk |
| `type` | `MitigationType` | ✓ | WAIT / EXPEDITE / TRANSFER / ALTERNATE_SUPPLIER / SUBSTITUTE |
| `feasible` | boolean | ✓ | Whether hard constraints are satisfied |
| `estimatedReadyDate` | datetime \| null | ✗ | When material would be available under this option |
| `incrementalCost` | number \| null | ✗ | USD incremental cost vs baseline |
| `scheduleRiskScore` | number | ✓ | 0–100; schedule impact dimension |
| `technicalRiskScore` | number | ✓ | 0–100; technical/quality dimension |
| `supplyRiskScore` | number | ✓ | 0–100; supply reliability dimension |
| `totalScore` | number | ✓ | Weighted composite — lower is better |
| `requiresEngineeringApproval` | boolean | ✓ | SUBSTITUTE options always true |
| `requiresProcurementApproval` | boolean | ✓ | ALTERNATE_SUPPLIER / EXPEDITE typically true |
| `evidenceIds` | array[string] | ✓ | RAG evidence document IDs grounding this option |
| `constraints` | array[string] | ✓ | Human-readable constraint descriptions |

---

### 3.15 ApprovalRequest

| Field | Type | Required | Description |
|---|---|---|---|
| `approvalRequestId` | string | ✓ | Unique approval ID |
| `riskId` | string | ✓ | Associated risk |
| `optionId` | string | ✓ | Option being approved |
| `optionHash` | string | ✓ | SHA-256 snapshot of option at creation — immutability check |
| `recommendationSummary` | string | ✓ | Human-readable agent recommendation |
| `approver` | string \| null | ✗ | Populated on approval/rejection |
| `approvedAt` | datetime \| null | ✗ | Approval timestamp |
| `expiry` | datetime | ✓ | `createdAt + 24h` — approval expires after this |
| `status` | `ApprovalStatus` | ✓ | PENDING / APPROVED / REJECTED |
| `createdAt` | datetime | ✓ | Creation timestamp |

---

## 4. Enumeration Catalogue

| Enum | Values | Notes |
|---|---|---|
| `MaterialCriticality` | LOW, MEDIUM, HIGH, CRITICAL | Drives minimum supplier count requirement |
| `POStatus` | OPEN, CONFIRMED, PARTIALLY_SHIPPED, SHIPPED, CLOSED, CANCELLED | Purchase order lifecycle |
| `ShipmentStatus` | PLANNED, IN_TRANSIT, DELAYED, CUSTOMS, DELIVERED, CANCELLED | Logistics state |
| `WorkPackageStatus` | PLANNED, READY, AT_RISK, RELEASED, COMPLETE | Turnaround readiness state |
| `RiskType` | LATE_DELIVERY, STOCKOUT, SUPPLIER_FAILURE, QUALITY_HOLD | Nature of the supply risk |
| `RiskSeverity` | LOW, MEDIUM, HIGH, CRITICAL | Risk or constraint severity |
| `MitigationType` | WAIT, EXPEDITE, TRANSFER, ALTERNATE_SUPPLIER, SUBSTITUTE | Available mitigation classes |
| `ActorType` | SYSTEM, AGENT, HUMAN | Who made a state change |
| `ApprovalStatus` | PENDING, APPROVED, REJECTED | Approval lifecycle |
| `SupplierTier` | PRIMARY, SECONDARY, TERTIARY, SPOT | Supplier tier hierarchy |
| `ConstraintType` | QUALITY_HOLD, CAPACITY_CONSTRAINT, PORT_CONGESTION, FORCE_MAJEURE, LEAD_TIME_EXTENSION, CLEARED | Supplier constraint nature; CLEARED removes record |
| `PortDisruptionType` | CONGESTION, STRIKE, CLOSURE, WEATHER, CUSTOMS_DELAY, CLEARED | Port disruption nature; CLEARED removes record |
| `AvlStatus` | APPROVED, SUSPENDED, REVOKED | Approved vendor list status |
| `ReadinessStatus` | CONFIRMED, AT_RISK, CRITICAL, UNKNOWN | Computed material readiness posture |

---

## 5. Relationship Diagram

```
WorkPackage ──< MaterialRequirement >── Material
                                           │
                         ┌─────────────────┤
                         │                 │
                    PurchaseOrderLine ──── Shipment
                         │
                    PurchaseOrder
                         │
                       Supplier ──< SupplierConstraint
                                    ApprovedVendorEntry
                                         │
                    PortStatus ───────── Shipment (via port codes)

MaterialRequirement & Supplier ──> SupplyChainResilienceProfile
SupplyChainResilienceProfile ──── RiskEvent (resilienceFlags snapshot)
RiskEvent ──< MitigationOption ──< ApprovalRequest
```

---

## 6. Domain Invariants

| # | Invariant |
|---|---|
| I-01 | `InventoryPosition.available = max(onHand - reserved, 0)` — must never be negative |
| I-02 | A SUBSTITUTE mitigation option must have engineering evidence and `requiresEngineeringApproval = true` |
| I-03 | No write action (transfer, expedite, mark-mitigated) may execute without a prior APPROVED ApprovalRequest |
| I-04 | `correlationId` must be propagated from the triggering Kafka event through all downstream domain calls and emitted events |
| I-05 | A Supplier with `constraintType ∈ {QUALITY_HOLD, FORCE_MAJEURE, CAPACITY_CONSTRAINT, PORT_CONGESTION}` AND `constraintSeverity ∈ {HIGH, CRITICAL}` must not be counted as unconstrained |
| I-06 | `SupplyChainResilienceProfile.unconstrainedApprovedSupplierCount` must exclude all blocked suppliers |
| I-07 | `PortStatus.CLEARED` removes the disruption record; all shipment ETAs using that port must be re-evaluated |
| I-08 | `ApprovedVendorEntry.status ∈ {REVOKED, SUSPENDED}` excludes that supplier from all feasible mitigation options |
| I-09 | `SupplyChainResilienceProfile` must be recomputed whenever any of: SupplierConstraint, PortStatus, ApprovedVendorEntry, InventoryPosition, or Shipment changes for its `(workPackageId, materialId)` pair |
| I-10 | `ApprovalRequest.optionHash` is computed at creation and re-verified before every execution; mismatch raises `APPROVAL_MISMATCH` |
| I-11 | `ApprovalRequest.expiry = createdAt + 24h`; expired approvals cannot be used for execution |
| I-12 | `resilienceScore ≤ 25` → CONFIRMED; `25 < score ≤ 60` → AT_RISK; `score > 60` → CRITICAL |

---

## 7. Error Code Reference

| Code | HTTP | Trigger Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Requested entity (risk, shipment, supplier, etc.) does not exist in the store |
| `INVALID_INPUT` | 400 | Request body or query parameter fails schema validation |
| `STALE_DATA` | 409 | Profile or data is too old for a safe decision (general staleness) |
| `CONFLICT` | 409 | Operation conflicts with current resource state |
| `APPROVAL_REQUIRED` | 403 | Write action attempted without a prior APPROVED ApprovalRequest, or approval is PENDING/EXPIRED |
| `APPROVAL_MISMATCH` | 409 | SHA-256 hash of option at execution time does not match hash captured at approval |
| `INSUFFICIENT_INVENTORY` | 422 | TRANSFER execution: source `available` < requested `quantity` |
| `NO_ENGINEERING_EVIDENCE` | 422 | SUBSTITUTE option scored feasible but no engineering evidence was retrieved from RAG |
| `UPSTREAM_UNAVAILABLE` | 503 | Upstream service (Confluent, OpenSearch, etc.) is unreachable |
| `SUPPLIER_CONSTRAINED` | 422 | EXPEDITE execution: supplier has an active HIGH/CRITICAL constraint at execution time |
| `AVL_STATUS_CHANGED` | 409 | AVL status changed for the recommended supplier after recommendation was produced |

---

## 8. Change History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2025-01 | Build Lab | Initial YAML spec — entity catalogue and invariants |
| 2.0 | 2025-01 | Build Lab | Converted to Markdown; added full field tables, 14 enumerations, full error reference, resilience entities (SupplierConstraint, PortStatus, ApprovedVendorEntry, SupplyChainResilienceProfile), relationship diagram, and domain invariants I-05 through I-12 |
