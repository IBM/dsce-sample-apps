# Security, Observability, and Non-Functional Requirements Specification

**Spec:** 08_SECURITY_OBSERVABILITY_NFR.md  
**Version:** 2.0  
**Status:** Approved  
**Classification:** SYNTHETIC DEMO — not real Shell or Pearl GTL operational data

---

## 1. Purpose

This specification defines the security model, approval enforcement, audit trail, observability stack, error-handling patterns, and non-functional requirements (NFRs) for the Turnaround Supply Chain Intelligence (TSCI) solution. All requirements in this document apply across the backend, the wxO agent layer, the RAG service, and the UI.

---

## 2. Security Principles

The TSCI system follows these foundational security principles:

| Principle | Description |
|---|---|
| **Least Privilege** | Every component (agent, service account, tool) receives only the permissions required for its function. Read-only components never hold write credentials. |
| **No Secrets in Code** | API keys, passwords, tokens, and connection strings MUST NOT be committed to source control. All secrets are loaded from environment variables or a secrets manager at runtime. |
| **Separate Read/Write Credentials** | Read operations (tool calls, UI API reads) and write operations (approval execution, inventory transfer, supplier expedite) use separate service identities with separately scoped credentials. |
| **Approval Gate Before Any Mutation** | No state-changing operation executes without an `APPROVED` `ApprovalRequest` record. The approval record includes a hash of the option at approval time; any mutation of the option invalidates the approval. |
| **Demo Isolation** | All transactions, data, and financial values are synthetic. No TSCI component holds credentials to real Shell operational systems. |
| **Immutable Audit** | The audit trail is append-only. No existing audit record may be modified or deleted by any runtime component. |

---

## 3. Identity and Access Model

### 3.1 Service Accounts

| Identity | Scope | Permissions |
|---|---|---|
| `tsci-backend-read` | Backend API, tool read endpoints | Read: risks, shipments, inventory, work packages, resilience profiles, AVL |
| `tsci-backend-write` | Backend API, write endpoints only | Write: approval-requests, inventory-transfer, supplier-expedite, mark-mitigated |
| `tsci-wxo-agent` | wxO platform | Call read tools; call `request_mitigation_approval`; CANNOT directly call `execute_*` tools |
| `tsci-confluent-consumer` | Confluent Cloud | Consume: `supply.*` and `turnaround.*` topics; no produce permissions |
| `tsci-confluent-producer` | Confluent Cloud | Produce: `supply.risk.detected`, `supply.material.readiness.assessed` only |
| `tsci-opensearch-read` | OpenSearch / in-memory fallback | Index reads: `enterprise-knowledge-v1`; no write to knowledge index |
| `tsci-opensearch-audit` | OpenSearch audit index | Write: `rag-query-audit-v1` only; no read of knowledge index |

### 3.2 API Keys and Environment Variables

All secrets are loaded exclusively from environment variables. The following are defined in `.env` files (never committed; template in `.env.example`):

| Variable | Service | Classification |
|---|---|---|
| `KAFKA_API_KEY` / `KAFKA_API_SECRET` | Confluent Cloud | SECRET |
| `SCHEMA_REGISTRY_API_KEY` / `SCHEMA_REGISTRY_API_SECRET` | Schema Registry | SECRET |
| `OPENSEARCH_URL` / `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD` | OpenSearch | SECRET |
| `WXO_API_KEY` | watsonx Orchestrate | SECRET |
| `WXO_BASE_URL` | watsonx Orchestrate | INTERNAL |
| `BACKEND_API_KEY` | Backend internal auth | SECRET |
| `VITE_WXO_API_KEY` | UI (build-time) | SECRET (not committed) |

### 3.3 wxO Tool Scoping

Write tools are assigned exclusively to the primary agent. Collaborator agents are scoped to read-only tools:

| Tool Category | Assigned To |
|---|---|
| `request_mitigation_approval` | Primary agent only |
| `execute_inventory_transfer` | Primary agent only |
| `execute_supplier_expedite` | Primary agent only |
| All read tools | Respective collaborator agents |

---

## 4. Approval Enforcement

### 4.1 Approval Record Fields

Every `ApprovalRequest` MUST contain:

| Field | Type | Description |
|---|---|---|
| `approval_request_id` | UUID | Unique identifier |
| `risk_id` | string | Risk this approval covers |
| `option_id` | string | Mitigation option this approval covers |
| `option_snapshot_hash` | string | SHA-256 of the JSON-serialised option at time of approval |
| `recommendation_summary` | string | Human-readable summary shown to approver |
| `approver` | string | Name/ID of human who approved |
| `approved_at` | ISO-8601 datetime | Timestamp of approval action |
| `expiry` | ISO-8601 datetime | `approved_at + 24 hours` |
| `status` | enum | `PENDING` → `APPROVED` / `REJECTED` / `EXPIRED` |
| `created_at` | ISO-8601 datetime | Timestamp of creation |

### 4.2 Status Transition Rules

```
PENDING  →  APPROVED  (human approves via UI)
PENDING  →  REJECTED  (human rejects via UI)
APPROVED →  EXPIRED   (system: approved_at + 24h elapsed without execution)
APPROVED →  (execution completes; risk moves to MITIGATED)
```

No status transition is permitted outside these rules. Any API call attempting an invalid transition returns `HTTP 409 Conflict`.

### 4.3 Hash Integrity Check

At execution time, the backend MUST re-compute the option hash and compare it to `option_snapshot_hash`:

```python
import hashlib, json

def verify_option_integrity(stored_hash: str, current_option: dict) -> None:
    current_hash = hashlib.sha256(
        json.dumps(current_option, sort_keys=True).encode()
    ).hexdigest()
    if current_hash != stored_hash:
        raise IntegrityError(
            "Option has changed since approval — re-approval required"
        )
```

If the hash does not match, the execution endpoint returns `HTTP 409 Conflict` with error code `OPTION_MUTATED_SINCE_APPROVAL`.

### 4.4 Expiry Check

At execution time, before any write action, the backend MUST verify:

```python
if approval_request.status != "APPROVED":
    raise ValidationError("Approval not in APPROVED state")
if datetime.utcnow() > approval_request.expiry:
    approval_request.status = "EXPIRED"
    raise ValidationError("Approval has expired — raise a new approval request")
```

---

## 5. Audit Trail Requirements

### 5.1 Append-Only Requirement

The audit trail MUST be append-only. No audit record may be deleted or modified by any runtime component. In the demo, the audit trail is stored in memory and optionally written to a log file; in production it would be written to an immutable log store.

### 5.2 Audit Record Sequence

For every end-to-end risk scenario, the following records MUST be present in the audit trail in order:

| Step | Record Type | Required Fields |
|---|---|---|
| 1 | `SOURCE_EVENT` | `correlationId`, `eventType`, `topicName`, `eventKey`, `eventTimestamp` |
| 2 | `RISK_CREATED` | `correlationId`, `riskId`, `severity`, `materialId`, `workPackageId`, `detectedAt` |
| 3 | `TOOL_CALL` | `correlationId`, `riskId`, `agentName`, `toolName`, `toolInput`, `toolOutput`, `calledAt` |
| 4 | `EVIDENCE_RETRIEVED` | `correlationId`, `riskId`, `queryId`, `evidenceIds[]`, `grounded`, `confidence` |
| 5 | `RECOMMENDATION_GENERATED` | `correlationId`, `riskId`, `optionId`, `chosenOption`, `scoreBreakdown`, `generatedAt` |
| 6 | `APPROVAL_REQUESTED` | `correlationId`, `riskId`, `approvalRequestId`, `optionId`, `optionSnapshotHash`, `createdAt` |
| 7 | `APPROVAL_DECISION` | `correlationId`, `riskId`, `approvalRequestId`, `status`, `approver`, `decidedAt` |
| 8 | `ACTION_EXECUTED` | `correlationId`, `riskId`, `approvalRequestId`, `actionType`, `actionId`, `executedAt`, `result` |
| 9 | `RISK_STATUS_CHANGE` | `correlationId`, `riskId`, `fromStatus`, `toStatus`, `updatedAt` |

### 5.3 Correlation ID Propagation

Every component that handles a request MUST propagate the `correlationId`:

- Backend routes: read `x-correlation-id` request header; include in all log lines and downstream calls
- Tool calls: include `correlationId` in tool call payload where supported
- Kafka events: include `correlationId` in event header and payload
- RAG queries: include `correlationId` in `rag-query-audit-v1` record

---

## 6. Data Safety

| Rule | Description |
|---|---|
| DS-01 | All demo data is synthetic. No real Shell, Pearl GTL, or supplier operational data is used |
| DS-02 | No secrets (API keys, passwords, tokens) are logged at any level |
| DS-03 | No real supplier contact information (email, phone, personnel names) appears in sample data |
| DS-04 | Document classification metadata (`classification` field) is preserved through all indexing, retrieval, and response pipelines |
| DS-05 | Demo data is labelled with `SYNTHETIC-DEMO` in all `sourceSystem` fields |
| DS-06 | UI surfaces a "SYNTHETIC DATA ONLY" warning on all demo-data-bearing views |

---

## 7. Observability Stack

### 7.1 Structured Logging

All backend components emit structured JSON logs. Every log line MUST include:

| Field | Description |
|---|---|
| `timestamp` | ISO-8601 |
| `level` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `correlationId` | Propagated from request context; `null` if no request context |
| `riskId` | Present when log relates to a specific risk |
| `traceId` | Present when distributed tracing is enabled |
| `component` | Service or module name (e.g., `rag-service`, `risk-api`, `approval-service`) |
| `message` | Human-readable log message |
| `extra` | Optional structured payload (tool name, event type, etc.) |

Example:
```json
{
  "timestamp": "2025-01-15T10:23:45.123Z",
  "level": "INFO",
  "correlationId": "CORR-8842-01",
  "riskId": "RISK-0001",
  "traceId": "abc123def456",
  "component": "rag-service",
  "message": "RAG query completed",
  "extra": { "queryId": "q-...", "grounded": true, "confidence": 0.87, "chunks_returned": 3 }
}
```

### 7.2 Metrics Catalogue

All 15 metrics below MUST be emitted as structured log entries and, where a metrics backend is configured, as counters or histograms:

| Metric Name | Type | Description | Labels |
|---|---|---|---|
| `events_consumed_total` | Counter | Total Kafka events consumed | `topic`, `event_type` |
| `events_failed_total` | Counter | Events that failed validation or processing | `topic`, `failure_reason` |
| `risks_detected_total` | Counter | Risks created from events | `severity`, `risk_type` |
| `risk_detection_latency_ms` | Histogram | Time from event ingestion to risk creation | `risk_type` |
| `rag_requests_total` | Counter | Total RAG retrieval calls | `grounded`, `fallback_mode` |
| `rag_no_answer_total` | Counter | RAG calls returning `grounded: false` | `reason` |
| `rag_latency_ms` | Histogram | End-to-end RAG pipeline duration | `retrieval_mode` |
| `tool_calls_total` | Counter | Agent tool calls | `tool_name`, `agent_name` |
| `tool_errors_total` | Counter | Tool calls that returned an error | `tool_name`, `error_type` |
| `recommendations_generated_total` | Counter | Scored recommendation sets produced | `option_count` |
| `approvals_requested_total` | Counter | Approval requests created | — |
| `approvals_decided_total` | Counter | Approval decisions made | `decision` (APPROVED / REJECTED) |
| `actions_executed_total` | Counter | Write actions executed | `action_type` |
| `action_failures_total` | Counter | Write actions that failed | `action_type`, `failure_reason` |
| `resilience_profile_stale_total` | Counter | Resilience profiles flagged as stale at recommendation/action time | `material_id` |

---

## 8. Error Handling Patterns

### 8.1 Idempotency

All event processing MUST be idempotent. The same Kafka event processed twice MUST produce the same state as processing it once:

- Event deduplication by `eventId` (store processed event IDs for configurable window)
- Risk creation: upsert by `correlationId`; do not create duplicate risks for the same correlation
- Approval actions: idempotent by `approval_request_id`

### 8.2 Exponential Retry

For transient failures calling external systems (OpenSearch, wxO API, Confluent REST), apply exponential back-off:

```python
retry_delays = [1, 2, 4, 8, 16]  # seconds
max_retries  = 5
jitter       = random(0, 0.5)    # seconds
```

Log each retry attempt with `correlationId`, `attempt_number`, and `target_service`.

### 8.3 Circuit Breaker

For calls to external services that experience sustained failure:

| Parameter | Value |
|---|---|
| Failure threshold | 5 consecutive failures in 60 seconds |
| Open duration | 30 seconds |
| Half-open probe | 1 request; if succeeds, close circuit |
| Affected services | OpenSearch, wxO API, Confluent REST Proxy |

When a circuit is open:
- Log `WARNING: CIRCUIT_OPEN service={service_name}`
- RAG service falls back to in-memory index
- Resilience profile calls return cached profile with `stale: true` flag

### 8.4 Dead Letter Queue (DLQ)

Kafka events that fail processing after `max_retries` are sent to the DLQ topic:

| Parameter | Value |
|---|---|
| DLQ topic name | `supply.dlq.v1` |
| DLQ record includes | Original event, failure reason, attempt count, last error, timestamp |
| DLQ consumer | Manual review; alerts on accumulation > 10 records |

### 8.5 Stale Data Detection

The resilience profile staleness threshold is **300 seconds**. At recommendation or action time:

```python
RESILIENCE_PROFILE_STALE_THRESHOLD_SECS = 300

def check_profile_freshness(profile_age_secs: int) -> None:
    if profile_age_secs > RESILIENCE_PROFILE_STALE_THRESHOLD_SECS:
        log.warning("RESILIENCE_PROFILE_STALE", extra={
            "profile_age_secs": profile_age_secs,
            "threshold_secs": RESILIENCE_PROFILE_STALE_THRESHOLD_SECS
        })
        # Do NOT block execution; surface warning to user via API response
```

The `profile_age_secs` field is included in all resilience profile API responses so the UI can display the warning.

---

## 9. Non-Functional Requirements

| ID | Category | Requirement | Target | Verification |
|---|---|---|---|---|
| NFR-001 | Traceability | Every risk must have a `correlationId` and source event ID in its record | 100% | Integration test: every risk returned by `GET /api/risks` has non-null `correlationId` |
| NFR-002 | Explainability | Every recommendation includes facts, evidence IDs, score breakdown, and constraint reasons | 100% | Response schema validation |
| NFR-003 | Reliability | Event processing is idempotent; same event processed twice produces same state | 100% | Unit test: feed duplicate event; verify single risk created |
| NFR-004 | Security | Write tools have separate credentials from read tools; no write action executes without APPROVED approval | 100% | Security test: call write endpoint without approval; verify 403 |
| NFR-005 | Grounding | Engineering substitution claims require `grounded: true` with evidence from corpus | 100% | RAG eval dataset: GR-01 rule verified |
| NFR-006 | Safe Failure | Missing or conflicting evidence produces `grounded: false` and escalation; no fabricated answer | 100% | RAG eval: no-answer precision = 1.00 |
| NFR-007 | Observability | All components emit structured JSON logs with `correlationId`, `riskId`, `component` | 100% | Log format validation in CI |
| NFR-008 | Testability | All external system dependencies (Confluent, OpenSearch, wxO) can be simulated by demo endpoints | ✓ | Demo reset + simulate endpoints exist and are tested |
| NFR-009 | Portability | All configuration (URLs, credentials, feature flags) is externalized to environment variables | 100% | Grep for hardcoded URLs/secrets in source; zero matches |
| NFR-010 | Demo Isolation | All demo company-specific transactions and operational values are synthetic; clearly labelled | 100% | UI: SYNTHETIC DATA badge; data: `sourceSystem = SYNTHETIC-DEMO` |
| NFR-011 | Resilience Latency | `SupplyChainResilienceProfile` is updated within the event processing pipeline; staleness flagged if > 300s | ≤ 300s | Integration test: inject supplier-status event; measure profile update latency |
| NFR-012 | AVL Correctness | Supplier feasibility evaluated against current AVL; last AVL event timestamp recorded in profile | 100% | Integration test: inject AVL change; verify `avl_last_updated_at` in profile response |

---

## 10. Compliance and Demo Isolation Requirements

| Requirement | Description |
|---|---|
| CI-01 | No real Shell, Pearl GTL, or partner operational data appears anywhere in the demo codebase or data fixtures |
| CI-02 | All demo supplier names (SupplierCo A, SupplierCo B, ValveTech Ltd) are synthetic; not real company names |
| CI-03 | All financial values (costs, contract amounts) are synthetic and clearly labelled |
| CI-04 | The demo system MUST NOT be connected to any real procurement, ERP, or operational technology (OT) system |
| CI-05 | Demo reset endpoint (`POST /api/demo/reset`) must fully restore the system to baseline state without residual data from previous runs |
| CI-06 | All Confluent topics used by the demo have the `SYNTHETIC-DEMO` tag in their description; topic names prefixed with `supply.`, `turnaround.`, or `crag.` for isolation |

---

## 11. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-SEC-01 | Write endpoints return 403 if called without valid `APPROVED` ApprovalRequest | Integration test |
| AC-SEC-02 | SHA-256 hash mismatch at execution returns 409 with `OPTION_MUTATED_SINCE_APPROVAL` | Unit test |
| AC-SEC-03 | Expired approval (> 24h) is rejected with `APPROVAL_EXPIRED` error | Unit test: back-date expiry |
| AC-SEC-04 | No API key, password, or token appears in any structured log line | Log audit: grep for secret patterns |
| AC-SEC-05 | `rag-query-audit-v1` receives one entry per RAG call with `correlationId` | Integration test |
| AC-SEC-06 | All 15 metrics are emitted during a full end-to-end demo run | Metrics validation test |
| AC-SEC-07 | Duplicate Kafka event produces a single risk, not two | Idempotency unit test |
| AC-SEC-08 | Stale profile warning (`profileAgeSecs > 300`) propagates from API to UI | Integration + UI test |
| AC-SEC-09 | Demo reset restores baseline state; subsequent simulate produces a fresh risk | E2E test: reset → simulate → verify single risk |
| AC-SEC-10 | DLQ receives event after 5 failed processing attempts | Unit test: mock 5 consecutive failures |
