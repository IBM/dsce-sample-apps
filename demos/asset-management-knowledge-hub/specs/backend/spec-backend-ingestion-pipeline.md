# SPEC-003 — Backend: Ingestion Pipeline

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  
**Location:** `backend/ingestion_pipeline/`  
**Skills Required:** `opensearch-vector-search`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | Maintenance documents (PDFs, DOCX, TXT) stored in IBM Cloud Object Storage must be automatically discoverable and ingested into the OpenSearch vector index. |
| BR-002 | Documents must be chunked, embedded using IBM watsonx AI, and indexed so the MCP Server can retrieve relevant passages via hybrid search. |
| BR-003 | The ingestion process must track document registry to avoid re-ingesting unchanged documents. |
| BR-004 | Ingestion progress must be observable in real-time via a status polling endpoint. |
| BR-005 | Each chunk must carry structured metadata (asset number, category, version, tags) to enable filtered retrieval. |
| BR-006 | The pipeline must also support ingestion from S3-compatible sources (Box, S3) as alternative document stores. |

---

## 2. Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| HTTP Server | Uvicorn |
| PDF Parsing | `pdfplumber` |
| DOCX Parsing | `mammoth` |
| Embeddings | IBM watsonx AI (`ibm/slate-30m-english-rtrvr-v2`) |
| Vector Index | IBM watsonx.data OpenSearch (`opensearch-py`) |
| Object Storage | IBM Cloud Object Storage (`ibm-cos-sdk`) |

---

## 3. API Endpoints

### 3.1 Run Pipeline

```
POST /api/pipelines/run
```

**Request:**
```json
{
  "source": "cos",
  "bucket": "maximo-docs-bucket",
  "prefix": "pumps/",
  "force_reindex": false
}
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "running",
  "message": "Ingestion started for bucket maximo-docs-bucket"
}
```

### 3.2 Poll Status

```
GET /api/pipelines/status
```

**Response:**
```json
{
  "jobId": "uuid",
  "status": "running",
  "progress": {
    "total": 42,
    "processed": 18,
    "failed": 1,
    "skipped": 3
  },
  "currentFile": "pump-p101-oem-manual.pdf",
  "startedAt": "2024-01-15T10:30:00Z",
  "estimatedCompletionAt": "2024-01-15T10:35:00Z"
}
```

### 3.3 Health Check

```
GET /health
```

---

## 4. Document Processing Pipeline

> **Skill:** `opensearch-vector-search`

The [`DocumentProcessorService`](../backend/ingestion_pipeline/src/services/document_processor_service.py) implements the full pipeline:

### 4.1 Processing Steps

```
IBM COS bucket
    │
    │  1. List objects (filtered by prefix/extension)
    ▼
COS Service — download file bytes
    │
    │  2. Extract text
    ▼
Document Processor
  - PDF  → pdfplumber (page-by-page)
  - DOCX → mammoth (raw text)
  - TXT  → UTF-8 decode
    │
    │  3. Chunk text
    ▼
Sliding Window Chunker
  - Chunk size: 400 characters (~320 tokens for ibm/slate-30m-english-rtrvr-v2)
  - Overlap: 50 characters
  - Break at sentence boundary (last `.` or `\n` after 70% of chunk)
    │
    │  4. Embed in batches
    ▼
IBM watsonx AI Embeddings
  - Model: ibm/slate-30m-english-rtrvr-v2
  - Batch size: 10 chunks per API call
    │
    │  5. Bulk index
    ▼
IBM watsonx.data OpenSearch
  - Index: maximo-documents
  - Each chunk: id, documentId, fileName, chunkIndex, content, embedding, metadata, timestamp
```

### 4.2 DocumentChunk Schema

```python
@dataclass
class DocumentChunk:
    id: str               # generated chunk ID
    document_id: str      # path-based document identifier
    file_name: str        # original COS key
    chunk_index: int      # 0-based position in document
    content: str          # chunk text (max ~400 chars)
    embedding: list[float]  # 384-dim vector from watsonx AI
    metadata: dict        # assetnum, category, version, tags
    timestamp: str        # ISO 8601 UTC
```

### 4.3 Document ID Convention

```
{asset_num}/{category}/{file_name}    — for asset-specific documents
documents/{file_name}                  — for general documents
```

---

## 5. OpenSearch Index: `maximo-documents`

> **Skill:** `opensearch-vector-search`

**Index mapping:**
```json
{
  "mappings": {
    "properties": {
      "documentId":   { "type": "keyword" },
      "fileName":     { "type": "keyword" },
      "chunkIndex":   { "type": "integer" },
      "content":      { "type": "text", "analyzer": "english" },
      "embedding": {
        "type": "knn_vector",
        "dimension": 384,
        "method": {
          "name": "hnsw",
          "engine": "nmslib",
          "parameters": { "ef_construction": 128, "m": 16 }
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

---

## 6. Document Registry

The [`document_registry_service`](../backend/ingestion_pipeline/src/services/document_registry_service.py) tracks which documents have been ingested and their content hashes to prevent re-indexing unchanged files.

---

## 7. Alternative Source Adapters

| Adapter | File | Source |
|---------|------|--------|
| `COSIngestionService` | `cos_ingestion_service.py` | IBM Cloud Object Storage |
| `S3IngestionService` | `s3_ingestion_service.py` | AWS S3 / S3-compatible |
| `BoxIngestionService` | `box_ingestion_service.py` | Box cloud storage |
| `WebIngestionService` | `web_ingestion_service.py` | Arbitrary HTTP URLs |

---

## 8. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | `POST /api/pipelines/run` starts an ingestion job and returns a job ID within 1 second. |
| AC-002 | A 10-page PDF is fully chunked, embedded, and indexed in OpenSearch within 60 seconds on standard hardware. |
| AC-003 | Re-running ingestion on an unchanged document skips re-indexing (registry check). |
| AC-004 | `GET /api/pipelines/status` returns live progress with current file name and percentage complete. |
| AC-005 | All chunks include the correct `assetnum`, `category`, `version`, and `tags` from COS object metadata. |
| AC-006 | Chunk overlap of 50 characters ensures no sentence is split across chunks without context. |
| AC-007 | The pipeline handles corrupted or empty PDFs gracefully and reports them as `failed` without crashing the job. |
| AC-008 | Embeddings are generated using `ibm/slate-30m-english-rtrvr-v2` and stored as 384-dimension `knn_vector` fields. |
