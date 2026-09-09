# Asset Management Knowledge Hub — Python Refactor

> **Note:** The original JavaScript/TypeScript code is preserved in `../old_code/`.
> This directory contains the fully refactored Python implementation.

---

## How services relate to each other

```
User (browser)
      │  HTTP
      ▼
┌─────────────────────────────────────┐
│  End User UI  (port 3002)           │  React + IBM Carbon
│  frontend/                          │  npm run dev
└──────────────┬──────────────────────┘
               │ POST /api/query
               ▼
┌─────────────────────────────────────┐
│  MCP Server  (port 6868)            │  FastAPI — THE brain
│  backend/mcp_server/                │  python -m mcp_server
│                                     │
│  Fans out concurrently to:          │
│    • Maximo Live API  (REST)        │
│    • maximo-documents index         │◀── written by Ingestion Pipeline
│    • maximo_web_knowledge index     │◀── written by Spiderbot (one-shot)
└──────────────────────────────────────┘
               ▲           ▲
               │           │
┌──────────────┴──┐  ┌─────┴───────────────┐
│ Ingestion       │  │ Spiderbot (CLI)      │
│ Pipeline        │  │ backend/spiderbot/   │
│ (port 8000)     │  │ python -m spiderbot  │
│ backend/        │  │ crawl                │
│ ingestion_      │  │                      │
│ pipeline/       │  │ Run ONCE to populate │
└─────────────────┘  │ web-knowledge index  │
Triggered via UI     └──────────────────────┘
or POST /api/
pipelines/run
```

**TL;DR — start everything with one command:**

```bash
cd backend
python start.py
```

---

## Quick Start

### 1 — Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Node.js | ≥ 18 (for the React UI) |
| Docker | any recent version (for OpenSearch) |

### 2 — Environment

```bash
# Copy the template and fill in your credentials
cp old_code/.env.example .env
```

The single `.env` at the repository root is read by **all** services. Key variables:

| Variable | Description |
|----------|-------------|
| `OPENSEARCH_HOST` | e.g. `https://localhost:9200` |
| `OPENSEARCH_PASSWORD` | OpenSearch admin password |
| `WATSONX_API_KEY` | IBM Cloud API key |
| `WATSONX_PROJECT_ID` | WatsonX project GUID |
| `MAXIMO_URL` | Maximo Manage base URL |
| `MAXIMO_API_KEY` | Maximo REST API key |
| `COS_API_KEY` | IBM COS API key |
| `COS_BUCKET_NAME` | COS bucket name |
| `VITE_MCP_SERVER_URL` | MCP server URL for the React UI (default: `http://localhost:6868`) |

### 3 — Install dependencies

```bash
cd backend

# Python
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium   # only needed if you will run the spiderbot

# Node (UI)
cd ui && npm install && cd ..
```

### 4 — Start OpenSearch

```bash
docker compose -f ../old_code/docker-compose.yml up -d
```

---

## Starting all services together (recommended)

```bash
cd backend
python start.py
```

This single command:
- Starts the **MCP Server** on port 6868
- Starts the **Ingestion Pipeline** on port 8000
- Starts the **End User UI** (`npm run dev`) on port 3000
- Streams colour-coded logs from all three to the same terminal
- Auto-restarts any service that exits unexpectedly
- Prints health-check status once servers are ready
- Stops everything cleanly on `Ctrl+C`

**Flags:**

| Flag | Effect |
|------|--------|
| `--no-ui` | Skip the React UI (useful on a headless server) |
| `--debug` | Enable verbose logging from Python services |
| `--no-health-check` | Skip the startup health-check polling |

```bash
python start.py --debug          # verbose mode
python start.py --no-ui          # Python services only
```

### Stopping

```bash
python stop.py    # kills processes on ports 6868, 8000, 3000
```

---

## Running services individually

Use this only when you need to restart or debug a single service:

```bash
# MCP Server alone
python -m mcp_server --port 6868 --debug

# Ingestion Pipeline alone
python -m ingestion_pipeline --port 8000

# UI alone
cd ui && npm run dev
```

---

## Spiderbot — populate the web-knowledge index (one-shot)

The spiderbot is **not** a long-running server. Run it once (or on a schedule)
to crawl IBM docs, community blogs, and Maximo Secrets into OpenSearch.

```bash
# Full crawl of all 10 configured sites
python -m spiderbot crawl

# Dry run — see what would be crawled without writing anything
python -m spiderbot crawl --dry-run

# Crawl only sites whose label contains "MAS CLI"
python -m spiderbot crawl --filter "MAS CLI"

# Force re-crawl of pages already in the index
python -m spiderbot crawl --force

# Check current index statistics
python -m spiderbot stats
```

---

## Project Layout

```
code/
├── start.py                        ← START HERE — launches everything
├── stop.py                         ← Stops all services
│
├── shared/                         # Shared infrastructure
│   ├── config/     __init__.py     — typed config singletons from root .env
│   ├── logging/    __init__.py     — get_logger() factory
│   ├── opensearch/ __init__.py     — shared build_client() (no duplication)
│   └── watsonx/    __init__.py     — WatsonXClient: IAM, generate(), embed()
│
├── mcp_server/                     # MCP + REST API  (port 6868)
│   ├── __main__.py
│   └── src/
│       ├── handlers/   tool_handlers.py, resource_handlers.py
│       ├── services/   opensearch_service.py, maximo_service.py
│       └── server/     http_server.py  (FastAPI, CORS, /api/query)
│
├── spiderbot/                      # Web crawler  (CLI, one-shot)
│   ├── __main__.py
│   └── src/
│       ├── crawler/    site_registry.py, page_crawler.py
│       ├── indexer/    text_chunker.py, opensearch_indexer.py
│       └── pipeline/   crawl_pipeline.py
│
├── ingestion_pipeline/             # Document ingestion  (port 8000)
│   ├── __main__.py
│   └── src/
│       ├── api/        server.py  (FastAPI, /api/pipelines/run)
│       └── services/   cos_service.py, document_processor_service.py,
│                       opensearch_service.py, document_registry_service.py
│
├── ui/                             # React/Vite chat UI  (port 3000)
│   ├── src/            IBM Carbon components
│   └── package.json
│
├── pyproject.toml
├── requirements.txt
└── requirements-dev.txt
```

---

## Design Principles

| Principle | How it is applied |
|-----------|-------------------|
| **Single responsibility** | Each module owns exactly one concern. |
| **DRY** | Config, logging, WatsonX, and OpenSearch client defined once in `shared/`. |
| **Single launch point** | `start.py` manages all processes — no shell scripts or separate terminals needed. |
| **Async handlers** | All MCP tool handlers are `async def` for non-blocking I/O. |
| **Separation of concerns** | HTTP wiring in `server/`, business logic in `services/`, routing in `handlers/`. |

---

## Running tests

```bash
pip install -r requirements-dev.txt
pytest
```
