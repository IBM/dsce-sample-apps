# SPEC-006 — Data Streaming: Confluent Kafka Integration

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Skill:** `data-streaming-confluent`  
**Location:** `backend/mcp_server/src/services/kafka_service.py`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The system must optionally consume real-time Maximo operational events from Confluent Kafka to enrich AI-generated investigations with up-to-date event context. |
| BR-002 | When Kafka is not configured, the system must continue to function normally using Maximo REST API and OpenSearch as primary data sources. |
| BR-003 | The MCP Server must expose Kafka connectivity status through the `/api/status` endpoint so the UI can accurately reflect whether real-time streaming is active. |
| BR-004 | Real-time failure events from Kafka must be consumable to trigger proactive AI analysis without requiring a user-initiated query. |
| BR-005 | The integration must support Confluent Cloud SASL/SSL authentication. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Streaming Platform | Confluent Cloud (Apache Kafka) |
| Python Client | `confluent-kafka` (lazy import — optional dependency) |
| Authentication | SASL/SSL (`SASL_SSL` protocol, `PLAIN` mechanism) |
| Admin Operations | `confluent_kafka.admin.AdminClient` |

---

## 3. Kafka Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `KAFKA_BOOTSTRAP_SERVERS` | Confluent Cloud bootstrap endpoint, e.g. `pkc-xxxxx.us-east-1.aws.confluent.cloud:9092` | — |
| `KAFKA_API_KEY` | Confluent Cloud API key (SASL username) | — |
| `KAFKA_API_SECRET` | Confluent Cloud API secret (SASL password) | — |
| `KAFKA_SECURITY_PROTOCOL` | Security protocol | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | SASL mechanism | `PLAIN` |

If `KAFKA_BOOTSTRAP_SERVERS` is not set, the [`KafkaService`](../backend/mcp_server/src/services/kafka_service.py) returns `configured: false` for all calls.

---

## 4. KafkaService API

### 4.1 `test_connection() → dict`

Connects to the Kafka cluster via `AdminClient`, lists non-internal topics, and returns:

```python
{
    "configured": bool,   # KAFKA_BOOTSTRAP_SERVERS is set
    "connected": bool,    # AdminClient reached the cluster
    "topics": list[str],  # sorted non-internal topic names
    "error": str | None   # human-readable error on failure
}
```

**Timeouts:** All AdminClient timeouts set to 8 seconds to prevent hanging HTTP responses.

### 4.2 Future: Event Consumer

Planned consumers for reactive analysis:

```python
class MaximoEventConsumer:
    """Consume Maximo events and trigger proactive AI analysis."""

    def consume_failure_events(self, topic: str) -> AsyncIterator[FailureEvent]:
        """Yield failure events for reactive investigation trigger."""

    def consume_work_order_events(self, topic: str) -> AsyncIterator[WorkOrderEvent]:
        """Yield WO creation/update events."""
```

---

## 5. Expected Kafka Topics

| Topic | Event Type | Trigger |
|-------|-----------|---------|
| `maximo.work-orders` | Work order created / updated | Trigger WO analysis |
| `maximo.assets` | Asset status changed | Trigger asset health check |
| `maximo.failures` | Failure event recorded | Trigger proactive failure investigation |
| `maximo.pm-completions` | PM completed | Update job plan analysis context |
| `maximo.service-requests` | SR created | Trigger SR classification |

---

## 6. Confluent Cloud Setup

### 6.1 Create API Key

```bash
# Via Confluent CLI
confluent api-key create --resource <cluster-id>

# Output:
# API Key    XXXXXXXXXXXXX
# API Secret YYYYYYYYYYYYY
```

### 6.2 Maximo Event Connector

Configure Confluent's **Kafka Connect** with the **IBM MQ Source Connector** or **HTTP Source Connector** to bridge Maximo events into Kafka:

```json
{
  "name": "maximo-assets-connector",
  "config": {
    "connector.class": "io.confluent.connect.http.HttpSourceConnector",
    "url": "${MAXIMO_URL}/maximo/oslc/os/mxapiasset",
    "http.request.headers": "apikey: ${MAXIMO_API_KEY}",
    "topic": "maximo.assets",
    "poll.interval.ms": "30000"
  }
}
```

### 6.3 Admin Config (used by KafkaService)

```python
admin_config = {
    "bootstrap.servers":  KAFKA_BOOTSTRAP_SERVERS,
    "security.protocol":  "SASL_SSL",
    "sasl.mechanism":     "PLAIN",
    "sasl.username":      KAFKA_API_KEY,
    "sasl.password":      KAFKA_API_SECRET,
    "socket.timeout.ms":            8000,
    "request.timeout.ms":           8000,
    "metadata.request.timeout.ms":  8000,
}
```

---

## 7. MCP Server Integration Points

| Integration Point | Behavior |
|-------------------|----------|
| `GET /api/status` | Calls `kafka_service.test_connection()` and includes result in status response |
| `POST /api/query` | (Future) Enriches investigation context with recent failure events from `maximo.failures` topic |
| Proactive analysis | (Future) Background consumer triggers investigation creation when failure event rate exceeds threshold |

---

## 8. Graceful Degradation

The `confluent-kafka` package is an **optional dependency**. The code uses lazy import:

```python
try:
    from confluent_kafka.admin import AdminClient
except ImportError:
    return {
        "configured": True,
        "connected": False,
        "topics": [],
        "error": "confluent-kafka package is not installed."
    }
```

If `KAFKA_BOOTSTRAP_SERVERS` is empty, the MCP Server still starts and functions with Maximo + OpenSearch.

---

## 9. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | When Confluent Kafka credentials are correctly configured, `kafka_service.test_connection()` returns `connected: true` and a non-empty `topics` list. |
| AC-002 | When `KAFKA_BOOTSTRAP_SERVERS` is not set, the service returns `{"configured": false, "connected": false, "topics": [], "error": "..."}` without crashing. |
| AC-003 | When `confluent-kafka` is not installed, the service returns `{"configured": true, "connected": false, "error": "confluent-kafka package is not installed."}`. |
| AC-004 | `GET /api/status` correctly shows Kafka as `configured: false` when no bootstrap servers are set, and `connected: true` when the cluster is reachable. |
| AC-005 | Internal Kafka topics (those starting with `_`) are excluded from the returned topics list. |
| AC-006 | The `test_connection()` call completes within 10 seconds even when the cluster is unreachable (timeout enforcement). |
| AC-007 | Removing Kafka credentials from environment variables does not require a code change — the service reads from environment at runtime. |
