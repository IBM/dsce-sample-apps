# SPEC-005 — OpenSearch Vector Search

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Skill:** `opensearch-vector-search`  
**Location:** `backend/shared/opensearch/`, `backend/opensearch/`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The system must support hybrid search (dense vector + BM25 keyword) across ingested maintenance documents and web-crawled knowledge. |
| BR-002 | Vector search must use IBM watsonx AI `ibm/slate-30m-english-rtrvr-v2` embeddings (384 dimensions). |
| BR-003 | All OpenSearch indices must be provisioned with correct knn_vector mappings before any document is indexed. |
| BR-004 | Search results must include relevance scores, content highlights, and source metadata for explainability. |
| BR-005 | The OpenSearch client must support both local Docker (development) and IBM watsonx.data managed OpenSearch (production). |
| BR-006 | Index setup scripts must be idempotent — safe to re-run without deleting existing data. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Search Engine | IBM watsonx.data OpenSearch (managed) / Docker OpenSearch (local) |
| Python Client | `opensearch-py` |
| Embedding Model | `ibm/slate-30m-english-rtrvr-v2` (384-dim, via IBM watsonx AI API) |
| KNN Algorithm | HNSW (Hierarchical Navigable Small World) via `nmslib` engine |

---

## 3. Index Definitions

### 3.1 Index: `maximo-documents`

**Purpose:** Ingested maintenance document chunks (from IBM COS via Ingestion Pipeline)

```json
{
  "settings": {
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 100
    }
  },
  "mappings": {
    "properties": {
      "documentId":  { "type": "keyword" },
      "fileName":    { "type": "keyword" },
      "chunkIndex":  { "type": "integer" },
      "content": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "keyword": { "type": "keyword", "ignore_above": 512 }
        }
      },
      "embedding": {
        "type": "knn_vector",
        "dimension": 384,
        "method": {
          "name": "hnsw",
          "engine": "nmslib",
          "space_type": "cosinesimil",
          "parameters": {
            "ef_construction": 128,
            "m": 16
          }
        }
      },
      "metadata": {
        "properties": {
          "assetnum":  { "type": "keyword" },
          "category":  { "type": "keyword" },
          "version":   { "type": "keyword" },
          "tags":      { "type": "keyword" }
        }
      },
      "timestamp": { "type": "date" }
    }
  }
}
```

### 3.2 Index: `maximo_web_knowledge`

**Purpose:** Web-crawled IBM Docs, IBM Support articles, and community knowledge (from Spiderbot)

```json
{
  "settings": {
    "index": {
      "knn": false
    }
  },
  "mappings": {
    "properties": {
      "url": {
        "type": "keyword",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "title":       { "type": "text" },
      "siteLabel":   { "type": "keyword" },
      "topic":       { "type": "keyword" },
      "content":     { "type": "text", "analyzer": "english" },
      "contentHash": { "type": "keyword" },
      "crawledAt":   { "type": "date" }
    }
  }
}
```

---

## 4. Hybrid Search Pattern

The hybrid search combines:
1. **BM25 keyword search** (`multi_match`) — always applied
2. **KNN vector search** (`knn`) — applied when a query embedding is available

```python
def hybrid_search(query: str, embedding: list[float] | None, filters: dict, limit: int) -> list[dict]:
    must = []
    should = []

    # BM25 keyword search
    if query:
        should.append({
            "multi_match": {
                "query": query,
                "fields": ["content^2", "fileName", "metadata.section"],
                "type": "best_fields",
                "fuzziness": "AUTO"
            }
        })

    # Vector search (requires knn_vector mapping)
    if embedding:
        should.append({
            "knn": {
                "embedding": {
                    "vector": embedding,
                    "k": limit
                }
            }
        })

    # Metadata filters
    for field, value in filters.items():
        if value:
            must.append({"term": {f"metadata.{field}": value}})

    return client.search(index=index, body={
        "query": {
            "bool": {
                "must": must,
                "should": should,
                "minimum_should_match": 1
            }
        },
        "size": limit,
        "highlight": {
            "fields": {
                "content": {"fragment_size": 150, "number_of_fragments": 3}
            }
        }
    })
```

---

## 5. Client Configuration

The [`build_client()`](../backend/shared/opensearch/__init__.py) function constructs an OpenSearch client from environment variables:

| Variable | Description |
|----------|-------------|
| `OPENSEARCH_HOST` | e.g. `https://localhost:9200` or IBM watsonx.data endpoint |
| `OPENSEARCH_USERNAME` | Admin username |
| `OPENSEARCH_PASSWORD` | Admin password |
| `OPENSEARCH_VERIFY_CERTS` | `true` in production, `false` for local Docker |

**Local Docker setup:**
```bash
# Start OpenSearch via Docker Compose
docker compose -f deployment/docker-compose.yml up -d

# Create indices (idempotent)
./backend/opensearch/setup-indexes.sh
```

---

## 6. Index Setup Scripts

`backend/opensearch/setup-indexes.sh` and `setup-indexes.ps1` create both indices if they do not exist. They are idempotent — re-running does not delete existing documents.

```bash
# On Linux/macOS
./backend/opensearch/setup-indexes.sh

# On Windows
./backend/opensearch/setup-indexes.ps1
```

---

## 7. Performance Requirements

| Operation | Target |
|-----------|--------|
| Hybrid search (documents index, 10 results) | < 500ms |
| Web knowledge search (keyword, 5 results) | < 300ms |
| Bulk index (10 chunks) | < 2 seconds |
| Index health check | < 200ms |

---

## 8. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | Both `maximo-documents` and `maximo_web_knowledge` indices are created by the setup scripts and are reachable via `GET /health`. |
| AC-002 | Hybrid search on `maximo-documents` returns results with `documentId`, `fileName`, `content`, `score`, `metadata`, and `highlights`. |
| AC-003 | `web_knowledge_search()` returns an empty list (not an error) when `maximo_web_knowledge` does not yet exist. |
| AC-004 | Metadata filters (`assetnum`, `category`, `version`) correctly narrow search results to matching documents. |
| AC-005 | `knn_vector` mapping with 384 dimensions is correctly provisioned before embeddings are indexed. |
| AC-006 | `get_index_stats()` returns accurate document count and index size in bytes. |
| AC-007 | URL collapse (`collapse: { "field": "url.keyword" }`) in web knowledge search returns at most one result per unique URL. |
| AC-008 | The OpenSearch client connects to IBM watsonx.data managed OpenSearch using TLS and basic auth credentials from environment variables. |
