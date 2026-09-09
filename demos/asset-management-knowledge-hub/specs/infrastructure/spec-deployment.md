# SPEC-010 — Deployment

**Version:** 1.0  
**Status:** Approved  
**Domain:** Asset Management  

---

## 1. Business Requirements

| ID | Requirement |
|----|-------------|
| BR-001 | The system must deploy as three independent containerized services to IBM Cloud Code Engine. |
| BR-002 | A single script (`deploy-all.sh`) must orchestrate the full deployment in dependency order. |
| BR-003 | Individual service scripts must support `--build-only`, `--deploy-only`, and `--local` flags. |
| BR-004 | All credentials must be managed via environment variables and IBM Cloud Code Engine secrets — no hardcoded values in container images. |
| BR-005 | The Frontend UI nginx container must receive the live MCP Server and Ingestion Pipeline URLs dynamically at deploy time (not build time). |
| BR-006 | Local development must be startable with a single `python start.py` command. |

---

## 2. IBM Cloud Code Engine Services

| CE App Name | Dockerfile | Port | Source |
|-------------|-----------|------|--------|
| `maximo-knowledge-hub` | `Dockerfile` | 8080 | `frontend/` (nginx + React SPA) |
| `mcp-server` | `Dockerfile.mcp-server` | 6868 | `backend/mcp_server/` |
| `ingestion-pipeline` | `Dockerfile.ingestion` | 8080 | `backend/ingestion_pipeline/` |

### 2.1 Deployment Order

```
1. Deploy ingestion-pipeline → get live URL
2. Deploy mcp-server → get live URL
3. Deploy maximo-knowledge-hub (inject MCP + ingestion URLs into nginx config)
```

---

## 3. Local Development

### 3.1 Quick Start

```bash
# 1. Configure credentials
cp deployment/.env.deploy.example deployment/.env.deploy
# Fill in all CHANGE_ME values

# 2. Install dependencies
cd backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

cd ../frontend && npm install && cd ..

# 3. Start local OpenSearch
docker compose -f deployment/docker-compose.yml up -d

# 4. Create OpenSearch indices
./backend/opensearch/setup-indexes.sh

# 5. Start all services
cd backend
python start.py
```

### 3.2 `start.py` Flags

| Flag | Effect |
|------|--------|
| `--debug` | Verbose Python logging |
| `--no-ui` | Skip the React frontend |
| `--no-health-check` | Skip startup health polling |

### 3.3 Service URLs (local)

| Service | URL |
|---------|-----|
| Frontend UI | http://localhost:3002 |
| MCP Server | http://localhost:6868 |
| Ingestion Pipeline | http://localhost:8000 |
| OpenSearch | http://localhost:9200 |

---

## 4. IBM Cloud Code Engine Deploy

### 4.1 Deploy All

```bash
cp deployment/.env.deploy.example deployment/.env.deploy
# Edit .env.deploy — fill all CHANGE_ME values

./deployment/deploy-all.sh
```

### 4.2 Individual Service Deploy

Each service script supports:

```bash
# Full build → push → deploy (default)
./deployment/deploy-mcp-server.sh

# Build + push only (no CE deploy)
./deployment/deploy-mcp-server.sh --build-only

# Re-deploy existing image (no rebuild)
./deployment/deploy-mcp-server.sh --deploy-only

# Tag a specific version
./deployment/deploy-mcp-server.sh --tag v1.2.3

# Test locally with Podman (no IBM Cloud required)
./deployment/deploy-mcp-server.sh --local
```

Same flags apply to `deploy-ingestion.sh` and `deploy.sh` (frontend).

---

## 5. nginx Reverse Proxy (Frontend)

The frontend container is an nginx server that:
1. Serves the static React SPA for all non-API routes.
2. Reverse-proxies `/api/query`, `/api/actions`, `/api/status` → MCP Server Code Engine URL.
3. Reverse-proxies `/api/pipelines` → Ingestion Pipeline Code Engine URL.

`deploy-all.sh` injects `$MCP_SERVER_URL` and `$INGESTION_URL` into the nginx configuration template at deploy time.

---

## 6. Environment Variables Reference

See [SPEC-001 §5](./spec-001-system-overview.md#5-environment-variables) for the full list.

---

## 7. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-001 | `python start.py` starts all three services locally and they are reachable at their respective ports. |
| AC-002 | `./deployment/deploy-all.sh` successfully deploys all three Code Engine applications in dependency order. |
| AC-003 | The frontend proxies API requests to the correct Code Engine URLs for MCP Server and Ingestion Pipeline. |
| AC-004 | No credentials are hardcoded in Dockerfiles or build artifacts — all secrets come from environment variables at runtime. |
| AC-005 | `--build-only` flag builds and pushes the container image without triggering a Code Engine re-deployment. |
| AC-006 | `--local` flag runs the container with Podman on the local machine for smoke testing before cloud deployment. |
