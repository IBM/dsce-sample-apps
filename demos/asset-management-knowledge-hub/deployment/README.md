# Asset Management Knowledge Hub — Container Deployment

This folder contains everything needed to build, test locally with Podman, and deploy the
Asset Management Knowledge Hub to **IBM Cloud Code Engine**.

Three services are deployed as independent Code Engine applications:

| Service | Script | Dockerfile | CE App Name | Port |
|---------|--------|-----------|-------------|------|
| **Ingestion Pipeline** | `deploy-ingestion.sh` | `Dockerfile.ingestion` | `ingestion-pipeline` | 8080 |
| **MCP Server** | `deploy-mcp-server.sh` | `Dockerfile.mcp-server` | `mcp-server` | 6868 |
| **Frontend UI** | `deploy.sh` | `Dockerfile` | `maximo-knowledge-hub` | 8080 |

---

## Folder layout

```
deployment/
├── deploy-all.sh            ← Full-stack orchestrator (recommended entry point)
├── deploy-ingestion.sh      ← Ingestion Pipeline deploy
├── deploy-mcp-server.sh     ← MCP Server deploy
├── deploy.sh                ← Frontend UI deploy
│
├── Dockerfile               ← Frontend: Node 20 UBI builder → nginx UBI runtime
├── Dockerfile.mcp-server    ← MCP Server: Python 3.11 UBI
├── Dockerfile.ingestion     ← Ingestion Pipeline: Python 3.11 UBI
│
├── nginx.conf               ← nginx config template (env-var placeholders for backend URLs)
├── entrypoint.sh            ← Runs envsubst at startup, then starts nginx
├── .env.deploy.example      ← Template for all deployment secrets
└── .dockerignore            ← Excludes node_modules, secrets, etc. from build context
```

---

## Quick start — deploy everything

```bash
# 1. Copy and fill in the secrets template
cp deployment/.env.deploy.example deployment/.env.deploy
# Edit .env.deploy with your real IBM Cloud, OpenSearch, watsonx, and COS credentials

# 2. Run the full-stack deploy (Ingestion → MCP Server → UI, in dependency order)
./deployment/deploy-all.sh
```

The orchestrator automatically:
- Deploys Ingestion Pipeline first (no upstream dependencies)
- Deploys MCP Server second (no upstream dependencies)
- Reads the live Code Engine URLs for both backends
- Injects those URLs into the UI deploy so the nginx proxy knows where to route

---

## Deployment order and dependencies

```
OpenSearch ─────────────────┬──▶ Ingestion Pipeline ──────┐
                             │                             │
watsonx AI ──────────────────┤                             ▼
                             │                       Frontend UI (nginx proxy)
                             └──▶ MCP Server ──────────────┘
IBM COS ─────────────────────▶ Ingestion Pipeline
```

**Rule:** Always deploy the backend services before the UI.
The UI's nginx config embeds the backend URLs at container startup time.

---

## Service details

### Ingestion Pipeline (`deploy-ingestion.sh`)

Runs `python -m ingestion_pipeline` — the document ingestion REST API.
Initialises OpenSearch indexes on startup.

**Runtime env vars required:**

| Variable | Description |
|----------|-------------|
| `OPENSEARCH_HOST` | OpenSearch cluster URL |
| `OPENSEARCH_USERNAME` | OpenSearch username |
| `OPENSEARCH_PASSWORD` | OpenSearch password |
| `WATSONX_API_KEY` | IBM watsonx AI API key |
| `WATSONX_PROJECT_ID` | watsonx project ID |
| `COS_API_KEY` | IBM COS API key |
| `COS_BUCKET_NAME` | COS bucket name |
| `COS_ENDPOINT` | COS endpoint URL |
| `COS_BUCKET_INSTANCE_CRN` | COS service instance CRN |
| `CORS_ORIGIN` | Allowed CORS origin (frontend URL) |

---

### MCP Server (`deploy-mcp-server.sh`)

Runs `python -m mcp_server` — the MCP / Knowledge Hub API on port 6868.

**Runtime env vars required:**

| Variable | Description |
|----------|-------------|
| `OPENSEARCH_HOST` | OpenSearch cluster URL |
| `OPENSEARCH_USERNAME` | OpenSearch username |
| `OPENSEARCH_PASSWORD` | OpenSearch password |
| `WATSONX_API_KEY` | IBM watsonx AI API key |
| `WATSONX_PROJECT_ID` | watsonx project ID |
| `CORS_ORIGIN` | Allowed CORS origin (frontend URL) |

---

### Frontend UI (`deploy.sh`)

Serves the Vite/Carbon React SPA via nginx and reverse-proxies API calls to the backends.
Backend URLs are injected at container startup — not baked into the image.

**Runtime env vars required:**

| Variable | Default (local) | Description |
|----------|----------------|-------------|
| `BACKEND_API_URL` | `http://host.containers.internal:6868` | MCP Server URL |
| `INGEST_API_URL` | `http://host.containers.internal:8080` | Ingestion Pipeline URL |
| `OPENSEARCH_URL` | `https://host.containers.internal:9200` | OpenSearch URL |

---

## Secrets file

All secrets live in `deployment/.env.deploy` (gitignored). Use the provided template:

```bash
cp deployment/.env.deploy.example deployment/.env.deploy
```

Edit `.env.deploy` and fill in every `CHANGE_ME` value. The file is loaded
automatically by every deploy script.

---

## Individual service deploys

Each script supports the same flags:

```bash
# Full build → push → deploy
./deployment/deploy-mcp-server.sh

# Build + push only (no Code Engine deploy)
./deployment/deploy-mcp-server.sh --build-only

# Deploy only (re-deploy the existing image, no rebuild)
./deployment/deploy-mcp-server.sh --deploy-only

# Specific tag
./deployment/deploy-mcp-server.sh --tag v1.2.3

# Local Podman test (no IBM Cloud required)
./deployment/deploy-mcp-server.sh --local
```

Same flags apply to `deploy-ingestion.sh` and `deploy.sh`.

---

## Orchestrator options (`deploy-all.sh`)

```bash
# Deploy everything in order
./deployment/deploy-all.sh

# Build + push all images (no deploy)
./deployment/deploy-all.sh --build-only

# Re-deploy all from existing images
./deployment/deploy-all.sh --deploy-only

# Deploy only backends (UI unchanged)
./deployment/deploy-all.sh --skip-ui

# Deploy only UI (backends unchanged, URLs already known)
export BACKEND_API_URL=https://mcp-server.<project>.eu-de.codeengine.appdomain.cloud
export INGEST_API_URL=https://ingestion-pipeline.<project>.eu-de.codeengine.appdomain.cloud
./deployment/deploy-all.sh --skip-ingestion --skip-mcp
```

---

## Local Podman test

### 1. Start backends locally first

```bash
# From repo root (starts MCP server + Ingestion Pipeline)
python backend/start.py --no-ui
```

### 2. Run the frontend container

```bash
./deployment/deploy.sh --local
# Opens at http://localhost:3003

# Or run each backend container separately
./deployment/deploy-mcp-server.sh --local   # http://localhost:6869
./deployment/deploy-ingestion.sh --local    # http://localhost:8081
```

---

## ICR pull secret (one-time setup per project)

Code Engine needs a pull secret to access your private ICR images.
Each deploy script creates this automatically on first run. To create it manually:

```bash
ibmcloud ce secret create \
  --name     icr-maximo-kh \
  --format   registry \
  --server   de.icr.io \
  --username iamapikey \
  --password "${IBMCLOUD_API_KEY}"
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `502 Bad Gateway` on `/api/*` | `BACKEND_API_URL` wrong or MCP Server not deployed | Deploy MCP Server first; check URL |
| `502 Bad Gateway` on `/ingest-api/*` | `INGEST_API_URL` wrong or Ingestion Pipeline not deployed | Deploy Ingestion Pipeline first |
| Blank page / JS 404 | Build context wrong, `dist/` not copied | Run `deploy.sh` from repo root, not `frontend/` |
| Python import errors at startup | Wrong `WORKDIR` or missing `shared/` package | Ensure `COPY backend/` copies the full backend tree |
| `envsubst: command not found` | Wrong UBI image variant | Use `ubi9/nginx-122` for UI (gettext is pre-installed) |
| ICR push `unauthorized` | Not logged in | Run `ibmcloud cr login` |
| OpenSearch `Connection refused` | Wrong `OPENSEARCH_HOST` | Check URL includes `https://` and port |
