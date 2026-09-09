# SPEC: wxO Direct Confluent Event Intelligence

**Spec ID:** TSCI-WXO-CONFLUENT-002  
**Version:** 1.0  
**Status:** Implementation Ready  
**Applies to:** Turnaround Supply Chain Intelligence (TSCI) demo  
**Primary component:** `confluent_intelligence_agent`  
**Data classification:** SYNTHETIC DEMONSTRATION DATA ONLY

---

## 1. Objective

Enhance the existing TSCI watsonx Orchestrate (wxO) solution so the `confluent_intelligence_agent` can retrieve selected Kafka/Confluent evidence **directly from Confluent Cloud on demand**, while preserving the existing TSCI event-trace bridge as an automatic fallback.

The agent must be able to answer questions such as:

- What Confluent events caused this risk?
- Show the event sequence for this `correlationId`.
- Which topic produced the CRITICAL risk?
- What shipment/inventory/material events were observed before `supply.risk.detected`?
- Is the relevant Kafka topic available and healthy?
- What did Flink derive from the source events?

This capability is for **interactive evidence retrieval**, not continuous stream processing.

---

## 2. Business Outcome

The demo must visibly prove the following division of responsibilities:

```text
Operational Systems
      |
      v
Confluent Cloud
      |
      +--> Kafka source events
      |
      v
Flink SQL
      |
      v
supply.risk.detected
      |
      +-------------------------> FastAPI business state
      |                              |
      |                              v
      |                         wxO business tools
      |
      +-------------------------> wxO Confluent Intelligence Agent
                                     |
                                     +--> direct event evidence when supported
                                     +--> trace-bridge evidence as fallback
```

**Confluent answers:** what happened and in what event sequence?  
**FastAPI answers:** what is the current business state?  
**wxO answers:** why it matters and what should be done next?

---

## 3. Existing State

The package currently contains:

- `wxo/agents/confluent_intelligence_agent.yaml`
- `wxo/agents/tsci_primary_agent.yaml`
- `wxo/tools/confluent_tools.py`
- Direct Confluent metadata tools:
  - `get_confluent_cluster_details`
  - `list_confluent_topics`
  - `get_confluent_topic_details`
  - `get_confluent_topic_partitions`
  - `get_confluent_topic_config`
- Backend trace tool:
  - `get_confluent_event_trace`
- Long-running event trace consumer:
  - `confluent/python/consumers/consume_event_trace.py`
- wxO connections:
  - `confluent_kafka`
  - `tsci_backend`

Current event payload retrieval comes through the trace bridge. This spec adds a direct Confluent read path and makes the bridge the fallback path.

---

## 4. Target Behavior

### 4.1 Source preference

For an event-evidence request, use this order:

```text
1. DIRECT_CONFLUENT
       |
       | success
       v
   return evidence
       |
       | unsupported / unreachable / auth failure / timeout
       v
2. TRACE_BRIDGE
       |
       | success
       v
   return fallback evidence
       |
       | failure
       v
3. Return structured DATA_UNAVAILABLE response
```

### 4.2 Operating modes

Support an environment/configuration setting:

```text
CONFLUENT_READ_MODE=auto|direct|trace
```

Behavior:

- `auto`: try direct first; fallback to trace bridge.
- `direct`: direct Confluent only; never silently return trace data.
- `trace`: use existing trace bridge only.

Default MUST be:

```text
CONFLUENT_READ_MODE=auto
```

### 4.3 Direct-read compatibility gate

Before implementing hard-coded record-consumption behavior, perform a runtime compatibility probe against the configured Confluent cluster REST endpoint.

Reason: current Confluent Cloud documentation describes Kafka REST as supporting produce/consume over HTTPS, while publicly documented endpoint coverage and deployment variants can differ. The implementation MUST NOT assume that a particular stateful consumer endpoint is exposed by every tenant/cluster/runtime.

The probe MUST determine:

1. REST endpoint is reachable.
2. credentials authenticate.
3. configured cluster is visible.
4. required topics are visible.
5. a supported on-demand record-consumption mechanism is available.
6. returned payload encoding can be normalized by the wxO tool.

If item 5 or 6 fails, `auto` mode MUST use the trace bridge.

The compatibility result SHOULD be cached for 5 minutes to avoid repeating discovery on every agent turn.

---

## 5. Architecture Constraints

### MUST

- wxO direct Confluent access is **read-only**.
- No topic creation, deletion, alteration, or produce operation may be exposed to the Confluent agent.
- Do not use wxO as a permanent Kafka consumer.
- Do not maintain a long-running consumer loop inside an interactive wxO tool.
- Every direct event read must be bounded by time, topic allowlist, and record count.
- Every returned event must include source provenance.
- Preserve the existing trace bridge as fallback.
- Correlation ID remains the primary cross-system trace key.
- The agent must never fabricate missing events, offsets, partitions, timestamps, or Flink results.

### MUST NOT

- Poll Kafka continuously from wxO.
- Execute inventory/procurement actions from the Confluent agent.
- Give the Confluent service account WRITE/ALTER/DELETE privileges.
- Search arbitrary topics supplied by the user unless present in the configured allowlist.
- Return credentials, secrets, SASL strings, or Authorization headers in tool output.
- Describe fallback data as "directly read from Confluent".

---

## 6. Allowed Topics

Default allowlist:

```text
turnaround.material.required
supply.inventory.changed
supply.shipment.updated
supply.supplier.status.changed
supply.port.status.changed
supply.approved_vendor.changed
supply.risk.detected
supply.material.readiness.assessed
supply.action.completed
```

Configuration:

```text
CONFLUENT_ALLOWED_TOPICS=<comma-separated-list>
```

The implementation MUST reject any topic outside this allowlist.

---

## 7. wxO Connections

### 7.1 Direct Confluent connection

Connection name:

```text
confluent_kafka
```

Connection type:

```text
BASIC_AUTH
```

Values:

```text
url      = Confluent per-cluster REST endpoint
username = Kafka API key / service-account key
password = Kafka API secret
```

Python tools must obtain credentials at runtime through the wxO connection mechanism already used by `confluent_tools.py`.

### 7.2 Backend fallback connection

Connection name:

```text
tsci_backend
```

Purpose:

- call existing event-trace endpoint
- retrieve fallback event evidence
- do not duplicate backend API keys in Confluent connection

---

## 8. Security Requirements

Create a dedicated Confluent service account for wxO.

Required permissions must be minimum necessary:

- DESCRIBE cluster/topic metadata as needed.
- READ only on the allowed TSCI topics.
- If the supported direct-consume mechanism requires a consumer group, authorize only a dedicated prefix such as:

```text
wxo-tsci-*
```

Do not grant:

```text
WRITE
CREATE
DELETE
ALTER
ALTER_CONFIGS
```

for TSCI topics through the wxO service account.

The direct tool must redact:

- API key
- API secret
- Authorization header
- connection URL credentials, if ever embedded

from exceptions/logs/tool responses.

---

## 9. New/Changed Tool Contracts

Modify:

```text
wxo/tools/confluent_tools.py
```

### 9.1 `check_confluent_direct_read_capability`

```python
check_confluent_direct_read_capability() -> dict
```

Purpose:

- verify cluster connectivity
- verify allowed topic visibility
- determine whether direct bounded record retrieval is usable

Response:

```json
{
  "available": true,
  "mode": "DIRECT_CONFLUENT",
  "cluster_id": "lkc-...",
  "record_read_supported": true,
  "checked_at": "ISO-8601",
  "reason": null
}
```

Failure/unsupported example:

```json
{
  "available": false,
  "mode": "TRACE_BRIDGE_REQUIRED",
  "cluster_id": "lkc-...",
  "record_read_supported": false,
  "checked_at": "ISO-8601",
  "reason": "Direct record consumption not available through configured endpoint"
}
```

---

### 9.2 `get_confluent_recent_records`

```python
get_confluent_recent_records(
    topic_name: str,
    correlation_id: str | None = None,
    lookback_minutes: int = 30,
    max_records: int = 50,
) -> dict
```

Constraints:

```text
1 <= lookback_minutes <= 120
1 <= max_records <= 100
```

Requirements:

- topic must be allowlisted
- bounded read only
- no infinite poll
- if `correlation_id` is supplied, return only matching records
- decode JSON payload where possible
- if value is binary/unknown, return safe metadata and a decoding-status field; do not hallucinate the payload

Normalized response:

```json
{
  "source": "DIRECT_CONFLUENT",
  "topic": "supply.shipment.updated",
  "correlation_id": "DEMO-TW2047-001",
  "records": [
    {
      "topic": "supply.shipment.updated",
      "partition": 0,
      "offset": 46,
      "timestamp": "ISO-8601",
      "key": "SHP-90017",
      "correlation_id": "DEMO-TW2047-001",
      "event_type": "SHIPMENT_UPDATED",
      "value": {},
      "decode_status": "DECODED"
    }
  ],
  "count": 1,
  "truncated": false
}
```

---

### 9.3 `get_confluent_event_trace`

Replace/extend the existing tool contract so it becomes the **single agent-facing event trace tool**.

```python
get_confluent_event_trace(
    correlation_id: str,
    topics: list[str] | None = None,
    lookback_minutes: int = 60,
    max_records_per_topic: int = 50,
) -> dict
```

Behavior in `auto` mode:

```text
call direct-read capability
      |
      +--> supported -> fetch direct from allowed topics
      |                    |
      |                    +--> successful -> source=DIRECT_CONFLUENT
      |                    |
      |                    +--> runtime failure -> fallback
      |
      +--> unsupported -> fallback
                           |
                           v
                    existing TSCI trace API
                           |
                           v
                    source=TRACE_BRIDGE
```

Response:

```json
{
  "correlation_id": "DEMO-TW2047-001",
  "source": "DIRECT_CONFLUENT",
  "fallback_used": false,
  "events": [],
  "event_count": 6,
  "topics_checked": [],
  "warnings": []
}
```

Fallback example:

```json
{
  "correlation_id": "DEMO-TW2047-001",
  "source": "TRACE_BRIDGE",
  "fallback_used": true,
  "events": [],
  "warnings": [
    "Direct Confluent record retrieval was unavailable; evidence came from the TSCI Kafka trace bridge."
  ]
}
```

---

### 9.4 `get_confluent_risk_evidence`

```python
get_confluent_risk_evidence(
    correlation_id: str,
    risk_id: str | None = None,
) -> dict
```

Purpose:

Return a concise event chain specifically for the risk-investigation workflow.

Expected ordering:

```text
turnaround.material.required
        ->
supply.inventory.changed
        ->
supply.supplier.status.changed / supply.port.status.changed (when present)
        ->
supply.shipment.updated
        ->
supply.risk.detected
        ->
supply.material.readiness.assessed (when present)
```

The tool must preserve actual Kafka timestamp/partition/offset evidence and must not manufacture missing links.

---

## 10. Direct Read Adapter Design

Implement direct access behind an internal adapter interface so agent/tool contracts are independent of the specific Confluent REST consumption mechanism.

Suggested structure:

```text
wxo/tools/
  confluent_tools.py
  confluent_readers/
      __init__.py
      base.py
      kafka_rest_reader.py
      trace_bridge_reader.py
```

Interface:

```python
class ConfluentEventReader:
    def capability(self) -> dict: ...
    def recent_records(...) -> list[dict]: ...
    def trace_by_correlation(...) -> list[dict]: ...
```

### `kafka_rest_reader.py`

Responsibilities:

- authenticate through `confluent_kafka`
- perform the compatibility probe
- use only officially supported consume/read behavior available on the configured endpoint
- bound timeout and record count
- use an ephemeral/dedicated consumer identity if required by the supported API
- clean up ephemeral consumer state if the selected API requires it
- normalize records

### `trace_bridge_reader.py`

Responsibilities:

- call existing TSCI backend trace API through `tsci_backend`
- normalize output to the same event schema
- return `source=TRACE_BRIDGE`

### Critical implementation rule

Do **not** implement a guessed REST endpoint. The adapter must be based on the endpoint exposed by the configured Confluent environment and validated by the compatibility probe.

---

## 11. Agent Changes

Modify:

```text
wxo/agents/confluent_intelligence_agent.yaml
```

### Purpose

The agent becomes the source-of-truth investigator for Confluent event evidence.

### Required instructions

Add/replace with the following behavior:

```text
You are the Confluent Intelligence Agent for the TSCI demonstration.
All operational data is SYNTHETIC.

GOAL
Explain what Confluent observed, which events contributed to a risk, and whether
those events were retrieved directly from Confluent or through the trace fallback.

SOURCE PRIORITY
1. Use get_confluent_event_trace for correlation-based event questions.
2. In AUTO mode, the tool itself prefers direct Confluent retrieval.
3. Use metadata tools to verify cluster/topic facts when needed.
4. Never claim TRACE_BRIDGE evidence was directly fetched from Confluent.

RULES
- Read-only.
- Never produce, delete, create or alter Kafka resources.
- Never fabricate event payloads, timestamps, offsets, partitions or Flink output.
- Never infer a missing event from business state.
- Preserve correlationId as the primary trace key.
- For every evidence response, state the evidence source:
    DIRECT CONFLUENT
    or
    TRACE BRIDGE FALLBACK
- If direct retrieval fails but fallback succeeds, continue the investigation and
  explicitly disclose the fallback.
- If both fail, state that event evidence is unavailable.
- Do not continuously poll Kafka.
- Do not use Confluent tools to execute supply-chain business actions.

INVESTIGATION SEQUENCE
1. Obtain correlationId from the parent investigation context.
2. Call get_confluent_event_trace(correlationId).
3. Identify source events.
4. Identify derived Flink events.
5. Order events using timestamp and offset evidence where meaningful.
6. State exactly why the event sequence supports or does not support the risk claim.
7. If infrastructure verification is requested, call topic/partition metadata tools.
```

### Tool list

Agent MUST have:

```text
check_confluent_direct_read_capability
list_confluent_topics
get_confluent_topic_details
get_confluent_topic_partitions
get_confluent_topic_config
get_confluent_recent_records
get_confluent_event_trace
get_confluent_risk_evidence
```

No write tool may be attached to this agent.

---

## 12. Primary Agent Changes

Modify:

```text
wxo/agents/tsci_primary_agent.yaml
```

Keep `confluent_intelligence_agent` as a collaborator.

Routing rules:

```text
"Confluent?" / "Kafka?" / "which event?" / "event trace?" /
"what caused this?" / "show streaming evidence" /
"was this generated by Flink?"
    -> delegate to confluent_intelligence_agent
```

For a full recommendation, orchestration order remains:

```text
risk_investigation_agent
    -> confluent_intelligence_agent
    -> inventory_agent
    -> procurement_agent
    -> resilience_monitor_agent
    -> engineering_knowledge_agent when needed
    -> mitigation_agent
```

The primary agent must treat Confluent evidence as **event provenance**, not as a replacement for current business-state APIs.

---

## 13. Event Normalization

All direct/fallback event records must normalize to:

```json
{
  "source": "DIRECT_CONFLUENT | TRACE_BRIDGE",
  "topic": "string",
  "partition": 0,
  "offset": 0,
  "timestamp": "ISO-8601|null",
  "key": "string|null",
  "correlation_id": "string|null",
  "event_id": "string|null",
  "event_type": "string|null",
  "value": {},
  "decode_status": "DECODED|RAW|FAILED"
}
```

Sorting rule:

1. timestamp ascending when available
2. within same topic/partition, offset ascending
3. never compare offsets across different partitions as if they were globally ordered

---

## 14. Schema Handling

The current demo topics use Schema Registry-backed JSON tables for Flink.

Direct read implementation must:

- detect whether returned values are decoded JSON or serialized bytes
- decode only when supported and safe
- never pretend a serialized value was decoded
- optionally use Schema Registry only if required by the selected direct-read API and the wxO runtime supports the dependency/network path

Do not make Schema Registry a mandatory dependency unless direct event retrieval actually requires it.

If Schema Registry access is needed, define a separate wxO connection rather than reusing Kafka credentials.

---

## 15. Timeouts, Limits, and Reliability

Defaults:

```text
CONFLUENT_DIRECT_TIMEOUT_SECS=15
CONFLUENT_LOOKBACK_MINUTES=60
CONFLUENT_MAX_RECORDS_PER_TOPIC=50
CONFLUENT_MAX_TOTAL_RECORDS=250
CONFLUENT_CAPABILITY_CACHE_SECS=300
```

Rules:

- Every network call must have a timeout.
- Retry only transient `429` and `5xx` responses.
- Maximum retries: 2.
- Use bounded exponential backoff.
- Authentication/authorization errors must not be retried repeatedly.
- In `auto` mode, a direct-read failure must trigger fallback after bounded retries.

---

## 16. Observability

Tool logs must include:

```text
correlation_id
source_mode requested
source_mode used
topics queried
record count
elapsed_ms
fallback_used
error category
```

Never log secrets.

Recommended audit event:

```text
WXO_CONFLUENT_EVIDENCE_READ
```

Example:

```json
{
  "event": "WXO_CONFLUENT_EVIDENCE_READ",
  "correlation_id": "DEMO-TW2047-001",
  "source": "DIRECT_CONFLUENT",
  "topics": ["supply.shipment.updated", "supply.risk.detected"],
  "records": 2,
  "fallback_used": false
}
```

---

## 17. Demo/Fallback Requirements

The existing demo fallback must remain operational even when all external Confluent/wxO integration fails.

### Live mode

```text
Confluent source events
  -> Flink
  -> supply.risk.detected
  -> backend
  -> wxO
  -> direct Confluent evidence lookup when supported
```

### Direct-read unavailable

```text
Confluent/Flink live path
  -> backend trace bridge
  -> wxO
  -> TRACE_BRIDGE evidence
```

### Full demo/local fallback

```text
DEMO_MODE=local
  -> deterministic backend scenario
  -> local agent fallback
```

The direct Confluent enhancement MUST NOT break either fallback.

---

## 18. Expected Demo Conversation

User:

```text
Investigate this risk and show me exactly what Confluent observed.
```

Expected primary-agent behavior:

```text
1. delegate risk context lookup
2. obtain correlationId
3. delegate Confluent evidence lookup
4. Confluent agent calls get_confluent_event_trace
5. tool attempts DIRECT_CONFLUENT
6. if successful, return direct event evidence
7. continue inventory/procurement/resilience/mitigation analysis
```

Expected response pattern:

```text
Risk
CRITICAL supply risk for CVA-8842 / TW-2047
Correlation ID: DEMO-TW2047-001

Confluent Evidence
Source: DIRECT CONFLUENT

1. turnaround.material.required
   CVA-8842 required for TW-2047

2. supply.inventory.changed
   PEARL-DEMO available = 0

3. supply.shipment.updated
   SHP-90017 ETA moved beyond required-by

4. supply.risk.detected
   Flink emitted CRITICAL risk

Recommendation
Transfer 1 unit from REGIONAL-WH-DEMO ...
```

Fallback version MUST state:

```text
Confluent Evidence
Source: TRACE BRIDGE FALLBACK
Direct record retrieval was unavailable; the following Kafka evidence was captured
by the TSCI trace consumer.
```

---

## 19. Files to Change

### Required

```text
wxo/tools/confluent_tools.py
wxo/agents/confluent_intelligence_agent.yaml
wxo/agents/tsci_primary_agent.yaml
wxo/configure_confluent_connection.sh
wxo/import_all.sh
wxo/README.md
.env.example
```

### Recommended new files

```text
wxo/tools/confluent_readers/__init__.py
wxo/tools/confluent_readers/base.py
wxo/tools/confluent_readers/kafka_rest_reader.py
wxo/tools/confluent_readers/trace_bridge_reader.py
wxo/tests/test_confluent_tools.py
wxo/tests/test_confluent_reader_fallback.py
wxo/tests/test_confluent_agent_contract.py
```

### Preserve

```text
confluent/python/consumers/consume_event_trace.py
backend event-trace API
```

These remain the fallback implementation.

---

## 20. Environment Variables

Add/document:

```text
CONFLUENT_READ_MODE=auto
CONFLUENT_ALLOWED_TOPICS=turnaround.material.required,supply.inventory.changed,supply.shipment.updated,supply.supplier.status.changed,supply.port.status.changed,supply.approved_vendor.changed,supply.risk.detected,supply.material.readiness.assessed,supply.action.completed
CONFLUENT_DIRECT_TIMEOUT_SECS=15
CONFLUENT_LOOKBACK_MINUTES=60
CONFLUENT_MAX_RECORDS_PER_TOPIC=50
CONFLUENT_MAX_TOTAL_RECORDS=250
CONFLUENT_CAPABILITY_CACHE_SECS=300
```

Do not store API keys/secrets in source-controlled `.env` files.

---

## 21. Acceptance Criteria

### AC-001 Direct metadata

**Given** valid `confluent_kafka` credentials  
**When** the Confluent agent checks the cluster  
**Then** cluster and topic metadata are returned directly from Confluent.

### AC-002 Direct event-read capability probe

**Given** valid cluster connectivity  
**When** `check_confluent_direct_read_capability` runs  
**Then** it accurately reports whether bounded record retrieval is available.

### AC-003 Direct event trace

**Given** direct event retrieval is supported  
**And** events exist with correlation ID `DEMO-TW2047-001`  
**When** `get_confluent_event_trace` is called in `auto` mode  
**Then** matching records are returned with `source=DIRECT_CONFLUENT`.

### AC-004 Correlation filter

No event with a different non-null correlation ID may appear in a filtered result.

### AC-005 Provenance

Every event result identifies `DIRECT_CONFLUENT` or `TRACE_BRIDGE`.

### AC-006 Automatic fallback

**Given** direct record retrieval is unsupported or fails  
**And** the trace bridge is available  
**When** `CONFLUENT_READ_MODE=auto`  
**Then** the tool returns trace evidence with `fallback_used=true`.

### AC-007 No silent fallback in direct mode

**Given** direct retrieval fails  
**When** `CONFLUENT_READ_MODE=direct`  
**Then** return a structured direct-read failure and do not query the trace bridge.

### AC-008 Trace-only mode

**When** `CONFLUENT_READ_MODE=trace`  
**Then** no direct Confluent record-read operation is attempted.

### AC-009 Topic allowlist

A request for a non-allowlisted topic is rejected before network access.

### AC-010 Bounded execution

No direct wxO tool may poll indefinitely or return more than configured record limits.

### AC-011 Read-only

The Confluent intelligence agent has no Kafka produce/create/delete/alter tool.

### AC-012 Agent disclosure

If trace fallback is used, the agent explicitly says the records came from the trace bridge.

### AC-013 Full investigation routing

A full TSCI risk recommendation invokes `confluent_intelligence_agent` after risk context is established and before mitigation scoring.

### AC-014 Existing fallback preserved

The existing `consume_event_trace.py` + backend trace path continues to work unchanged if direct read is disabled.

### AC-015 Demo mode preserved

`DEMO_MODE=local` continues to run without requiring Confluent direct connectivity.

---

## 22. Required Tests

### Unit tests

- Basic Auth connection parsing
- topic allowlist
- correlation filter
- normalization
- timeout behavior
- max-record enforcement
- source labeling
- capability cache
- retry classification

### Adapter tests

```text
DIRECT available -> direct result
DIRECT unsupported -> trace fallback
DIRECT 401 -> trace fallback in auto
DIRECT timeout -> trace fallback in auto
DIRECT failure -> error in direct mode
TRACE failure -> structured unavailable response
```

### Agent contract tests

Validate:

- YAML parses
- every named tool exists
- no write tool is assigned to `confluent_intelligence_agent`
- primary collaborator reference resolves
- agent instructions require source disclosure

### Integration test

Populate demo data with one correlation ID and verify the returned event chain includes at minimum:

```text
turnaround.material.required
supply.inventory.changed
supply.shipment.updated
supply.risk.detected
```

when those records actually exist.

---

## 23. Definition of Done

Implementation is complete only when:

- [ ] compatibility probe exists
- [ ] direct bounded event retrieval works in the target Confluent environment OR is correctly reported unsupported
- [ ] `auto`, `direct`, and `trace` modes work
- [ ] trace fallback remains functional
- [ ] correlation filtering works
- [ ] source provenance is visible to the agent/user
- [ ] read-only security is enforced
- [ ] agent routing is updated
- [ ] unit/contract/integration tests pass
- [ ] README documents the two wxO connections and fallback behavior
- [ ] no hard-coded credentials exist
- [ ] local demo mode still works without Confluent

---

## 24. Implementation Priority

### Phase 1 — Mandatory

1. Compatibility probe
2. Adapter abstraction
3. Direct bounded record-read implementation where supported
4. Auto fallback to existing trace bridge
5. Agent instruction/tool updates
6. Tests

### Phase 2 — Recommended

1. richer event decoding/schema support
2. consumer lag evidence where cluster type supports it
3. UI indicator for `DIRECT CONFLUENT` vs `TRACE FALLBACK`
4. audit metrics for direct/fallback usage

### Out of Scope

- making wxO a permanent Kafka consumer
- replacing Flink risk detection with an LLM
- allowing the Confluent agent to write records
- Kafka topic lifecycle management from wxO
- removing the FastAPI business-state layer

---

## 25. Reference Notes for Implementer

Current Confluent Cloud documentation states that Kafka REST APIs can be used for producing/consuming messages over HTTPS and that cluster REST endpoints are per-cluster. Confluent also documents stateful REST consumer semantics in REST Proxy APIs, including consumer instances, subscriptions, record fetches, offsets, and instance affinity. Because exposed operations can differ by deployment/API surface, this specification intentionally requires capability discovery rather than guessing an endpoint.

Current wxO implementation should continue using managed connection credentials at runtime rather than environment-embedded secrets.

---

## 26. Instruction to Implementation Agent

Implement this specification without redesigning unrelated TSCI functionality.

Preserve all existing behavior unless this specification explicitly changes it.

Do not remove the event trace bridge. Make direct Confluent retrieval the preferred on-demand evidence source in `auto` mode, with the trace bridge as fallback.

Before claiming direct Kafka record retrieval is implemented, execute the compatibility probe against the configured target Confluent environment and prove it with an integration test. If the target environment does not expose a supported direct record-consume mechanism, keep the code path feature-gated, report it accurately, and use the trace bridge without fabricating success.
