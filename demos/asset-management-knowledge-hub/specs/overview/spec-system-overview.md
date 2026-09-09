# SPEC-001 — Asset Management Knowledge Hub: System Overview

**Version:** 1.0  
**Status:** Approved  
**Skills:** `opensearch-vector-search`, `data-streaming-confluent`

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | Reliability Engineers must be able to ask natural-language questions about IBM Maximo assets, work orders, failures, and maintenance history without manually navigating multiple Maximo screens. |
| BR-002 | The system must retrieve grounded, cited answers by combining live Maximo operational data with ingested engineering documentation (OEM manuals, SOPs, PDFs). |
| BR-003 | Conversations must produce persistent, evidence-backed artifacts (Investigations, Analyses, Reports, Recommendations, Tasks) tracked in an Action Center. |
| BR-004 | All ingested documents (PDFs, DOCX) from IBM Cloud Object Storage must be chunked, embedded, and indexed for vector + keyword hybrid search. |
| BR-005 | Web-crawled IBM documentation and community knowledge must be continuously refreshable without manual re-deployment. |
| BR-006 | The system must support optional real-time asset event streaming via Confluent Kafka for live failure alerting. |
| BR-007 | All user interfaces must follow IBM Carbon Design System v11 for enterprise visual consistency. |
| BR-008 | The solution must be deployable to IBM Cloud Code Engine as three independent containerized services. |

---

## 2. System Architecture

```
IBM Cloud Object Storage (Maximo PDFs, DOCX)
          │  POST /api/pipelines/run
          ▼
Ingestion Pipeline (FastAPI :8000)
  COS → parse → chunk → embed (watsonx AI ibm/slate-30m-english-rtrvr-v2)
          │  bulk index
          ▼
IBM watsonx.data OpenSearch
  ├─ maximo-documents        ← ingested document chunks
  └─ maximo_web_knowledge    ← Spiderbot web-crawl results
          ▲
          │  hybrid search (vector + BM25)
          │
User (browser)
  │  POST /api/query
  ▼
Frontend UI (React 18 + IBM Carbon, :3002)
  │  POST /api/query
  ▼
MCP Server (FastAPI :6868)
  ├─ OpenSearch hybrid search  (maximo-documents)
  ├─ OpenSearch hybrid search  (maximo_web_knowledge)
  ├─ Maximo Manage Live REST API (OSLC)
  ├─ ServiceNow (optional)
  └─ Confluent Kafka event stream (optional)
  │  IBM watsonx AI Granite (grounded answer generation)
  ▼
Natural-language answer + source citations → Action Center artifacts
```

### Services

| Service | Technology | Port | Responsibility |
|---------|-----------|------|----------------|
| MCP Server | Python FastAPI | 6868 | Central AI brain: query routing, OpenSearch hybrid search, Maximo live API, Kafka, answer generation |
| Ingestion Pipeline | Python FastAPI | 8000 | COS document fetch, parse, chunk, embed, index |
| Spiderbot | Python + Playwright | CLI | One-shot web crawler for IBM Docs and community knowledge |
| Frontend UI | React 18 + IBM Carbon | 3002 | Chat, Action Center, Data Ingestion, Audit Log, Statistics, Settings |

---

## 3. Data Flow

### 3.1 Document Ingestion Flow
1. Operator uploads Maximo PDFs/DOCX to IBM COS bucket.
2. Operator triggers `POST /api/pipelines/run` from UI or REST.
3. Ingestion Pipeline fetches documents from COS.
4. Text extracted (pdfplumber for PDF, mammoth for DOCX).
5. Text chunked (400-char window, 50-char overlap, sentence-boundary preferred).
6. IBM watsonx AI generates dense vector embeddings (`ibm/slate-30m-english-rtrvr-v2`, 512 token limit).
7. Chunks bulk-indexed into OpenSearch `maximo-documents` index.

### 3.2 Query Flow
1. User submits natural-language query in chat UI.
2. Frontend POSTs to MCP Server `/api/query`.
3. MCP Server routes query: Maximo live API vs RAG (keyword scoring).
4. Concurrent fan-out: OpenSearch hybrid search (BM25 + kNN), Maximo REST API, optional Kafka stream.
5. IBM watsonx AI Granite generates grounded answer with citations.
6. Response returned with source references and optional Action Center artifact creation.

### 3.3 Action Center Flow
1. Bob detects that a response represents a significant Investigation, Analysis, Report, or Recommendation.
2. Bob creates a persistent Action Center record with a unique `actionId` and `actionType`.
3. Chat UI surfaces an Action Card with "Open in Action Center →" link.
4. User navigates to `/action-center/:actionId` for the full dynamic detail page.
5. User can create Tasks, manage lifecycle status, and review evidence with full traceability.

---

## 4. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | A Reliability Engineer can ask a natural-language question and receive a grounded answer with cited sources within 10 seconds under normal load. |
| AC-002 | Document ingestion pipeline successfully processes PDF and DOCX files from IBM COS and indexes them in OpenSearch. |
| AC-003 | MCP Server correctly routes asset/work-order queries to Maximo live API and documentation queries to OpenSearch RAG. |
| AC-004 | Action Center displays all AI-generated artifacts (Investigations, Analyses, Reports, Recommendations, Tasks) with correct status and lifecycle. |
| AC-005 | All UI components use IBM Carbon Design System v11 components exclusively; no custom CSS-only components for structural layout. |
| AC-006 | The system deploys successfully to IBM Cloud Code Engine with three independent applications. |
| AC-007 | Kafka integration gracefully degrades when `KAFKA_BOOTSTRAP_SERVERS` is not configured (returns `configured: false`, not an error). |
| AC-008 | OpenSearch hybrid search returns relevant results for both keyword and semantic queries. |
| AC-009 | All Action Center items include full evidence traceability back to the originating chat conversation and source documents. |
| AC-010 | The frontend application passes WCAG 2.1 AA accessibility requirements (inherited from IBM Carbon). |

---

## 5. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENSEARCH_HOST` | e.g. `https://localhost:9200` | Yes |
| `OPENSEARCH_USERNAME` | OpenSearch admin username | Yes |
| `OPENSEARCH_PASSWORD` | OpenSearch admin password | Yes |
| `WATSONX_API_KEY` | IBM Cloud API key with watsonx access | Yes |
| `WATSONX_PROJECT_ID` | watsonx AI project GUID | Yes |
| `WATSONX_URL` | e.g. `https://us-south.ml.cloud.ibm.com` | Yes |
| `MAXIMO_URL` | Maximo Manage base URL | Yes |
| `MAXIMO_API_KEY` | Maximo REST API key | Yes |
| `COS_API_KEY` | IBM COS API key | Yes |
| `COS_BUCKET_NAME` | COS bucket containing documents | Yes |
| `COS_ENDPOINT` | COS endpoint URL | Yes |
| `COS_BUCKET_INSTANCE_CRN` | COS service instance CRN | Yes |
| `KAFKA_BOOTSTRAP_SERVERS` | Confluent bootstrap servers | No |
| `KAFKA_API_KEY` | Confluent API key | No |
| `KAFKA_API_SECRET` | Confluent API secret | No |

---

## 6. Skill References

- **`opensearch-vector-search`** — Use for implementing the hybrid search (BM25 + kNN vector) index setup, query DSL, and embedding pipeline against IBM watsonx.data OpenSearch. Apply to both `maximo-documents` and `maximo_web_knowledge` indices.
- **`data-streaming-confluent`** — Use for configuring the optional Confluent Kafka integration in the MCP Server for real-time asset event streaming and failure alerting. Covers AdminClient connection test, topic listing, SASL/SSL authentication, and graceful degradation when not configured.
