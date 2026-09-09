# Asset Management Knowledge Hub — Specs

Canonical specification files for the **IBM Asset Management Knowledge Hub** application.  
Each spec is self-contained: an implementer can read it alone and build the described capability.

---

## Folder Structure

```
specs/
├── README.md                                    ← this file
│
├── overview/
│   └── spec-system-overview.md                  ← architecture, data flows, env vars
│
├── backend/
│   ├── spec-backend-mcp-server.md               ← MCP Server (FastAPI, AI brain)
│   ├── spec-backend-ingestion-pipeline.md       ← COS → parse → embed → index
│   └── spec-backend-spiderbot.md                ← Playwright web crawler
│
├── frontend/
│   ├── spec-frontend-knowledge-hub.md           ← Chat UI (IBM Carbon)
│   ├── spec-frontend-action-center.md           ← Action Center + detail pages
│   └── spec-frontend-navigation-scheduled-jobs.md ← Nav groups + Scheduled Jobs page
│
├── infrastructure/
│   ├── spec-opensearch-vector-search.md         ← Index mappings, hybrid search, kNN
│   ├── spec-data-streaming-confluent.md         ← Confluent Kafka integration
│   └── spec-deployment.md                       ← Local + IBM Cloud Code Engine
│
└── archive/                                     ← original architecture/ files (read-only)
    ├── archived-spec-action-center.md
    ├── archived-spec-navigation-scheduled-jobs.md
    ├── archived-v1.0-action-center-detail-fixes.md
    ├── archived-bob-instruction-detail-pages.md
    └── archived-bob-instruction-evidence-panel.md
```

---

## Spec Index

### Overview

| File | Description | Skills |
|------|-------------|--------|
| [spec-system-overview.md](./overview/spec-system-overview.md) | Full system architecture, data flows, environment variables, acceptance criteria | `opensearch-vector-search` · `data-streaming-confluent` |

---

### Backend

| File | Description | Skills |
|------|-------------|--------|
| [spec-backend-mcp-server.md](./backend/spec-backend-mcp-server.md) | MCP Server: query routing, OpenSearch hybrid search, Maximo REST API, Kafka, watsonx AI answer generation | `opensearch-vector-search` · `data-streaming-confluent` |
| [spec-backend-ingestion-pipeline.md](./backend/spec-backend-ingestion-pipeline.md) | Ingestion Pipeline: IBM COS → parse (PDF/DOCX) → chunk → embed → bulk index | `opensearch-vector-search` |
| [spec-backend-spiderbot.md](./backend/spec-backend-spiderbot.md) | Spiderbot: Playwright crawler, IBM Docs + community knowledge, incremental dedup | `opensearch-vector-search` |

---

### Frontend

| File | Description | Skills |
|------|-------------|--------|
| [spec-frontend-knowledge-hub.md](./frontend/spec-frontend-knowledge-hub.md) | Knowledge Hub chat UI: application shell, chat messages, source citations, Action Card, Data Ingestion page, Settings | IBM Carbon v11 |
| [spec-frontend-action-center.md](./frontend/spec-frontend-action-center.md) | Action Center: list page, 5 detail page types, Evidence Side Panel, Create Task modal, lifecycle states | IBM Carbon v11 |
| [spec-frontend-navigation-scheduled-jobs.md](./frontend/spec-frontend-navigation-scheduled-jobs.md) | Navigation groupings (6 groups), Scheduled Jobs page with human-readable cron descriptions | IBM Carbon v11 |

---

### Infrastructure

| File | Description | Skills |
|------|-------------|--------|
| [spec-opensearch-vector-search.md](./infrastructure/spec-opensearch-vector-search.md) | Index mappings (knn_vector 384-dim HNSW), hybrid search query DSL, client config, index setup scripts | `opensearch-vector-search` |
| [spec-data-streaming-confluent.md](./infrastructure/spec-data-streaming-confluent.md) | Confluent Kafka config, AdminClient, topic listing, SASL/SSL auth, graceful degradation | `data-streaming-confluent` |
| [spec-deployment.md](./infrastructure/spec-deployment.md) | Local quickstart, IBM Cloud Code Engine deploy scripts, nginx reverse proxy | — |

---

## Skills Quick Reference

### `opensearch-vector-search`
Use when implementing:
- OpenSearch index creation with `knn_vector` mapping (384-dim, HNSW via `nmslib`)
- Hybrid search (BM25 + kNN) query DSL
- IBM watsonx AI embedding generation with `ibm/slate-30m-english-rtrvr-v2`
- Document chunking (400-char window, 50-char overlap), batch embedding, bulk indexing
- Index management and setup scripts

**Applies to:** system overview, MCP server, ingestion pipeline, spiderbot, opensearch spec

---

### `data-streaming-confluent`
Use when implementing:
- Confluent Kafka `AdminClient` — connection test and topic listing
- SASL/SSL authentication (`SASL_SSL` protocol, `PLAIN` mechanism)
- Maximo event topic consumers (`maximo.assets`, `maximo.failures`, `maximo.work-orders`)
- Graceful degradation when `KAFKA_BOOTSTRAP_SERVERS` is not configured
- Confluent Cloud API key setup via Confluent CLI

**Applies to:** system overview, MCP server, Confluent Kafka spec

---

## Implementation Order

### Backend
1. **[spec-opensearch-vector-search.md](./infrastructure/spec-opensearch-vector-search.md)** — provision indices first (nothing can be indexed without them)
2. **[spec-backend-ingestion-pipeline.md](./backend/spec-backend-ingestion-pipeline.md)** — populate `maximo-documents`
3. **[spec-backend-spiderbot.md](./backend/spec-backend-spiderbot.md)** — populate `maximo_web_knowledge`
4. **[spec-backend-mcp-server.md](./backend/spec-backend-mcp-server.md)** — central AI brain (depends on OpenSearch + Maximo)
5. **[spec-data-streaming-confluent.md](./infrastructure/spec-data-streaming-confluent.md)** — optional real-time events

### Frontend
1. Application shell — global header + Carbon `SideNav` with groups from **[spec-frontend-navigation-scheduled-jobs.md](./frontend/spec-frontend-navigation-scheduled-jobs.md)**
2. **[spec-frontend-knowledge-hub.md](./frontend/spec-frontend-knowledge-hub.md)** — primary chat UI
3. **[spec-frontend-action-center.md](./frontend/spec-frontend-action-center.md)** — list + detail pages + evidence panel
4. **[spec-frontend-navigation-scheduled-jobs.md](./frontend/spec-frontend-navigation-scheduled-jobs.md)** — Scheduled Jobs page

### Deployment
- **[spec-deployment.md](./infrastructure/spec-deployment.md)** — local dev then IBM Cloud Code Engine
