# Event Contracts Specification

| Field | Value |
|---|---|
| **Version** | 2.0 |
| **Status** | Approved |
| **Last Updated** | 2025-01 |
| **Replaces** | `03_EVENT_CONTRACTS.yaml` v1.0 |
| **Transport** | Apache Kafka via Confluent Cloud |
| **Schema Format** | JSON Schema (Draft-07) |
| **Schema Registry** | Confluent Schema Registry — required |
| **Compatibility** | BACKWARD_TRANSITIVE on all topics |
| **Subject Strategy** | `topic-record` |

---

## 1. Event Architecture Overview

All supply chain domain events are produced and consumed via **Confluent Kafka**. The event backbone serves two primary functions:

1. **Operational streaming** — real-time ingestion of shipment, inventory, and demand signals into the risk-detection layer.
2. **Resilience correlation** — continuous streaming of supplier-tier, port, and AVL signals into the resilience correlation engine, which maintains a live `SupplyChainResilienceProfile` for every critical material/work-package pair.

### Design principles

- Events are **immutable** once produced. Domain state (`SupplierConstraint`, `PortStatus`, `ApprovedVendorEntry`, `SupplyChainResilienceProfile`) is derived from events and must be recomputed on each contributing arrival.
- All events carry a **common header** block for end-to-end correlation and audit.
- Processing is **idempotent** — duplicate `eventId` values are ignored at the consumer level using a persistent idempotency store.
- Schema evolution follows **BACKWARD_TRANSITIVE** compatibility — consumers on old schema versions can read events produced with new schema versions.

---

## 2. Common Event Headers

Every event envelope must include the following header fields. Consumers must propagate `correlationId` to all downstream events and API calls.

| Field | Type | Required | Description |
|---|---|---|---|
| `eventId` | UUID string | ✓ | Globally unique event identifier — used for idempotency deduplication |
| `eventType` | string | ✓ | Fully-qualified event type (e.g., `supply.shipment.updated`) |
| `eventVersion` | string | ✓ | Schema version string (e.g., `"1.0"`) |
| `occurredAt` | datetime (ISO-8601) | ✓ | When the business event occurred at the source system |
| `correlationId` | UUID string | ✓ | End-to-end tracing ID — must be propagated to all downstream events |
| `sourceSystem` | string | ✓ | Originating system name (e.g., `"logistics-adapter"`, `"procurement-system"`) |
| `producer` | string | ✓ | Specific producer instance identifier |

---

## 3. Topic Catalogue

| Topic | Message Key | Producer | Consumer(s) | Purpose |
|---|---|---|---|---|
| `supply.shipment.updated` | `shipmentId` | Logistics adapter | Risk detection engine | Shipment state and ETA changes |
| `supply.inventory.changed` | `locationId:materialId` | ERP/WMS adapter | Risk detection engine, resilience engine | Inventory balance changes |
| `turnaround.material.required` | `requirementId` | Turnaround planning system | Risk detection engine | New or updated material requirements |
| `supply.risk.detected` | `riskId` | Risk detection engine | wxO agents, control tower UI | New supply risk requiring investigation |
| `supply.risk.status.changed` | `riskId` | Risk management backend | Control tower UI, audit | Risk lifecycle state transitions |
| `supply.supplier.status.changed` | `supplierId:materialId` | Procurement/logistics adapters | Resilience correlation engine | Live supplier constraint signals |
| `supply.port.status.changed` | `portCode` | Logistics adapter | Resilience correlation engine | Port disruption and clearance signals |
| `supply.material.readiness.assessed` | `workPackageId:materialId` | Resilience correlation engine | Control tower UI, wxO agents | Computed material readiness posture |
| `supply.approved_vendor.changed` | `supplierId:materialId` | Procurement system adapter | Resilience correlation engine | AVL additions, removals, and reinstatements |

---

## 4. Topic Schemas

### 4.1 `supply.shipment.updated`

Produced by the logistics adapter whenever a shipment state or ETA changes. Triggers risk_rule_v1 evaluation.

| Field | Type | Required | Description |
|---|---|---|---|
| `shipmentId` | string | ✓ | Shipment being updated |
| `poId` | string | ✓ | Associated purchase order |
| `poLineId` | string | ✓ | Associated PO line |
| `materialId` | string | ✓ | Material in this shipment |
| `destinationLocationId` | string | ✓ | Destination warehouse or site |
| `originalEta` | datetime | ✓ | ETA as of initial dispatch |
| `currentEta` | datetime | ✓ | Latest ETA — compared against `requiredBy` for risk detection |
| `status` | string | ✓ | `ShipmentStatus` value |
| `delayReasonCode` | string \| null | ✗ | Logistics provider delay code |

**Acceptance criteria:**
- Duplicate `eventId` is ignored idempotently (no re-processing, no error).
- Invalid schema is rejected and routed to the dead-letter queue.
- `currentEta` change is persisted to the shipment record before risk rule evaluation.
- Triggers resilience profile recomputation for all `(workPackageId, materialId)` pairs linked to this shipment.

---

### 4.2 `supply.inventory.changed`

Produced by ERP/WMS on any balance change. Triggers resilience profile recomputation for the affected material.

| Field | Type | Required | Description |
|---|---|---|---|
| `locationId` | string | ✓ | Warehouse or site where balance changed |
| `materialId` | string | ✓ | Affected material |
| `onHand` | number | ✓ | Updated physical stock count |
| `reserved` | number | ✓ | Updated reserved quantity |
| `available` | number | ✓ | `max(onHand - reserved, 0)` |
| `effectiveAt` | datetime | ✓ | When the balance change took effect |

---

### 4.3 `turnaround.material.required`

Produced by the turnaround planning system when a new or revised material requirement is raised.

| Field | Type | Required | Description |
|---|---|---|---|
| `requirementId` | string | ✓ | Unique requirement identifier |
| `workPackageId` | string | ✓ | Owning work package |
| `materialId` | string | ✓ | Required material |
| `quantityRequired` | number | ✓ | Quantity needed |
| `requiredBy` | datetime | ✓ | Hard deadline — must be on site by this date |
| `locationId` | string | ✓ | Delivery destination |
| `mandatory` | boolean | ✓ | If true, shortfall triggers risk detection (risk_rule_v1) |

---

### 4.4 `supply.risk.detected`

Produced by the risk detection engine when risk_rule_v1 or risk_rule_v2 conditions are satisfied.

| Field | Type | Required | Description |
|---|---|---|---|
| `riskId` | string | ✓ | Unique risk identifier |
| `correlationId` | string | ✓ | Propagated from triggering event |
| `riskType` | string | ✓ | `RiskType` value |
| `severity` | string | ✓ | `RiskSeverity` value |
| `shipmentId` | string | ✓ | Triggering shipment |
| `materialId` | string | ✓ | At-risk material |
| `requirementId` | string | ✓ | Driving requirement |
| `workPackageId` | string | ✓ | Affected work package |
| `requiredBy` | datetime | ✓ | Material requirement deadline |
| `currentEta` | datetime | ✓ | Latest shipment ETA at detection time |
| `availableAtDestination` | number | ✓ | Available inventory at destination |
| `shortageQuantity` | number | ✓ | Quantity shortfall |
| `detectedAt` | datetime | ✓ | Detection timestamp |
| `resilienceFlags.primarySupplierConstrained` | boolean | ✓ | PRIMARY tier supplier has active blocking constraint |
| `resilienceFlags.secondarySupplierConstrained` | boolean | ✓ | SECONDARY tier supplier has active blocking constraint |
| `resilienceFlags.alternateInventoryAvailable` | boolean | ✓ | At least one alternate location has transferable stock |
| `resilienceFlags.approvedSubstituteDocumentExists` | boolean | ✓ | Engineering substitute document exists in knowledge base |
| `resilienceFlags.constrainedSupplierCount` | integer | ✓ | Total count of constrained approved suppliers |
| `resilienceFlags.activeSourcingTiers` | integer | ✓ | Number of unconstrained active supply tiers |

---

### 4.5 `supply.risk.status.changed`

Produced by the risk management backend on every risk lifecycle transition.

| Field | Type | Required | Description |
|---|---|---|---|
| `riskId` | string | ✓ | Risk being updated |
| `correlationId` | string | ✓ | End-to-end tracing ID |
| `oldStatus` | string | ✓ | Previous risk status |
| `newStatus` | string | ✓ | New risk status |
| `changedAt` | datetime | ✓ | Transition timestamp |
| `actorType` | string | ✓ | SYSTEM / AGENT / HUMAN |
| `actorId` | string | ✓ | Identifier of the actor making the change |

---

### 4.6 `supply.supplier.status.changed`

Real-time supplier constraint signals from procurement and logistics adapters. Primary input to the resilience correlation engine.

| Field | Type | Required | Description |
|---|---|---|---|
| `supplierId` | string | ✓ | Affected supplier |
| `materialId` | string \| null | ✓ | Affected material; null = all materials for this supplier |
| `constraintType` | string | ✓ | `ConstraintType` value: QUALITY_HOLD / CAPACITY_CONSTRAINT / PORT_CONGESTION / FORCE_MAJEURE / LEAD_TIME_EXTENSION / CLEARED |
| `constraintSeverity` | string | ✓ | LOW / MEDIUM / HIGH / CRITICAL |
| `affectedFromDate` | datetime | ✓ | When constraint became effective |
| `estimatedResolutionDate` | datetime \| null | ✗ | Forecast clear date |
| `impactedPOIds` | array[string] | ✗ | Known affected purchase orders |
| `sourceReference` | string \| null | ✗ | Logistics provider incident reference |
| `notes` | string \| null | ✗ | Free-text context |

**Acceptance criteria:**
- `constraintType = CLEARED` removes the active constraint record for the `supplierId:materialId` key.
- Duplicate `eventId` is ignored idempotently.
- A new constraint event for the same `supplierId:materialId` supersedes any prior open constraint.
- Receipt triggers resilience profile recomputation for all affected `(workPackageId, materialId)` pairs.

---

### 4.7 `supply.port.status.changed`

Port congestion and disruption signals affecting ETA calculations and supplier-tier availability.

| Field | Type | Required | Description |
|---|---|---|---|
| `portCode` | string | ✓ | UNLOCODE or internal port code (e.g., `SGSIN`) |
| `portName` | string | ✓ | Human-readable port name |
| `disruptionType` | string | ✓ | CONGESTION / STRIKE / CLOSURE / WEATHER / CUSTOMS_DELAY / CLEARED |
| `severity` | string | ✓ | LOW / MEDIUM / HIGH / CRITICAL |
| `affectedFromDate` | datetime | ✓ | Disruption start date |
| `estimatedClearDate` | datetime \| null | ✗ | Expected clearance date |
| `impactedShipmentIds` | array[string] | ✗ | Known affected shipment IDs |
| `affectedLogisticsProviders` | array[string] | ✗ | Logistics providers affected |

**Acceptance criteria:**
- `disruptionType = CLEARED` removes the active disruption record for `portCode`.
- Duplicate `eventId` is ignored idempotently.
- Receipt triggers ETA re-evaluation for all shipments using this port and resilience profile recomputation for all affected materials.

---

### 4.8 `supply.material.readiness.assessed`

Produced by the resilience correlation engine after evaluating all supplier-tier, shipment, and inventory signals for a `(workPackageId, materialId)` pair.

| Field | Type | Required | Description |
|---|---|---|---|
| `assessmentId` | string | ✓ | Unique assessment ID |
| `correlationId` | string | ✓ | Must match the correlationId of the triggering event |
| `workPackageId` | string | ✓ | Work package reference |
| `materialId` | string | ✓ | Material reference |
| `requirementId` | string | ✓ | Driving requirement |
| `assessedAt` | datetime | ✓ | Must be later than all contributing event timestamps |
| `readinessStatus` | string | ✓ | CONFIRMED / AT_RISK / CRITICAL / UNKNOWN |
| `readinessSummary.daysToRequired` | integer | ✓ | Days until `requiredBy` |
| `readinessSummary.availableAtDestination` | number | ✓ | Current available inventory at destination |
| `readinessSummary.quantityRequired` | number | ✓ | Required quantity |
| `readinessSummary.shortfall` | number | ✓ | `max(required - available, 0)` |
| `readinessSummary.primaryShipmentEta` | datetime \| null | ✗ | ETA of primary shipment |
| `readinessSummary.primaryShipmentDelayDays` | integer \| null | ✗ | Days late vs `requiredBy` |
| `supplierResilienceStatus.primarySupplierId` | string | ✓ | PRIMARY tier supplier ID |
| `supplierResilienceStatus.primarySupplierStatus` | string | ✓ | Constraint type or `ACTIVE` |
| `supplierResilienceStatus.secondarySupplierId` | string \| null | ✗ | SECONDARY tier supplier ID |
| `supplierResilienceStatus.secondarySupplierStatus` | string \| null | ✗ | Constraint type or `ACTIVE` |
| `supplierResilienceStatus.unconstrainedApprovedSupplierCount` | integer | ✓ | Unconstrained approved supplier count |
| `alternativeSources.feasibleTransferLocations` | array | ✓ | Location IDs with transferable stock |
| `alternativeSources.feasibleAlternateSuppliers` | array | ✓ | Supplier IDs able to deliver in time |
| `resilienceScore` | number | ✓ | 0–100; lower = better posture |

---

### 4.9 `supply.approved_vendor.changed`

Signals addition, removal, or reinstatement of a supplier on the Approved Vendor List (AVL).

| Field | Type | Required | Description |
|---|---|---|---|
| `supplierId` | string | ✓ | Supplier affected |
| `materialId` | string | ✓ | Material affected |
| `changeType` | string | ✓ | APPROVED / SUSPENDED / REVOKED / REINSTATED |
| `effectiveDate` | date | ✓ | Date status change takes effect |
| `reason` | string \| null | ✗ | Reason for the change |
| `authorisedBy` | string \| null | ✗ | Name or ID of authorising person |

**Acceptance criteria:**
- AVL status must be re-evaluated for all open risks linked to this material on receipt.
- A newly APPROVED or REINSTATED supplier must be available in `get_avl_status` within the same processing cycle.
- Duplicate `eventId` is ignored idempotently.

---

## 5. Risk Detection Rules

### 5.1 risk_rule_v1 — Late Critical Material Delivery

Triggered on `supply.shipment.updated` and `supply.inventory.changed` events.

| Condition | Expression |
|---|---|
| Delivery is late | `shipment.currentEta > requirement.requiredBy` |
| Inventory is insufficient | `destination.available < requirement.quantityRequired` |
| Requirement is mandatory | `requirement.mandatory == true` |

**Output:** Produces `supply.risk.detected` with `riskType = LATE_DELIVERY`.

---

### 5.2 risk_rule_v2 — Supplier Tier Critical Constraint

Triggered on `supply.supplier.status.changed` and `supply.approved_vendor.changed` events. Fires **before** a shipment delay is confirmed, enabling early intervention.

| Condition | Expression |
|---|---|
| Supplier constraint is critical | `supplier.constraintSeverity == CRITICAL` |
| Requirement is mandatory | `requirement.mandatory == true` |
| No unconstrained approved supplier can deliver in time | `unconstrainedApprovedSupplierCount == 0` AND no supplier with `leadTimeDays ≤ daysToRequired` is unconstrained |
| Inventory is insufficient | `destination.available < requirement.quantityRequired` |

**Output:** Produces `supply.risk.detected` with `riskType = SUPPLIER_FAILURE`.

**Note:** risk_rule_v2 enables the system to surface material-readiness risk before a shipment delay event arrives. This is critical for early resilience intervention when supplier-tier constraints eliminate all timely sourcing options.

---

## 6. Idempotency and Duplicate Handling

| Policy | Detail |
|---|---|
| **Idempotency store** | Required at all consumers; keyed by `eventId` |
| **Duplicate detection** | `eventId` already present in store → event silently ignored, no reprocessing |
| **Store backend** | In-memory for demo; persistent store (Redis or equivalent) for production |
| **Replay safety** | All consumers are replay-safe; replaying any topic from offset 0 must produce the same domain state |
| **At-least-once delivery** | Kafka consumer `enable.auto.commit = false`; manual commit after processing |

---

## 7. Schema Evolution Rules

| Rule | Detail |
|---|---|
| **Compatibility mode** | BACKWARD_TRANSITIVE on all topics |
| **Adding fields** | Allowed — new optional fields only; must have a default value |
| **Removing fields** | Not allowed without a schema version increment and migration plan |
| **Renaming fields** | Not allowed — add new field and deprecate old one via two-version migration |
| **Type changes** | Not allowed |
| **Subject naming** | `{topic-name}-value` for value schemas; `{topic-name}-key` for keyed topics |
| **Registration** | Schema must be registered in Confluent Schema Registry before first producer deployment |
| **Validation** | Producer must validate against registered schema before publish; invalid messages are not produced |

---

## 8. Error Handling and Dead-Letter Policy

| Scenario | Action |
|---|---|
| **Schema validation failure** | Message rejected at producer; not produced to topic |
| **Consumer deserialization failure** | Message routed to dead-letter topic `{topic}.dlq` |
| **Processing error (transient)** | Retry with exponential backoff; max 5 attempts |
| **Processing error (permanent)** | Route to `{topic}.dlq`; alert raised |
| **Poison message** | Quarantined to `{topic}.poison`; manual review required |
| **DLQ connector** | Enabled where supported by connector framework |
| **Replay** | Topics are replay-safe; DLQ messages can be replayed after root-cause fix |

---

## 9. Consumer Group Naming Conventions

| Pattern | Example |
|---|---|
| `tsci-{component}-{topic-shortname}` | `tsci-risk-engine-shipment-updated` |
| `tsci-resilience-{topic-shortname}` | `tsci-resilience-supplier-status` |
| `tsci-ui-{topic-shortname}` | `tsci-ui-risk-detected` |
| `tsci-demo-{topic-shortname}` | `tsci-demo-trace-bridge` |

Consumer group IDs must be stable across restarts to preserve offset tracking. Never share a consumer group between components with different processing semantics.

---

## 10. Demo Event Sequence

The following 9-event sequence is seeded at API startup with baseline timestamp `2026-09-25T08:00:00Z`. All events carry `correlationId = DEMO-TW2047-001`.

| Offset (secs) | Topic | Event ID | Description |
|---|---|---|---|
| 0 | `turnaround.material.required` | `EVT-MR-A1B2C3D4` | Material requirement raised — CVA-8842 for TW-2047 |
| 300 | `supply.inventory.changed` | `EVT-INV-E5F6G7H8` | Inventory consumed — PEARL-DEMO on-hand 1→0 |
| 600 | `supply.supplier.status.changed` | `EVT-SC-0001` | SUP-101 QUALITY_HOLD CRITICAL activated |
| 660 | `supply.supplier.status.changed` | `EVT-SC-0002` | SUP-203 PORT_CONGESTION HIGH activated (SGSIN routing) |
| 720 | `supply.port.status.changed` | `EVT-PT-0001` | SGSIN CONGESTION HIGH |
| 900 | `supply.approved_vendor.changed` | `EVT-AVL-9I0J1K2L` | SUP-205 TERTIARY APPROVED (emergency qualification) |
| 1200 | `supply.shipment.updated` | `EVT-SHP-3M4N5O6P` | SHP-90017 ETA delayed +7d (Oct 7 → Oct 14) |
| 1800 | `supply.risk.detected` | `EVT-RISK-7Q8R9S0T` | RISK-001 LATE_DELIVERY CRITICAL |
| 2100 | `supply.material.readiness.assessed` | `EVT-MRA-U1V2W3X4` | TW-2047/CVA-8842 AT_RISK (resilienceScore=78) |

---

## 11. Change History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2025-01 | Build Lab | Initial YAML spec — topic definitions, risk rules, error handling |
| 2.0 | 2025-01 | Build Lab | Converted to Markdown; full field tables for all 9 topics; acceptance criteria per topic; idempotency policy; schema evolution rules; consumer group conventions; demo event sequence table |
