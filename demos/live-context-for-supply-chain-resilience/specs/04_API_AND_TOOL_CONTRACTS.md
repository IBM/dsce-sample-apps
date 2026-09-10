# API and Tool Contracts Specification

| Field | Value |
|---|---|
| **Version** | 2.0 |
| **Status** | Approved |
| **Last Updated** | 2025-01 |
| **Replaces** | `04_API_AND_TOOL_CONTRACTS.yaml` v1.1 |
| **API Framework** | FastAPI (Python) |
| **OpenAPI Target** | 3.1 |
| **Base Port** | 3001 |
| **API Prefix** | `/api` |
| **Interactive Docs** | `GET /api/docs` (Swagger UI) |

---

## 1. API Overview

The TSCI backend exposes a REST API on port `3001` with prefix `/api`. All endpoints follow a consistent envelope pattern. There are 10 router modules covering the full domain surface:

| Router | Prefix | Responsibility |
|---|---|---|
| `actions` | `/api/actions` | Approval lifecycle and execution write operations |
| `confluent` | `/api/confluent` | Confluent trace bridge (demo) |
| `demo` | `/api/demo` | Demo reset and simulation endpoints |
| `inventory` | `/api/inventory` | Inventory query and options |
| `rag` | `/api/knowledge` | Enterprise knowledge retrieval (RAG) |
| `resilience` | `/api/resilience` | Resilience profiles, AVL, port status, supplier status |
| `risks` | `/api/risks` | Risk event list, detail, and mitigation options |
| `shipments` | `/api/shipments` | Shipment detail |
| `suppliers` | `/api/suppliers` | Supplier options |
| `work_packages` | `/api/work-packages` | Work package detail with requirements |

---

## 2. Authentication and CORS Policy

| Policy | Value |
|---|---|
| **Authentication** | No authentication enforced in demo mode. Production deployments must inject an auth middleware. |
| **CORS** | Permissive in demo mode — `Access-Control-Allow-Origin: *`. Tighten to known UI origin in production. |
| **Correlation ID** | All requests should include `X-Correlation-ID` header. If absent, the backend generates a UUID and returns it in `X-Correlation-ID` response header. |
| **Content-Type** | `application/json` for all request and response bodies. |

---

## 3. Standard Response Envelope

All successful responses include a `source_timestamp` field indicating when the data was read from the store.

```json
{
  "data_field": "...",
  "source_timestamp": "2026-09-25T08:00:00Z"
}
```

All error responses use the `ApiError` envelope:

```json
{
  "code": "NOT_FOUND",
  "message": "Risk RISK-999 not found",
  "retriable": false,
  "correlation_id": "DEMO-TW2047-001",
  "details": null
}
```

| Field | Type | Description |
|---|---|---|
| `code` | string | Machine-readable `ApiErrorCode` literal |
| `message` | string | Human-readable error description |
| `retriable` | boolean | Whether the caller may safely retry immediately |
| `correlation_id` | string | Correlation ID from the request |
| `details` | object \| null | Optional additional structured context |

---

## 4. HTTP Status Code Mapping

| Error Code | HTTP Status | Trigger |
|---|---|---|
| `NOT_FOUND` | 404 | Entity does not exist |
| `INVALID_INPUT` | 400 | Request body or param fails validation |
| `STALE_DATA` | 409 | Data too old for safe decision |
| `CONFLICT` | 409 | State conflict |
| `APPROVAL_REQUIRED` | 403 | Write attempted without APPROVED approval |
| `APPROVAL_MISMATCH` | 409 | Option hash changed after approval |
| `INSUFFICIENT_INVENTORY` | 422 | Transfer quantity exceeds available stock |
| `NO_ENGINEERING_EVIDENCE` | 422 | SUBSTITUTE with no RAG evidence |
| `UPSTREAM_UNAVAILABLE` | 503 | Upstream service unreachable |
| `SUPPLIER_CONSTRAINED` | 422 | Supplier has active HIGH/CRITICAL constraint |
| `AVL_STATUS_CHANGED` | 409 | AVL changed after recommendation |
| `RESILIENCE_PROFILE_STALE` | 412 | Profile age exceeds 300-second threshold |


---

## 5. Endpoint Catalogue

### 5.1 Router: `risks`

#### `GET /api/risks`

Returns all active risk events.

| Attribute | Value |
|---|---|
| Auth required | No |
| Response | `{ risks: RiskEvent[], total: integer, source_timestamp: datetime }` |
| Error codes | — |

#### `GET /api/risks/{risk_id}`

Returns a single risk event with full detail.

| Attribute | Value |
|---|---|
| Path param | `risk_id` — string |
| Response | `{ risk: RiskEvent, source_timestamp: datetime }` |
| Error codes | `NOT_FOUND` |

#### `GET /api/risks/{risk_id}/options`

Returns ranked mitigation options for a risk. Options are sorted by `totalScore` ascending (lower = better). `near_equivalent_top_two = true` when the top two feasible options differ by < 5 score points.

| Attribute | Value |
|---|---|
| Path param | `risk_id` — string |
| Response | `{ risk_id, ranked_options: MitigationOption[], near_equivalent_top_two: boolean, score_version: "v1", source_timestamp }` |
| Error codes | `NOT_FOUND` |

---

### 5.2 Router: `shipments`

#### `GET /api/shipments/{shipment_id}`

| Attribute | Value |
|---|---|
| Path param | `shipment_id` — string |
| Response | `{ shipment: Shipment, source_timestamp: datetime }` |
| Error codes | `NOT_FOUND` |

---

### 5.3 Router: `work_packages`

#### `GET /api/work-packages/{work_package_id}`

Returns the work package with all material requirements.

| Attribute | Value |
|---|---|
| Path param | `work_package_id` — string |
| Response | `{ work_package: WorkPackage, requirements: MaterialRequirement[], source_timestamp: datetime }` |
| Error codes | `NOT_FOUND` |

---

### 5.4 Router: `inventory`

#### `GET /api/inventory/options`

Evaluates inventory transfer candidates for a shortage.

| Attribute | Value |
|---|---|
| Query params | `material_id` (required), `destination_location_id` (required), `quantity` (required), `required_by` (required) |
| Response | `{ material_id, destination_location_id, candidates: [{ position: InventoryPosition, transfer_feasible: boolean, notes: string[] }], evaluated_at }` |
| Error codes | `INVALID_INPUT` |

---

### 5.5 Router: `suppliers`

#### `GET /api/suppliers/options`

Returns approved, unconstrained suppliers that can fulfil a material need. Constrained suppliers are included in a separate `excludedDueToConstraint` array with the constraint reason.

| Attribute | Value |
|---|---|
| Query params | `material_id` (required), `required_by` (required), `quantity` (required) |
| Response | `{ material_id, candidates: Supplier[], excludedDueToConstraint: [{ supplier, constraint_type, constraint_severity }], evaluated_at }` |
| Error codes | `INVALID_INPUT` |

---

### 5.6 Router: `rag`

#### `POST /api/knowledge/retrieve`

Hybrid BM25 + semantic retrieval from the enterprise knowledge base. SUBSTITUTE claims require at least one current approved engineering/substitution source — `grounded = false` otherwise.

| Attribute | Value |
|---|---|
| Body | `{ query: string, filters: object, top_k: integer (default 5) }` |
| Response | `{ answer: string, grounded: boolean, confidence: number, evidence: Evidence[], applied_filters: object, query_id: string }` |
| Error codes | `INVALID_INPUT`, `UPSTREAM_UNAVAILABLE` |

---

### 5.7 Router: `resilience`

#### `GET /api/resilience/profile`

Returns full `SupplyChainResilienceProfile` for a `(workPackageId, materialId)` pair. Recomputes on-demand if no cached profile exists. Stale threshold: 300 seconds.

| Attribute | Value |
|---|---|
| Query params | `work_package_id` (required), `material_id` (required) |
| Response | `{ profile: SupplyChainResilienceProfile, evaluated_at, profile_age_secs: integer, stale: boolean }` |
| Error codes | `NOT_FOUND`, `RESILIENCE_PROFILE_STALE` |

The profile response includes four dimension score fields:

| Field | Dimension | Weight |
|---|---|---|
| `supplier_coverage_score` | D1 — Unconstrained supplier count | 0.30 |
| `inventory_buffer_score` | D2 — Available inventory vs shortfall | 0.25 |
| `shipment_exposure_score` | D3 — Shipment delay vs required date | 0.25 |
| `port_disruption_score` | D4 — Port disruption severity | 0.20 |

#### `GET /api/resilience/avl`

Returns AVL entries for a material with live constraint context. Sorted: unconstrained APPROVED first, then by tier (PRIMARY → SPOT).

| Attribute | Value |
|---|---|
| Query params | `material_id` (required) |
| Response | `{ material_id, entries: AvlEntryResponse[], unconstrained_approved_count: integer, evaluated_at }` |
| Error codes | `NOT_FOUND` |

#### `GET /api/resilience/port-status`

Returns port disruption status and impacted shipment count.

| Attribute | Value |
|---|---|
| Query params | `port_code` (required), `material_id` (optional) |
| Response | `{ port_code, port_name, disruption_type, severity, estimated_clear_date, impacted_shipment_count, evaluated_at }` |
| Error codes | `NOT_FOUND` |

#### `GET /api/resilience/supplier-status`

Returns live constraint state (ACTIVE or CLEARED) for a specific supplier.

| Attribute | Value |
|---|---|
| Query params | `supplier_id` (required), `material_id` (optional, null = all materials) |
| Response | `{ supplier_id, supplier_name, material_id, status, constraint_type, constraint_severity, affected_from_date, estimated_resolution_date, source_event_id, evaluated_at }` |
| Error codes | `NOT_FOUND` |

#### `POST /api/resilience/supplier-constraint`

Ingest supplier constraint from Kafka consumer or demo loop. Triggers resilience profile recomputation for all affected `(workPackageId, materialId)` pairs.

| Attribute | Value |
|---|---|
| Body | `{ supplier_id, material_id, constraint_type, constraint_severity, affected_from_date, estimated_resolution_date, source_reference, notes, event_id, correlation_id }` |
| Response | `{ updated: boolean, supplier_id, constraint_type, constraint_severity }` |
| Error codes | `INVALID_INPUT` |

#### `POST /api/resilience/port-disruption`

Ingest port disruption from Kafka consumer or demo loop.

| Attribute | Value |
|---|---|
| Body | `{ port_code, port_name, disruption_type, severity, affected_from_date, estimated_clear_date, impacted_shipment_ids, affected_logistics_providers, event_id, correlation_id }` |
| Response | `{ updated: boolean, port_code, disruption_type, severity }` |
| Error codes | `INVALID_INPUT` |

---

### 5.8 Router: `actions`

#### `POST /api/actions/approval-requests`

Creates a PENDING approval request. Captures `optionHash` (SHA-256 of option snapshot) for post-approval immutability verification. Expires after 24 hours.

| Attribute | Value |
|---|---|
| Body | `{ risk_id, option_id, recommendation_summary }` |
| Response | `ApprovalRequest` with `status = PENDING` |
| Error codes | `NOT_FOUND`, `CONFLICT` |

#### `POST /api/actions/approval-requests/{approval_request_id}/approve`

Transitions approval from PENDING → APPROVED.

| Attribute | Value |
|---|---|
| Path param | `approval_request_id` |
| Body | `{ approver: string }` |
| Response | `ApprovalRequest` |
| Error codes | `NOT_FOUND`, `CONFLICT` (already approved or rejected) |

#### `POST /api/actions/approval-requests/{approval_request_id}/reject`

Transitions approval to REJECTED.

| Attribute | Value |
|---|---|
| Path param | `approval_request_id` |
| Body | `{ approver: string }` |
| Response | `ApprovalRequest` |
| Error codes | `NOT_FOUND` |

#### `POST /api/actions/inventory-transfer`

Executes an approved inventory transfer.

| Attribute | Value |
|---|---|
| Body | `{ approval_request_id, risk_id, option_id, source_location_id, destination_location_id, material_id, quantity }` |
| Preconditions | `approval.status == APPROVED`, approval not expired, `optionHash` unchanged, `source.available >= quantity` |
| Response | `{ transfer_request_id, status: "CREATED"\|"REJECTED", source_timestamp }` |
| Error codes | `APPROVAL_REQUIRED`, `APPROVAL_MISMATCH`, `INSUFFICIENT_INVENTORY`, `NOT_FOUND` |

#### `POST /api/actions/supplier-expedite`

Executes an approved supplier expedite request.

| Attribute | Value |
|---|---|
| Body | `{ approval_request_id, risk_id, shipment_id, requested_eta }` |
| Preconditions | `approval.status == APPROVED`, approval not expired, supplier has no active HIGH/CRITICAL constraint at execution time |
| Response | `{ expedite_request_id, status: "CREATED"\|"REJECTED", source_timestamp }` |
| Error codes | `APPROVAL_REQUIRED`, `SUPPLIER_CONSTRAINED`, `NOT_FOUND` |

#### `POST /api/actions/mark-mitigated`

Mark a risk MITIGATED for option types without a dedicated execute endpoint (WAIT, ALTERNATE_SUPPLIER, SUBSTITUTE).

| Attribute | Value |
|---|---|
| Body | `{ approval_request_id, risk_id, option_id }` |
| Preconditions | `approval.status == APPROVED`, approval not expired |
| Response | `{ risk_id, status: "MITIGATED" }` |
| Error codes | `APPROVAL_REQUIRED`, `NOT_FOUND` |

---

### 5.9 Router: `demo`

> ⚠️ **DEMO ONLY** — synthetic data. Not connected to any real operational systems.

#### `POST /api/demo/reset`

Reset in-memory store to seed state; clear idempotency keys and audit trail.

| Body | `{}` |
|---|---|
| Response | `{ message: string, demo_warning: string }` |

#### `POST /api/demo/simulate-delay`

Simulate a shipment delay and trigger LATE_DELIVERY risk detection.

| Body | `{ shipment_id, requirement_id, correlation_id? }` |
|---|---|
| Response | `{ risk_detected: boolean, risk_id, severity, correlation_id }` |

#### `GET /api/demo/audit`

Returns audit trail entries, optionally filtered by `correlation_id`.

| Query | `correlation_id` (optional) |
|---|---|
| Response | `{ trail: object[] }` |

---

### 5.10 Router: `confluent`

> ⚠️ **DEMO ONLY** — synthetic Confluent trace bridge.

#### `GET /api/confluent/trace`

Returns synthetic Kafka events for a `correlationId` across all (or filtered) TSCI topics.

| Query | `correlation_id` (required), `lookback_minutes` (1–120, default 60), `topics` (comma-separated, optional), `max_records_per_topic` (1–100, default 50) |
|---|---|
| Response | `{ correlation_id, source: "TRACE_BRIDGE", events: NormalizedEvent[], event_count, demo_warning }` |

#### `GET /api/confluent/records`

Returns synthetic records for one topic, optionally filtered by `correlation_id`.

| Query | `topic` (required), `correlation_id` (optional), `lookback_minutes` (default 30), `max_records` (1–100, default 50) |
|---|---|
| Response | `{ topic, correlation_id, source: "TRACE_BRIDGE", records: NormalizedEvent[], count, demo_warning }` |

---

## 6. wxO Tool Contracts

All tools are registered in `tsci_tools.yaml` for the IBM watsonx Orchestrate agent runtime. Tools are divided into four groups.

### 6.1 Read Tools (12 tools)

#### `list_risks`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/risks` |
| **Description** | Returns all open risk events for the current turnaround scope |
| **Input** | None |
| **Output** | `risks[]`, `total`, `source_timestamp` |
| **Errors** | — |
| **Example** | Agent calls to show active risks on the control tower dashboard |

---

#### `get_risk`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/risks/{risk_id}` |
| **Description** | Returns full RiskEvent detail including resilienceFlags and facts |
| **Input** | `risk_id: string` |
| **Output** | `risk: RiskEvent`, `source_timestamp` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent retrieves RISK-001 facts before beginning investigation |

---

#### `evaluate_mitigation_options`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/risks/{risk_id}/options` |
| **Description** | Returns deterministically ranked mitigation options. Lower totalScore = better. `near_equivalent_top_two = true` prompts agent to present both options. |
| **Input** | `risk_id: string` |
| **Output** | `ranked_options: MitigationOption[]`, `near_equivalent_top_two: boolean`, `score_version: "v1"` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent calls after `get_risk` to present the ranked recommendation |

---

#### `get_shipment`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/shipments/{shipment_id}` |
| **Description** | Returns current shipment state including `currentEta` and `portOfEntry` |
| **Input** | `shipment_id: string` |
| **Output** | `shipment: Shipment`, `source_timestamp` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent retrieves SHP-90017 to confirm the +7-day ETA delay |

---

#### `get_work_package`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/work-packages/{work_package_id}` |
| **Description** | Returns work package details and all associated material requirements |
| **Input** | `work_package_id: string` |
| **Output** | `work_package: WorkPackage`, `requirements: MaterialRequirement[]` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent retrieves TW-2047 to explain which asset and dates are at risk |

---

#### `get_inventory_options`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/inventory/options` |
| **Description** | Returns candidate transfer locations for a material shortage |
| **Input** | `material_id, destination_location_id, quantity, required_by` |
| **Output** | `candidates[]` with `transfer_feasible` flag and notes per location |
| **Errors** | `INVALID_INPUT` |
| **Example** | Agent checks REGIONAL-WH-DEMO for CVA-8842 transferable stock |

---

#### `get_supplier_options`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/suppliers/options` |
| **Description** | Returns only APPROVED, unconstrained suppliers. Constrained suppliers appear in `excludedDueToConstraint` with reason. |
| **Input** | `material_id, required_by, quantity` |
| **Output** | `candidates: Supplier[]`, `excludedDueToConstraint[]` |
| **Errors** | `INVALID_INPUT` |
| **Example** | Agent verifies SUP-205 is the only unconstrained supplier after SUP-101 and SUP-203 are blocked |

---

#### `retrieve_enterprise_knowledge`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/knowledge/retrieve` |
| **Description** | RAG retrieval from engineering, procurement, and turnaround document store. `grounded = false` if no current approved substitute evidence found. |
| **Input** | `query: string`, `filters: object`, `top_k: integer` |
| **Output** | `answer: string`, `grounded: boolean`, `confidence: number`, `evidence: Evidence[]` |
| **Errors** | `UPSTREAM_UNAVAILABLE`, `INVALID_INPUT` |
| **Example** | Agent queries "CVA-8842 approved substitute" to check for engineering evidence |

---

#### `get_resilience_profile`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/resilience/profile` |
| **Description** | Returns full SupplyChainResilienceProfile with four dimension scores. `stale = true` if `profile_age_secs > 300`. |
| **Input** | `work_package_id: string`, `material_id: string` |
| **Output** | Full profile with `readinessStatus`, `resilienceScore`, `unconstrainedApprovedSupplierCount`, `feasibleTransferLocationCount`, all 4 dimension scores |
| **Errors** | `NOT_FOUND`, `RESILIENCE_PROFILE_STALE` |
| **Example** | ResilienceMonitorAgent calls for TW-2047/CVA-8842 to answer "What is the resilience posture?" |

---

#### `get_avl_status`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/resilience/avl` |
| **Description** | Returns AVL entries for a material sorted by constraint status and tier |
| **Input** | `material_id: string` |
| **Output** | `entries[]` with `tier`, `avl_status`, `constrained`, `constraint_type`, `constraint_severity`; `unconstrained_approved_count` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent checks which suppliers are approved for CVA-8842 after SUP-205 was added to the AVL |

---

#### `get_port_status`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/resilience/port-status` |
| **Description** | Returns current port disruption status and count of impacted shipments for the material |
| **Input** | `port_code: string`, `material_id: string?` |
| **Output** | `disruption_type`, `severity`, `estimated_clear_date`, `impacted_shipment_count` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent queries SGSIN to confirm port congestion is affecting SHP-90017 routing |

---

#### `get_supplier_resilience_status`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/resilience/supplier-status` |
| **Description** | Returns live constraint state (ACTIVE or CLEARED) for a supplier. Used by ProcurementAgent and ResilienceMonitorAgent. |
| **Input** | `supplier_id: string`, `material_id: string?` |
| **Output** | `status: "ACTIVE"\|"CLEARED"`, `constraint_type`, `constraint_severity`, `source_event_id` |
| **Errors** | `NOT_FOUND` |
| **Example** | Agent checks whether SUP-101 QUALITY_HOLD is still active before recommending EXPEDITE |

---

### 6.2 Write Tools (8 tools)

> All write tools require a prior `APPROVED` ApprovalRequest. Approval ID and option hash are validated before any state mutation.

#### `request_mitigation_approval`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/approval-requests` |
| **Description** | Creates PENDING approval request. Computes SHA-256 option hash for immutability. Expires in 24 hours. |
| **Input** | `risk_id, option_id, recommendation_summary` |
| **Output** | `ApprovalRequest` (status=PENDING, optionHash, expiry) |
| **Errors** | `NOT_FOUND`, `CONFLICT` |
| **Example** | Agent creates approval for TRANSFER option before presenting to human reviewer |

---

#### `approve_mitigation`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/approval-requests/{id}/approve` |
| **Description** | Transitions PENDING → APPROVED. Records approver identity and timestamp. |
| **Input** | `approval_request_id, approver: string` |
| **Output** | `ApprovalRequest` (status=APPROVED) |
| **Errors** | `NOT_FOUND`, `CONFLICT` |
| **Example** | Human turnaround planner approves the stock transfer for CVA-8842 |

---

#### `reject_mitigation`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/approval-requests/{id}/reject` |
| **Description** | Transitions approval to REJECTED. No write action may proceed. |
| **Input** | `approval_request_id, approver: string` |
| **Output** | `ApprovalRequest` (status=REJECTED) |
| **Errors** | `NOT_FOUND` |
| **Example** | Reviewer rejects EXPEDITE because supplier still has an unresolved QUALITY_HOLD |

---

#### `execute_inventory_transfer`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/inventory-transfer` |
| **Description** | Moves stock from source to destination location. Validates approval, expiry, hash, and inventory. |
| **Input** | `approval_request_id, risk_id, option_id, source_location_id, destination_location_id, material_id, quantity` |
| **Output** | `transfer_request_id, status` |
| **Errors** | `APPROVAL_REQUIRED`, `APPROVAL_MISMATCH`, `INSUFFICIENT_INVENTORY`, `NOT_FOUND` |
| **Example** | Agent executes TRANSFER of 1 × CVA-8842 from REGIONAL-WH-DEMO to PEARL-DEMO |

---

#### `execute_supplier_expedite`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/supplier-expedite` |
| **Description** | Sends expedite request to supplier for a shipment. Blocked if supplier constraint still ACTIVE at execution time. |
| **Input** | `approval_request_id, risk_id, shipment_id, requested_eta` |
| **Output** | `expedite_request_id, status` |
| **Errors** | `APPROVAL_REQUIRED`, `SUPPLIER_CONSTRAINED`, `NOT_FOUND` |
| **Example** | Agent expedites SHP-90017 to request Oct 8 ETA from SUP-205 |

---

#### `mark_mitigated`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/actions/mark-mitigated` |
| **Description** | Marks risk MITIGATED for WAIT, ALTERNATE_SUPPLIER, or SUBSTITUTE options after approval. |
| **Input** | `approval_request_id, risk_id, option_id` |
| **Output** | `{ risk_id, status: "MITIGATED" }` |
| **Errors** | `APPROVAL_REQUIRED`, `NOT_FOUND` |
| **Example** | Agent closes RISK-001 as MITIGATED after alternate supplier SUP-205 confirms order |

---

#### `upsert_supplier_constraint`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/resilience/supplier-constraint` |
| **Description** | Ingest supplier constraint event from Kafka consumer or demo loop. Triggers resilience profile recomputation. |
| **Input** | `supplier_id, material_id, constraint_type, constraint_severity, affected_from_date, estimated_resolution_date, source_reference, notes, event_id, correlation_id` |
| **Output** | `{ updated: boolean, supplier_id, constraint_type, constraint_severity }` |
| **Errors** | `INVALID_INPUT` |
| **Example** | Demo loop calls to inject SUP-101 QUALITY_HOLD/CRITICAL for CVA-8842 |

---

#### `upsert_port_disruption`

| Attribute | Value |
|---|---|
| **Endpoint** | `POST /api/resilience/port-disruption` |
| **Description** | Ingest port disruption event from Kafka consumer or demo loop. Updates port status in store. |
| **Input** | `port_code, port_name, disruption_type, severity, affected_from_date, estimated_clear_date, impacted_shipment_ids, affected_logistics_providers, event_id, correlation_id` |
| **Output** | `{ updated: boolean, port_code, disruption_type, severity }` |
| **Errors** | `INVALID_INPUT` |
| **Example** | Demo loop calls to inject SGSIN CONGESTION/HIGH event |

---

### 6.3 Demo/Confluent Tools (2 tools)

#### `get_confluent_records`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/confluent/records` |
| **Description** | Returns synthetic Kafka records for one topic. Used by TraceBridgeReader.recent_records(). |
| **Input** | `topic: string`, `correlation_id?: string`, `lookback_minutes: integer`, `max_records: integer` |
| **Output** | `{ topic, records: NormalizedEvent[], count, demo_warning }` |
| **Errors** | `INVALID_INPUT` |

#### `get_confluent_trace`

| Attribute | Value |
|---|---|
| **Endpoint** | `GET /api/confluent/trace` |
| **Description** | Returns synthetic Kafka events across all TSCI topics for a correlationId. Used by TraceBridgeReader.trace_by_correlation(). |
| **Input** | `correlation_id: string`, `lookback_minutes: integer`, `topics?: string`, `max_records_per_topic: integer` |
| **Output** | `{ correlation_id, source: "TRACE_BRIDGE", events: NormalizedEvent[], event_count, demo_warning }` |
| **Errors** | `INVALID_INPUT` |

---

## 7. Approval Lifecycle State Machine

The approval lifecycle enforces human-in-the-loop control for all write operations.

```
                 POST /approval-requests
                        │
                        ▼
                    [PENDING]
                    │       │
    POST /approve   │       │  POST /reject
                    ▼       ▼
               [APPROVED] [REJECTED]
                    │
            (24h from creation)
                    │
                [EXPIRED*]

* EXPIRED is an implied state when approval.expiry < datetime.now(UTC)
  No explicit state transition — checked at execution time.
```

### State Rules

| State | Allowed Transitions | Who |
|---|---|---|
| PENDING | → APPROVED | Human (via `approve_mitigation`) |
| PENDING | → REJECTED | Human (via `reject_mitigation`) |
| APPROVED | → (none, immutable) | — |
| REJECTED | → (none, immutable) | — |

### Pre-execution Validation

Before `execute_inventory_transfer`, `execute_supplier_expedite`, or `mark_mitigated`, the following checks run in order:

1. `approval_request_id` exists in store → else `NOT_FOUND`
2. `approval.status == APPROVED` → else `APPROVAL_REQUIRED`
3. `approval.expiry > datetime.now(UTC)` → else `APPROVAL_REQUIRED` (expired)
4. `SHA-256(current_option) == approval.option_hash` → else `APPROVAL_MISMATCH`

### Option Hash

The `optionHash` is computed at `POST /approval-requests` from a deterministic snapshot of the MitigationOption excluding `optionId` and `riskId`. Fields included:

`type`, `feasible`, `scheduleRiskScore`, `technicalRiskScore`, `supplyRiskScore`, `totalScore`, `constraints`, `evidenceIds`

If any of these fields change between approval creation and execution, the hash will mismatch and execution is blocked with `APPROVAL_MISMATCH`.

---

## 8. Rate Limiting and Timeout Policy

| Policy | Value |
|---|---|
| **API rate limit** | No rate limiting enforced in demo mode |
| **RAG query timeout** | 15 seconds — returns `UPSTREAM_UNAVAILABLE` if exceeded |
| **Resilience profile recomputation** | Synchronous; triggered on every contributing event arrival |
| **Stale profile threshold** | 300 seconds (`profile_age_secs > 300` → `stale = true`; `RESILIENCE_PROFILE_STALE` error on critical operations) |
| **Approval expiry** | 24 hours from `ApprovalRequest.createdAt` — expired approvals cannot be used for execution |
| **Idempotency store TTL** | 48 hours — `eventId` entries older than 48h are eligible for eviction |

---

## 9. Change History

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2025-01 | Build Lab | Initial YAML spec — tool contracts, error model, approval lifecycle |
| 1.1 | 2025-01 | Build Lab | Added resilience tools (get_resilience_profile, get_avl_status, get_port_status, get_supplier_resilience_status, upsert_supplier_constraint, upsert_port_disruption), RESILIENCE_PROFILE_STALE error code, staleness policy |
| 2.0 | 2025-01 | Build Lab | Converted to Markdown; full endpoint catalogue for all 10 routers; full wxO tool contracts for all 22 tools; approval state machine diagram; rate limiting and timeout policy |
