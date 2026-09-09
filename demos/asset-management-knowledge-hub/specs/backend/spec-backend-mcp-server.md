# SPEC-002 — Backend: MCP Server

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Location:** `backend/mcp_server/`  
**Skills Required:** `opensearch-vector-search`, `data-streaming-confluent`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The MCP Server must accept a natural-language query and return a grounded, cited answer synthesizing data from multiple sources. |
| BR-002 | The server must intelligently route each query to the appropriate data source: live Maximo API, OpenSearch RAG, or both. |
| BR-003 | Answers must always include citations identifying which documents, Maximo records, or web sources were used. |
| BR-004 | The server must support multi-tenant Maximo instances via a registry that routes requests based on tenant context. |
| BR-005 | The server must expose a `/api/status` endpoint that reports live connectivity for all integrated services. |
| BR-006 | The server must not fabricate data — all answers must be traceable to retrieved source content. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| HTTP Server | Uvicorn |
| AI Generation | IBM watsonx AI Granite (`ibm/granite-13b-instruct-v2` or equivalent) |
| Vector Search | IBM watsonx.data OpenSearch (`opensearch-py`) |
| Maximo API | IBM Maximo Manage REST API (OSLC) |
| Event Stream | Confluent Kafka (`confluent-kafka`) — optional |
| CRM | ServiceNow REST API — optional |

---

## 3. API Endpoints

### 3.1 Query Endpoint

```
POST /api/query
```

**Request:**
```json
{
  "query": "Show me assets with recurring failures in the last 6 months",
  "instance_id": "prod-maximo",
  "context": {
    "previous_action_id": "optional-uuid-for-follow-up"
  }
}
```

**Response:**
```json
{
  "answer": "I found 15 assets with recurring failures...",
  "sources": [
    {
      "type": "maximo",
      "objectStructure": "MXAPIASSET",
      "records": [...]
    },
    {
      "type": "document",
      "fileName": "pump-maintenance-manual.pdf",
      "content": "...",
      "score": 0.92
    }
  ],
  "action": {
    "type": "investigation",
    "title": "Critical Asset Failure Investigation",
    "id": "uuid"
  },
  "routing": {
    "route": "hybrid",
    "maximo_used": true,
    "rag_used": true
  }
}
```

### 3.2 Status Endpoint

```
GET /api/status
```

Returns live connectivity for: OpenSearch, Maximo, Kafka, ServiceNow, watsonx AI.

### 3.3 Action Center Endpoints

```
GET    /api/actions              — list all Action Center entries
POST   /api/actions              — create a new action entry
GET    /api/actions/:id          — fetch a single action
PATCH  /api/actions/:id          — update action status/fields
DELETE /api/actions/:id          — soft-delete an action
```

### 3.4 Health Endpoint

```
GET /health
```

---

## 4. Intelligent Query Routing

The [`maximo_service.determine_routing()`](../backend/mcp_server/src/services/maximo_service.py) method scores each query against keyword dictionaries to determine whether to route to the live Maximo API or to OpenSearch RAG.

**Maximo API keywords (examples):** `work order`, `asset status`, `how many`, `current`, `open`, `in progress`  
**RAG keywords (examples):** `how to`, `procedure`, `manual`, `maintenance procedure`, `troubleshoot`, `best practice`

| Route | Condition |
|-------|-----------|
| `maximo` | Maximo score > RAG score, or asset identifier present with property query |
| `rag` | RAG score > Maximo score, or query is about procedures/documentation |
| `hybrid` | Both sources queried when the query benefits from operational + knowledge context |

---

## 5. OpenSearch Integration

> **Skill:** `opensearch-vector-search`

The MCP Server queries two OpenSearch indices:

| Index | Content | Search Type |
|-------|---------|------------|
| `maximo-documents` | COS-ingested PDF/DOCX chunks with embeddings | Hybrid (vector + BM25) |
| `maximo_web_knowledge` | Spiderbot-crawled IBM Docs + community content | BM25 keyword |

The [`opensearch_service.hybrid_search()`](../backend/mcp_server/src/services/opensearch_service.py) method applies:
- `multi_match` across `content`, `fileName`, `metadata.section` fields
- Optional `knn` vector search (requires knn_vector index mapping)
- Optional metadata filters: `assetnum`, `category`, `version`

---

## 6. Confluent Kafka Integration

> **Skill:** `data-streaming-confluent`

The [`kafka_service.test_connection()`](../backend/mcp_server/src/services/kafka_service.py) verifies Kafka cluster connectivity and lists available topics.

**Configuration via environment variables:**

| Variable | Description |
|----------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | Confluent Cloud bootstrap endpoint |
| `KAFKA_API_KEY` | SASL username |
| `KAFKA_API_SECRET` | SASL password |
| `KAFKA_SECURITY_PROTOCOL` | Default: `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | Default: `PLAIN` |

**Expected Kafka topics for Maximo events:**

| Topic | Purpose |
|-------|---------|
| `maximo.work-orders` | Real-time work order creation/updates |
| `maximo.assets` | Asset status change events |
| `maximo.failures` | Failure event stream for reactive analysis |
| `maximo.pm-completions` | PM completion events |

The MCP Server must consume events from these topics to enrich investigation context.

---

## 7. Maximo Service

The [`MaximoService`](../backend/mcp_server/src/services/maximo_service.py) supports:

- `query_object_structure(object_structure, select, page_size, query)` — generic OSLC query
- `intelligent_query(query)` — auto-detect object structure + execute
- `get_asset(assetnum, siteid)` — fetch asset details
- `get_work_orders(assetnum, status, worktype, limit)` — fetch work orders
- `update_work_order(wonum, fields)` — patch a work order
- `update_pm_frequency(pmnum, frequency, frequnit)` — update PM schedule with nextdate rollback
- `determine_routing(query)` — route to Maximo API or RAG

**Supported Object Structures:**

| Object Structure | Entity |
|------------------|--------|
| `MXAPIASSET` | Assets |
| `MXAPIWODETAIL` | Work Orders |
| `MXAPISR` | Service Requests |
| `MXAPIINCIDENT` | Incidents |
| `MXAPIPROBLEM` | Problems |
| `MXAPILOCATION` | Locations |
| `MXAPIPM` | Preventive Maintenance |

---

## 8. Multi-Tenant Instance Registry

The [`instance_registry.py`](../backend/mcp_server/src/services/instance_registry.py) manages multiple Maximo instances.

Each instance entry:
```json
{
  "id": "prod-maximo",
  "label": "Production Maximo",
  "url": "https://maximo.example.com",
  "api_key": "...",
  "default": true
}
```

The MCP Server resolves the active instance from the query `instance_id` parameter or falls back to the default.

---

## 9. Action Center Data Model

```python
@dataclass
class ActionEntry:
    id: str                  # UUID
    type: str                # investigation | analysis | report | recommendation | task
    title: str
    description: str
    status: str              # Running | Completed | In Review | Open | In Progress | Closed
    priority: str            # Critical | High | Medium | Low
    asset_count: int
    assets: list[str]        # asset numbers
    created_at: datetime
    updated_at: datetime
    source: str              # chat | system | user
    conversation_id: str     # links back to originating chat session
    parent_action_id: str    # traceability chain
    evidence: list[Evidence]
    metadata: dict
```

---

## 10. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | `POST /api/query` returns a grounded answer with citations in under 15 seconds for standard queries. |
| AC-002 | Query routing correctly selects Maximo API for operational queries and RAG for procedure/documentation queries. |
| AC-003 | `GET /api/status` correctly reports live/unreachable status for each integrated service. |
| AC-004 | When Kafka is configured and reachable, `kafka_service.test_connection()` returns `connected: true` and lists available topics. |
| AC-005 | When Kafka is not configured, the server returns `configured: false` without error or crash. |
| AC-006 | OpenSearch hybrid search returns ranked results from both `maximo-documents` and `maximo_web_knowledge` when both indices are populated. |
| AC-007 | `update_pm_frequency()` correctly updates PM frequency and rolls back `nextdate` by one full cycle. |
| AC-008 | The server handles Maximo API unavailability gracefully and returns a partial answer from RAG with an appropriate notice. |
| AC-009 | AI answers never represent retrieved document text as OEM requirements unless the source is explicitly an OEM document. |
| AC-010 | Every `POST /api/query` that triggers a significant analysis creates a persisted Action Center entry. |
