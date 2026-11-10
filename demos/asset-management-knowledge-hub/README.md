# Asset Management Knowledge Hub

> **Demonstration application — not security-hardened for production.**
> This asset shows how IBM building blocks fit together. It has had a targeted
> fix for an unauthenticated server-side request forgery (SSRF) report, but it has
> not had a full security assessment, penetration test or threat model. Do not
> expose it to the internet, or connect it to production Maximo data, until you have
> completed the [production-readiness checklist](#security-notes-and-known-limits).

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
| `API_KEY` | **Required.** Shared secret for the MCP Server and Ingestion Pipeline; requests without a matching `X-API-Key` get `401`. Also put it in the root `.env` for local dev (the Vite proxy adds it) and in `deployment/.env.deploy` for deployments. Letters, digits, `_`, `-` only (`openssl rand -hex 32`). |
| `ADMIN_API_KEY` | **Required to ingest or delete.** Second secret the Ingestion Pipeline requires (`X-Admin-Key`) on every route that starts a job or changes the index. nginx sends it only for `UI_USERNAME`. Put it in the root `.env` for local dev (the Vite proxy adds it). Must differ from `API_KEY`. |
| `UI_USERNAME` / `UI_PASSWORD` | **Required for the deployed UI.** The administrator login: nginx enforces HTTP basic auth on the whole site (the old client-side login that accepted anything was removed). Not needed for local `npm run dev`. |
| `UI_VIEWER_USERNAME` / `UI_VIEWER_PASSWORD` | *Optional.* Read-only login. Can search and chat; ingestion and delete are refused with `403`. |
| `CORS_ORIGIN` | Frontend origin(s) allowed to call the backends (comma-separated). No longer `*`. |
| `CRAWL_ALLOWED_HOSTS` | *Optional.* Approved web-crawl domains (`*.` wildcards ok). Blank = `ibm.com`, `*.ibm.com`, `maximosecrets.com`, `*.maximosecrets.com`. Private, loopback, link-local, cloud-metadata and cluster-internal targets are always refused. |
| `INGEST_RATE_LIMIT_MAX` / `INGEST_RATE_LIMIT_WINDOW` | *Optional.* Job submissions allowed per client per window (defaults: `10` per `60` seconds). Excess requests get `429` with `Retry-After`. |

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

## Security notes and known limits

This asset is a **demonstration**. The following controls exist after the SSRF fix:

| Area | What is in place |
|---|---|
| Authentication | `API_KEY` on both backends (fails closed); nginx basic auth in front of the UI |
| Authorization | Ingestion and delete routes also need `ADMIN_API_KEY`; only the administrator login receives it |
| Crawl sources | Approved-domain list (`CRAWL_ALLOWED_HOSTS`), enforced on request (`422`) and again on every fetch and redirect |
| SSRF guard | Private, loopback, link-local, cloud-metadata, reserved and CGNAT ranges; internal names (`localhost`, `*.svc`, `*.cluster.local`, `*.internal`, container-host aliases); container and cluster management ports; DNS pinned to the vetted IP; every redirect re-checked |
| Abuse limits | Per-client rate limit, cap on running jobs, request, page, depth, size and chunk limits |
| Logging | Each accepted submission (`event=ingest_submitted`), rejected URL (`ingest_url_rejected`), rate-limited request (`ingest_rate_limited`) and denied request (`Request denied`, `401`/`403`) is logged with client address, user and route. Secrets are never logged |

Known limits you must address before any real deployment:

- **No per-user identity.** Access is two shared secrets and one or two shared UI logins, not single sign-on, roles or MFA.
- **Rate limiter is in memory.** It is per process, resets on restart and is not shared between replicas. Put a gateway or WAF limit in front.
- **Audit log is application stdout.** It is not tamper-evident, and nothing alerts on it. Ship it to a log platform and add alerts on repeated `401`/`403`/`429` and `ingest_url_rejected`.
- **Network controls are out of scope.** Make the Code Engine apps private, restrict egress (block `169.254.169.254` and internal ranges at the network layer), and place the OpenSearch cluster on a private endpoint.
- **Secrets are environment variables.** Rotate them, keep them out of source control, and use a secrets manager.
- **Default approved domains are broad.** `*.ibm.com` covers many sites that host user-generated content. Narrow `CRAWL_ALLOWED_HOSTS` to the exact hosts you need.
- **Crawled text is untrusted.** It is fenced in the LLM prompt and HTML is escaped when shown, but retrieval-poisoning risk remains, so review what is indexed.
- **No automated tests or security scans were added** with this change. Run your own SAST, dependency and container scans.

---

## IBM Cloud References

- [IBM Maximo Application Suite Documentation](https://www.ibm.com/docs/en/mas-cd)
- [IBM watsonx AI Documentation](https://dataplatform.cloud.ibm.com/docs/content/wsj/analyze-data/fm-overview.html)
- [IBM watsonx.data Documentation](https://cloud.ibm.com/docs/watsonxdata)
- [IBM Cloud Object Storage Documentation](https://cloud.ibm.com/docs/cloud-object-storage)
- [IBM Cloud Code Engine Documentation](https://cloud.ibm.com/docs/codeengine)
- [IBM Carbon Design System](https://carbondesignsystem.com)
- [IBM Cloud IAM API Keys](https://cloud.ibm.com/iam/apikeys)
