# Requirements: Rancher Desktop Containerization

**Source spec:** `specifications/7-containerize-rancher.md`  
**Scope:** Docker Compose stack running all three services locally under Rancher Desktop (dockerd/moby engine). Native `npm start` workflows must continue to work alongside containers — no code changes may break the non-containerized path.

---

## 1. Overview

Provide a `docker-compose.yml` under `rancher/` that starts three services:

| Service | Image source | Published port |
|---|---|---|
| `frontend` | `rancher/Dockerfile.frontend` | `3000 → 80` (nginx) |
| `backend` | `rancher/Dockerfile.backend` | `3001 → 3001` |
| `opensearch` | `opensearchproject/opensearch:2.13.0` | `9200 → 9200` |

**Container engine:** Rancher Desktop must be configured to use the **dockerd (moby)** engine, not containerd. All `docker` and `docker compose` CLI commands assume this engine.

All container-related files live under `rancher/`. No container files are placed in `frontend/`, `backend/`, or `vector-db/`.

---

## 2. Environment Variables

### What changes between local and container runs

| Variable | Local (native) | Rancher (containers) | Notes |
|---|---|---|---|
| `VITE_BACKEND_URL` | `http://localhost:3001` | `http://localhost:3001` | **Unchanged.** Resolved by the browser against the published Docker port. Never set to a container service name. |
| `BACKEND_SERVER_URL` | `http://localhost:3001` | `http://backend:3001` | Used server-side only. Must use the Docker service name in containers. |
| `OPENSEARCH_HOST` | `localhost` | `opensearch` | Docker service name replaces localhost. |
| `OPENSEARCH_PORT` | `9200` | `9200` | Unchanged. |
| `OPENSEARCH_INDEX` | `products` | `products` | Unchanged. |

### Variables that do NOT change

All other `.env` variables (`DB_*`, `JWT_SECRET`, `WO_*`, `IBMCLOUD_API_KEY`, `ICR_*`, `ROKS_*`, `OCP_*`, `PASSWORD_HASH_SECRET`, `SESSION_SECRET`, etc.) are injected into the backend container unchanged. The `frontend` container only receives `VITE_BACKEND_URL` — all `VITE_*` variables are baked into the build at image build time, not at runtime.

### Critical constraint — `VITE_BACKEND_URL`

`VITE_BACKEND_URL` is embedded into the browser bundle by Vite at **build time**. Its value must be `http://localhost:3001` for both local and Rancher environments because the browser resolves it against the host machine, not the Docker network. Setting it to `http://backend:3001` would cause every API call from the browser to fail — the browser cannot resolve internal Docker service names.

---

## 3. Directory Structure

All files created by this spec live under `rancher/`:

```
rancher/
├── Dockerfile.frontend          # Multi-stage: node:20-alpine builder → nginx:alpine
├── Dockerfile.backend           # Single-stage: node:20-alpine
├── docker-compose.yml           # Orchestrates frontend, backend, opensearch
├── nginx.conf                   # nginx config for the frontend container
├── .env.docker.example          # Template — no real credentials; committed to git
└── docs/
    ├── quickstart.md            # Build and run instructions (≤ 4 pages)
    ├── architecture.md          # Service topology, port map, networking (≤ 4 pages)
    └── troubleshooting.md       # Common failures and fixes (≤ 4 pages)
```

`.env` stays at the repo root and is never committed. `rancher/.env.docker.example` is committed as a template.

---

## 4. Services to Containerize

### 4.1 `frontend`

- **Purpose:** Serves the React/Vite SPA as pre-built static files.
- **Build context:** repo root (needs access to `frontend/`).
- **Dockerfile:** `rancher/Dockerfile.frontend`.
- **Build-time arg:** `VITE_BACKEND_URL` — must be passed as a Docker build arg so Vite can embed it during `npm run build`. Value: `http://localhost:3001`.
- **Runtime:** nginx on port 80 inside the container; published to host port `3000`.
- **nginx config:** `rancher/nginx.conf` must:
  - Serve static files from `/usr/share/nginx/html`.
  - Return `index.html` for all non-file routes (`try_files $uri $uri/ /index.html`) to support React Router client-side routing.
  - Listen on port 80.
- **No environment variables at runtime** — the bundle is already built. No `env.sh` injection pattern is needed.

### 4.2 `backend`

- **Purpose:** Node.js Express API server.
- **Build context:** `backend/` directory.
- **Dockerfile:** `rancher/Dockerfile.backend`.
- **Runtime port:** 3001 inside container; published to host port `3001`.
- **Environment variables** injected at `docker compose up` time (from `.env` via `env_file` directive):
  - All `DB_*`, `JWT_SECRET`, `SESSION_SECRET`, `PASSWORD_HASH_SECRET`, `WO_*`, `IBMCLOUD_API_KEY` — unchanged from `.env`.
  - `OPENSEARCH_HOST=opensearch` — overridden to Docker service name.
  - `OPENSEARCH_PORT=9200`
  - `OPENSEARCH_INDEX=products`
  - `BACKEND_SERVER_URL=http://backend:3001` — overridden to internal URL.
- **Startup command:** `node server.js` (or equivalent entry point in `backend/`).
- **Depends on:** `opensearch` (health check must pass before backend starts).

### 4.3 `opensearch`

- **Image:** `opensearchproject/opensearch:2.13.0` — exact version pinned.
- **Runtime port:** 9200 inside container; published to host port `9200`.
- **Required environment variables** set in `docker-compose.yml` (not from `.env`):
  - `discovery.type=single-node`
  - `DISABLE_SECURITY_PLUGIN=true`
  - `bootstrap.memory_lock=true`
  - `OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m`
- **`ulimits`:** Set `memlock: -1/-1` and `nofile: 65536/65536` to prevent JVM memory issues.
- **Volume:** Named volume `opensearch-data` mounted at `/usr/share/opensearch/data` — persists index data across `docker compose down` restarts. Data is lost only on `docker compose down -v`.
- **Health check:** `GET http://localhost:9200/_cluster/health` — poll every 10 s, 5 retries, 30 s start period.

---

## 5. Dockerfiles

### 5.1 `rancher/Dockerfile.frontend`

Multi-stage build. Stage 1 builds the Vite bundle; Stage 2 serves it with nginx.

```dockerfile
# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Accept VITE_BACKEND_URL so Vite embeds it in the bundle at build time
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY rancher/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

**Key constraints:**
- `ARG VITE_BACKEND_URL` must appear **before** `RUN npm run build` or Vite will not see it.
- The final image contains no Node.js, no source files — only the compiled `dist/` and nginx.
- nginx listens on port 80; docker-compose maps host port 3000 → container port 80.

### 5.2 `rancher/Dockerfile.backend`

Single-stage. Dependencies are installed inside the image; source is copied in.

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

**Key constraints:**
- Build context is the `backend/` directory — paths in `COPY` are relative to `backend/`.
- `--omit=dev` keeps the image lean by excluding dev dependencies.
- `CMD` must match the actual entry point in `backend/package.json`. If the entry point differs (e.g. `src/server.js`), update accordingly.
- No `.env` file is copied into the image — all secrets arrive via `docker compose` environment injection.

### 5.3 `rancher/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 6. `docker-compose.yml`

Full service definitions. File location: `rancher/docker-compose.yml`.

```yaml
services:

  frontend:
    build:
      context: ..                          # repo root — needed to reach frontend/
      dockerfile: rancher/Dockerfile.frontend
      args:
        VITE_BACKEND_URL: "http://localhost:3001"
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build:
      context: ../backend
      dockerfile: ../rancher/Dockerfile.backend
    ports:
      - "3001:3001"
    env_file:
      - ../.env                            # loads all root .env vars
    environment:
      # Override localhost values with container service names
      OPENSEARCH_HOST: opensearch
      OPENSEARCH_PORT: "9200"
      OPENSEARCH_INDEX: products
      BACKEND_SERVER_URL: "http://backend:3001"
    depends_on:
      opensearch:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  opensearch:
    image: opensearchproject/opensearch:2.13.0
    environment:
      discovery.type: single-node
      DISABLE_SECURITY_PLUGIN: "true"
      bootstrap.memory_lock: "true"
      OPENSEARCH_JAVA_OPTS: "-Xms512m -Xmx512m"
    ulimits:
      memlock:
        soft: -1
        hard: -1
      nofile:
        soft: 65536
        hard: 65536
    ports:
      - "9200:9200"
    volumes:
      - opensearch-data:/usr/share/opensearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health | grep -qv '\"status\":\"red\"'"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  opensearch-data:
```

### Networking rules

- `backend` reaches `opensearch` at `http://opensearch:9200` — Docker Compose default bridge network resolves service names automatically.
- `frontend` (nginx) reaches `backend` at `http://backend:3001` — only relevant if nginx is ever configured as a proxy. For this spec, the browser calls `http://localhost:3001` directly via the published port.
- **The browser never uses Docker service names.** `VITE_BACKEND_URL=http://localhost:3001` is the correct and permanent value for Rancher.

### `env_file` + `environment` precedence

In Docker Compose, keys listed under `environment:` override the same keys loaded from `env_file:`. This is how `OPENSEARCH_HOST`, `BACKEND_SERVER_URL`, and `OPENSEARCH_PORT` are overridden to their container values without modifying `.env`.

---

## 7. `rancher/.env.docker.example`

Template committed to git. Copy to `.env` at the repo root and fill in real values before running. **Never commit `.env`.**

```dotenv
# ── Database ──────────────────────────────────────────────────────────────────
DB_HOST=<your-postgres-host>
DB_PORT=<your-postgres-port>
DB_NAME=<your-db-name>
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
DB_SSL=true
DB_SCHEMA=<your-db-schema>

# ── Auth secrets ──────────────────────────────────────────────────────────────
PASSWORD_HASH_SECRET=<random-secret>
USER_PASSWORD=<default-user-password>
JWT_SECRET=<random-secret>
SESSION_SECRET=<random-secret>

# ── watsonx Orchestrate ───────────────────────────────────────────────────────
WO_INSTANCE_URL=https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/<instance-id>
WO_API_KEY=<your-wo-api-key>
WO_ADK_ENVIRONMENT=ibm_cloud
WO_INSTANCE_URL_PRIVATE=https://api.private.us-south.watson-orchestrate.cloud.ibm.com/instances/<instance-id>

# ── IBM Cloud / OpenShift ─────────────────────────────────────────────────────
IBMCLOUD_API_KEY=<your-ibmcloud-api-key>
ICR_REGION=us-south
ICR_NAMESPACE=<your-icr-namespace>
ICR_HOSTNAME=us.icr.io
ROKS_CLUSTER_NAME=<your-cluster-name>
ROKS_REGION=us-south
IBM_CLOUD_RESOURCE_GROUP=<your-resource-group>
ROKS_WORKER_FLAVOR=cxf.8x16
ROKS_WORKER_COUNT=2
ROKS_OCP_VERSION=4.21_openshift
OCP_NAMESPACE=<your-ocp-namespace>

# ── OpenSearch ────────────────────────────────────────────────────────────────
# Local (native): set OPENSEARCH_HOST=localhost
# Rancher (containers): docker-compose.yml overrides this to "opensearch" automatically
OPENSEARCH_HOST=localhost
OPENSEARCH_PORT=9200
OPENSEARCH_INDEX=products

# ── Backend ───────────────────────────────────────────────────────────────────
# Local (native): http://localhost:3001
# Rancher (containers): docker-compose.yml overrides this to http://backend:3001 automatically
BACKEND_SERVER_URL=http://localhost:3001

# ── Frontend (Vite build-time) ────────────────────────────────────────────────
# DO NOT change this to a container service name — the browser cannot resolve
# internal Docker hostnames. http://localhost:3001 is correct for both local
# and Rancher environments.
VITE_BACKEND_URL=http://localhost:3001
```

---

## 8. Build and Run Steps

All commands run from the `rancher/` directory unless otherwise noted.

### First-time setup

```bash
# 1. Ensure Rancher Desktop is running with the dockerd (moby) engine enabled.
#    Settings → Container Engine → dockerd (moby)

# 2. Copy the example env file and fill in real credentials
cp rancher/.env.docker.example .env

# 3. Build all images (run from repo root)
docker compose -f rancher/docker-compose.yml build

# 4. Start the stack
docker compose -f rancher/docker-compose.yml up -d

# 5. Tail logs to confirm startup
docker compose -f rancher/docker-compose.yml logs -f
```

### Subsequent runs

```bash
# Start (already built)
docker compose -f rancher/docker-compose.yml up -d

# Stop (preserves opensearch-data volume)
docker compose -f rancher/docker-compose.yml down

# Stop and delete all data (destroys opensearch-data volume)
docker compose -f rancher/docker-compose.yml down -v
```

### Rebuild after code changes

```bash
# Rebuild only the changed service
docker compose -f rancher/docker-compose.yml build frontend
docker compose -f rancher/docker-compose.yml build backend

# Then restart
docker compose -f rancher/docker-compose.yml up -d
```

### Run the embed script (populate OpenSearch index)

The embed script runs outside Docker against the already-started `opensearch` container (port 9200 is published to `localhost`). Run from repo root:

```bash
OPENSEARCH_HOST=localhost OPENSEARCH_PORT=9200 OPENSEARCH_INDEX=products \
  node vector-db/embed.js
```

Or exec into the backend container if the embed script is packaged there:

```bash
docker compose -f rancher/docker-compose.yml exec backend node ../vector-db/embed.js
```

---

## 9. Validation

Run these checks after `docker compose up -d` to confirm each service is healthy.

### OpenSearch

```bash
# Cluster health — status must be "green" or "yellow", never "red"
curl -s http://localhost:9200/_cluster/health | jq .status

# Expected: "green" or "yellow"
```

### Backend

```bash
# Health endpoint
curl -s http://localhost:3001/health

# Products list (requires database reachability)
curl -s http://localhost:3001/api/products | jq '.[0]'

# Agent search
curl -s -X POST http://localhost:3001/agentSearch \
  -H "Content-Type: application/json" \
  -d '{"query":"lightweight fasteners"}' | jq .
```

### Frontend

```bash
# nginx serving the SPA
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# React Router path — must return index.html, not 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/products
# Expected: 200
```

### Browser smoke test

1. Open `http://localhost:3000` — the Orbital Suppliers home page loads.
2. Navigate to Products — the product grid populates from `http://localhost:3001/api/products`.
3. Use the Agent Search input — a response returns from watsonx Orchestrate.
4. Open browser DevTools → Network — confirm API calls go to `http://localhost:3001`, not `http://backend:3001`.

### Container status

```bash
docker compose -f rancher/docker-compose.yml ps
# All three services should show "healthy" or "running"
```

---

## 10. Notes and Constraints

### `VITE_BACKEND_URL` must always be `http://localhost:3001` for Rancher

`VITE_BACKEND_URL` is embedded into the JavaScript bundle by Vite at **image build time**. The bundle runs in the user's browser — not in the Docker network. The browser has no DNS resolution for `backend`, `opensearch`, or any other Docker Compose service name. Setting `VITE_BACKEND_URL=http://backend:3001` would cause every API call to fail silently with a DNS resolution error.

The correct value for both local (native) and Rancher (containers) environments is:

```
VITE_BACKEND_URL=http://localhost:3001
```

This works in containers because Docker Compose publishes port `3001` on the host's `localhost`, so the browser's calls to `http://localhost:3001` route to the `backend` container correctly.

**Never use a Docker service name as the value of any `VITE_*` variable.**

### `env_file` + `environment` override pattern

The `backend` service loads all `.env` vars via `env_file: ../.env`, then the `environment:` block overrides only the three vars that must change for container networking (`OPENSEARCH_HOST`, `BACKEND_SERVER_URL`). This means the root `.env` file remains valid for both local and container runs without modification.

### `.env` is never copied into images

Secrets are injected at `docker compose up` time via `env_file`, not at build time. Dockerfiles must not contain `COPY .env .` or any instruction that would bake secrets into a layer.

### opensearch-data volume persistence

`docker compose down` stops containers but preserves the `opensearch-data` named volume. The embedded product index survives restarts. Use `docker compose down -v` only when a full re-index is needed (e.g. index schema change).

### Rancher Desktop memory

OpenSearch requires adequate memory. Ensure Rancher Desktop is allocated at least **4 GB RAM** (Settings → Virtual Machine → Memory). The `OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m` heap setting keeps the JVM footprint predictable.

### Port conflicts

If any of ports `3000`, `3001`, or `9200` are already in use on the host by native processes (e.g. a locally running backend), stop those processes before starting the stack or the published port bindings will fail.
