# Asset Management Knowledge Hub

**Core Capability**: Asset Management
**IBM Products**: IBM Maximo Application Suite, IBM watsonx AI, IBM watsonx.data (OpenSearch), IBM Cloud Object Storage, IBM Cloud Code Engine
**Product Components**: MCP Server (FastAPI); Ingestion Pipeline (FastAPI); Spiderbot (Playwright web crawler); React + IBM Carbon UI; IBM IAM

## Overview

A full-stack AI-powered knowledge hub for **IBM Maximo Application Suite** — ingest Maximo documentation, community knowledge, and live operational data from IBM Cloud Object Storage; generate dense embeddings with **IBM watsonx AI**; index everything in **IBM watsonx.data OpenSearch**; and serve hybrid search (vector + BM25) and natural-language Q&A through a conversational **IBM Carbon Design System** UI.

Three independent services work together:

| Service | What it does | Port |
|---|---|---|
| **MCP Server** | THE brain — fans out to Maximo Live API, OpenSearch knowledge index, web-knowledge index, ServiceNow, and Kafka | `6868` |
| **Ingestion Pipeline** | REST API that ingests PDFs, DOCX, and other documents from IBM COS into OpenSearch | `8000` |
| **Frontend UI** | IBM Carbon React SPA — chat interface, document explorer, ingestion controls, audit log | `3002` |

A fourth utility, **Spiderbot**, is a one-shot Playwright web crawler that populates the web-knowledge OpenSearch index from IBM Docs, community blogs, and [Maximo Secrets](https://maximosecrets.com).

---

## When to Use

| Scenario | What to do |
|---|---|
| Stand up a Maximo knowledge assistant from scratch | Follow the **Quick Start** below — one command starts everything |
| Ingest a new batch of Maximo PDFs or DOCX from IBM COS | Trigger `POST /api/pipelines/run` via the UI or directly on the Ingestion Pipeline |
| Populate web knowledge from IBM Docs and community sites | Run `python -m spiderbot crawl` once |
| Deploy to IBM Cloud for production | Follow the **Cloud Deployment** section — three Code Engine apps |
| Ask a natural-language question about your Maximo environment | Use the chat UI at `http://localhost:3002` |
| Integrate Maximo knowledge into IBM Bob or another AI assistant | Connect Bob to the MCP Server endpoint (`http://localhost:6868`) |

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Python | ≥ 3.11 |
| Node.js | ≥ 18 |
| Docker or Podman | any recent version (for local OpenSearch) |

And the following IBM Cloud / SaaS credentials:

| Credential | Where to get it |
|---|---|
| IBM Cloud API key | [IBM Cloud IAM](https://cloud.ibm.com/iam/apikeys) |
| IBM watsonx AI Project ID + URL | watsonx.ai console |
| IBM watsonx.data OpenSearch host / username / password | IBM watsonx.data service credentials |
| IBM Cloud Object Storage API key + bucket + endpoint | IBM COS service credentials |
| Maximo URL + API key | Maximo Application Suite → Security → API Keys |

### Quick Start — local development

#### 1 — Clone and configure

```bash
# Copy the secrets template and fill in your credentials
cp deployment/.env.deploy.example deployment/.env.deploy
```

Key environment variables (read by all three services):

| Variable | Description |
|---|---|
| `OPENSEARCH_HOST` | e.g. `https://localhost:9200` |
| `OPENSEARCH_USERNAME` | OpenSearch admin username |
| `OPENSEARCH_PASSWORD` | OpenSearch admin password |
| `WATSONX_API_KEY` | IBM Cloud API key with watsonx access |
| `WATSONX_PROJECT_ID` | watsonx AI project GUID |
| `WATSONX_URL` | watsonx AI endpoint, e.g. `https://us-south.ml.cloud.ibm.com` |
| `MAXIMO_URL` | Maximo Manage base URL |
| `MAXIMO_API_KEY` | Maximo REST API key |
| `COS_API_KEY` | IBM COS API key |
| `COS_BUCKET_NAME` | COS bucket containing Maximo documents |
| `COS_ENDPOINT` | COS endpoint URL |
| `COS_BUCKET_INSTANCE_CRN` | COS service instance CRN |

#### 2 — Install dependencies

```bash
# Python backend
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium    # only required for Spiderbot

# React frontend
cd frontend && npm install && cd ..
```

#### 3 — Start OpenSearch (local Docker)

```bash
docker compose -f deployment/docker-compose.yml up -d
```

#### 4 — Start all services with one command

```bash
cd backend
python start.py
```

This starts the **MCP Server** (port 6868), **Ingestion Pipeline** (port 8000), and **Frontend UI** (port 3002) in a single terminal with colour-coded, interleaved logs. Use `Ctrl+C` to stop everything cleanly, or run `python stop.py` from another terminal.

Available flags:

| Flag | Effect |
|---|---|
| `--debug` | Verbose Python logging |
| `--no-ui` | Skip the React UI (headless / server mode) |
| `--no-health-check` | Skip startup health-check polling |

Open the chat UI at **http://localhost:3002** and ask your first question.

---

## Building Blocks

### 1. MCP Server
**Location**: `backend/mcp_server/`
**IBM Products**: IBM watsonx AI, IBM watsonx.data (OpenSearch), IBM Maximo Application Suite, ServiceNow
**Description**: The central brain of the Knowledge Hub. Exposes a FastAPI REST endpoint (`POST /api/query`) that accepts a natural-language prompt, fans out concurrently to Maximo Live REST API, the document knowledge index (`maximo-documents`), and the web-knowledge index (`maximo_web_knowledge`), then returns a grounded, cited answer generated by IBM watsonx AI Granite.

**Services wired in:**
- `opensearch_service.py` — hybrid search (vector + BM25) against both OpenSearch indexes
- `maximo_service.py` — live Maximo Manage REST API queries (assets, work orders, service requests)
- `servicenow_service.py` — optional ServiceNow integration
- `kafka_service.py` — optional Confluent/Apache Kafka event stream integration
- `instance_registry.py` — multi-tenant Maximo instance routing

**Run alone:**
```bash
python -m mcp_server --port 6868 --debug
```

---

### 2. Ingestion Pipeline
**Location**: `backend/ingestion_pipeline/`
**IBM Products**: IBM Cloud Object Storage, IBM watsonx AI, IBM watsonx.data (OpenSearch)
**Description**: FastAPI service that pulls documents from an IBM COS bucket, parses PDFs and DOCX files, chunks the content, generates IBM watsonx AI embeddings (`ibm/slate-30m-english-rtrvr-v2`), and bulk-indexes the result into OpenSearch. Triggered from the UI or via REST.

**API Endpoints:**

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/pipelines/run` | Start an ingestion run from an IBM COS bucket |
| `GET`  | `/api/pipelines/status` | Poll the status of the running ingestion job |
| `GET`  | `/health` | Service health check |

**Run alone:**
```bash
python -m ingestion_pipeline --port 8000
```

---

### 3. Spiderbot (web crawler)
**Location**: `backend/spiderbot/`
**IBM Products**: IBM watsonx AI, IBM watsonx.data (OpenSearch)
**Description**: One-shot Playwright-based web crawler. Crawls a configurable list of sites (IBM Docs, IBM Support, Maximo Secrets, community blogs) and indexes the content into the `maximo_web_knowledge` OpenSearch index. Run it once after initial setup, then re-run periodically to keep the web-knowledge index fresh.

**Commands:**
```bash
# Full crawl of all configured sites
python -m spiderbot crawl

# Dry run — preview without writing anything
python -m spiderbot crawl --dry-run

# Crawl only sites matching a label substring
python -m spiderbot crawl --filter "MAS CLI"

# Force re-crawl of already-indexed pages
python -m spiderbot crawl --force

# Show current index statistics
python -m spiderbot stats
```

---

### 4. Frontend UI
**Location**: `frontend/`
**IBM Products**: IBM Carbon Design System
**Description**: React 18 + Vite SPA built entirely with **IBM Carbon Design System** (`@carbon/react` v1). Provides a chat interface to the MCP Server, a document explorer, an ingestion trigger panel, an audit log, and architecture visualisations.

**Technologies:**
- React 18 + Vite 5
- `@carbon/react` ^1.37 + `@carbon/icons-react` ^11.25
- Axios for API calls to the MCP Server and Ingestion Pipeline

**Run alone:**
```bash
cd frontend
npm run dev
# Opens at http://localhost:3002
```

---

## Cloud Deployment

The three services are deployed as independent **IBM Cloud Code Engine** applications from the `deployment/` folder.

| Service | Script | Dockerfile | CE App Name | Port |
|---|---|---|---|---|
| Ingestion Pipeline | `deploy-ingestion.sh` | `Dockerfile.ingestion` | `ingestion-pipeline` | `8080` |
| MCP Server | `deploy-mcp-server.sh` | `Dockerfile.mcp-server` | `mcp-server` | `6868` |
| Frontend UI | `deploy.sh` | `Dockerfile` | `maximo-knowledge-hub` | `8080` |

### Deploy everything at once

```bash
# 1. Fill in your secrets
cp deployment/.env.deploy.example deployment/.env.deploy
# Edit .env.deploy — fill every CHANGE_ME value

# 2. Deploy all three in dependency order
./deployment/deploy-all.sh
```

The orchestrator deploys the Ingestion Pipeline and MCP Server first, reads their live Code Engine URLs, then injects those URLs into the nginx configuration of the Frontend UI container.

### Individual service deploy

Each script accepts the same flags:

```bash
# Full build → push → deploy
./deployment/deploy-mcp-server.sh

# Build and push only (no Code Engine deploy)
./deployment/deploy-mcp-server.sh --build-only

# Re-deploy existing image (no rebuild)
./deployment/deploy-mcp-server.sh --deploy-only

# Tag a specific version
./deployment/deploy-mcp-server.sh --tag v1.2.3

# Test locally with Podman (no IBM Cloud required)
./deployment/deploy-mcp-server.sh --local
```

See [`deployment/README.md`](deployment/README.md) for full deployment documentation and troubleshooting.

---

## Architecture

```
IBM Cloud Object Storage
  (Maximo PDFs, DOCX)
        │
        │  POST /api/pipelines/run
        ▼
Ingestion Pipeline (FastAPI, port 8000)
  IBM COS → parse → chunk → embed (watsonx AI)
        │
        │  bulk index
        ▼
IBM watsonx.data OpenSearch
  ├─ maximo-documents          ← ingested documents
  └─ maximo_web_knowledge      ← Spiderbot web crawl

                       ▲
                       │  hybrid search (vector + BM25)
                       │
User (browser)         │
  │                    │
  │  POST /api/query   │
  ▼                    │
Frontend UI (React/Carbon, port 3002)
  │
  │  POST /api/query
  ▼
MCP Server (FastAPI, port 6868)
  │
  ├─── OpenSearch hybrid search  (maximo-documents)
  ├─── OpenSearch hybrid search  (maximo_web_knowledge)
  ├─── Maximo Manage Live REST API
  ├─── ServiceNow (optional)
  └─── Kafka event stream (optional)
  │
  │  IBM watsonx AI Granite (grounded answer generation)
  ▼
Natural-language answer + source citations
```

## Deployment Architecture

```
IBM Cloud Code Engine
  ├─ maximo-knowledge-hub        (nginx — React SPA + reverse proxy)
  ├─ mcp-server                  (Python FastAPI — MCP + Knowledge API)
  └─ ingestion-pipeline          (Python FastAPI — COS document ingestion)
            │
IBM watsonx.data OpenSearch      (managed vector + keyword search)
IBM Cloud Object Storage         (document source bucket)
IBM watsonx AI                   (embeddings + generation)
```

---

## IBM Cloud References

- [IBM Maximo Application Suite Documentation](https://www.ibm.com/docs/en/mas-cd)
- [IBM watsonx AI Documentation](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-overview.html)
- [IBM watsonx.data Documentation](https://cloud.ibm.com/docs/watsonxdata)
- [IBM Cloud Object Storage Documentation](https://cloud.ibm.com/docs/cloud-object-storage)
- [IBM Cloud Code Engine Documentation](https://cloud.ibm.com/docs/codeengine)
- [IBM Carbon Design System](https://carbondesignsystem.com)
- [IBM Cloud IAM API Keys](https://cloud.ibm.com/iam/apikeys)
