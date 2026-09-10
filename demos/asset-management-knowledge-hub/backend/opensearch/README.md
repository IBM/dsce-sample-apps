# OpenSearch — Local Development Setup

> **Platform:** Windows, using **Podman** (not Docker Desktop).  
> The scripts call `podman.exe` directly so they work from Git Bash, WSL, or
> PowerShell without any extra configuration.

---

## Overview

OpenSearch runs as a single-node container managed by Podman.  
TLS/HTTPS is enabled on port **9200** so the setup matches the production
environment exactly — no plain-text fallback is used in development.

| Setting | Value |
|---|---|
| Container name | `maximo-opensearch` |
| Image | `docker.io/opensearchproject/opensearch:2.11.0` |
| Port | `9200` (HTTPS) |
| Username | `admin` |
| Password | *(set via `OPENSEARCH_PASSWORD` in `.env`)* |
| Data volume | `maximo-opensearch-data` (persisted across restarts) |

---

## Scripts

| Script | Purpose |
|---|---|
| [`backend/opensearch/start.sh`](start.sh) | Start, stop, restart, status, health-check, and log tailing for the container |
| [`backend/opensearch/setup-indexes.sh`](setup-indexes.sh) | Create the two OpenSearch indexes (idempotent — safe to re-run) |

> **Legacy note:** `backend/scripts/opensearch.sh` is the original script and
> remains in place for backwards compatibility. `backend/opensearch/start.sh` is
> the canonical location going forward. Both scripts manage the same container
> and volume; do not run them simultaneously.

---

## Indexes

| Index name | Used by | Content |
|---|---|---|
| `maximo-documents` | Ingestion Pipeline, MCP Server | Chunked text from PDFs and documents uploaded through the UI |
| `maximo_web_knowledge` | Spiderbot, MCP Server | Page chunks crawled from IBM docs, community blogs, and Maximo Secrets |

---

## Quick Start

### 1 — Start the container

```bash
bash backend/opensearch/start.sh start
```

The script creates the named volume (if absent), runs the container, then polls
`/_cluster/health` every 5 seconds for up to 120 seconds.  You will see a green
confirmation banner once the cluster is healthy:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅  OpenSearch is UP  →  https://localhost:9200
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2 — Create the indexes

```bash
bash backend/opensearch/setup-indexes.sh
```

This creates `maximo-documents` and `maximo_web_knowledge` with the correct
field mappings and settings. The script is idempotent — running it again on an
existing cluster is safe.

### 3 — Configure environment variables

Add the following to the `.env` file at the repository root (copy from
`.env.example` if you haven't already):

```dotenv
OPENSEARCH_HOST=https://localhost:9200
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=<your-strong-password>
OPENSEARCH_INDEX=maximo-documents
OPENSEARCH_VERIFY_SSL=false
```

See the [Environment Variables](#environment-variables) table below for the
full reference.

### 4 — Start the backend and UI

```bash
python backend/start.py
```

This launches the MCP Server (port 6868), the Ingestion Pipeline (port 8000),
and the React UI (port 3000) in a single terminal.  Refer to
[`backend/README.md`](../README.md) for all `start.py` flags.

---

## Environment Variables

All Python services read from the single `.env` at the repository root via
`backend/shared/config/`.

| Variable | Local dev value | Description |
|---|---|---|
| `OPENSEARCH_HOST` | `https://localhost:9200` | Base URL of the OpenSearch node |
| `OPENSEARCH_USERNAME` | `admin` | HTTP Basic Auth username |
| `OPENSEARCH_PASSWORD` | *(set in `.env`)* | HTTP Basic Auth password — never commit this value |
| `OPENSEARCH_INDEX` | `maximo-documents` | Default index used by the Ingestion Pipeline and MCP Server document search |
| `OPENSEARCH_VERIFY_SSL` | `false` | Disable TLS certificate verification for the self-signed cert used by the local container |

---

## Container Management

All commands are run from the **repository root**:

```bash
# Start (or re-start a stopped container)
bash backend/opensearch/start.sh start

# Stop and remove the container (volume is kept — data is preserved)
bash backend/opensearch/start.sh stop

# Stop then immediately start again
bash backend/opensearch/start.sh restart

# Show container state, ports, and image
bash backend/opensearch/start.sh status

# Query /_cluster/health inside the running container
bash backend/opensearch/start.sh health

# Tail live container logs (Ctrl+C to exit)
bash backend/opensearch/start.sh logs
```

---

## Troubleshooting

### Container won't start

**Symptom:** `podman run` errors out immediately or the container exits at once.

1. Check whether a previous container with the same name still exists:
   ```bash
   bash backend/opensearch/start.sh status
   ```
   If it shows `Exited`, run `bash backend/opensearch/start.sh stop` to clean it
   up, then `start` again.

2. Confirm the Podman machine is running:
   ```bash
   podman machine list
   podman machine start   # if it shows Stopped
   ```

3. Confirm port 9200 is not already bound by another process:
   ```bash
   # Git Bash / WSL
   netstat -ano | grep 9200

   # PowerShell
   netstat -ano | Select-String "9200"
   ```

---

### Health check fails (times out after 120 s)

**Symptom:** The start script exhausts all 24 polling attempts with empty or
error responses.

1. Check the container logs for Java errors or OOM messages:
   ```bash
   bash backend/opensearch/start.sh logs
   ```

2. The container defaults to a 512 MB JVM heap (`-Xms512m -Xmx512m`).
   If your machine is under memory pressure, increase the Podman machine
   memory allocation:
   ```bash
   podman machine stop
   podman machine set --memory 4096
   podman machine start
   ```

3. Try running the health query manually to see the raw response:
   ```bash
   podman exec maximo-opensearch \
     curl -sk -u "admin:${OPENSEARCH_PASSWORD}" \
     "https://localhost:9200/_cluster/health?pretty"
   ```

---

### SSL / certificate errors in Python

**Symptom:** Services throw `SSLCertVerificationError` or
`certificate verify failed` when connecting to OpenSearch.

The local container uses a self-signed certificate. Set:

```dotenv
OPENSEARCH_VERIFY_SSL=false
```

in your `.env` file.  The shared OpenSearch client in
[`backend/shared/opensearch/__init__.py`](../shared/opensearch/__init__.py)
reads this variable and passes `verify_certs=False` / `ssl_assert_hostname=False`
to the client when it is set to `false`.

> Do **not** set `OPENSEARCH_VERIFY_SSL=false` in production environments.

---

## Architecture Context

```
                ┌──────────────────────────────┐
                │  OpenSearch  :9200  (HTTPS)  │
                │  podman container            │
                │                              │
                │  ┌──────────────────────┐   │
                │  │  maximo-documents    │   │  ◀── Ingestion Pipeline
                │  └──────────────────────┘   │
                │  ┌──────────────────────┐   │
                │  │ maximo_web_knowledge │   │  ◀── Spiderbot
                │  └──────────────────────┘   │
                └──────────────┬───────────────┘
                               │ HTTPS queries
                               ▼
                    MCP Server  :6868  (FastAPI)
```

Both indexes are queried concurrently by the MCP Server for every user request.
See [`backend/README.md`](../README.md) for the full service diagram.
