# Specification 9: Local Containerization
The following specification outlines how to containerize the three services so they run as separate containers locally, while still allowing them to run natively (`uvicorn`).

## Prerequisites
Docker-compatible runtime (Rancher Desktop with dockerd/moby, Docker Desktop, or Podman). Load any skills that seem relevant.

## Requirements to follow
* Each service has its own `Dockerfile` and `.dockerignore` in its folder; build context = that folder.
* **Base image:** `python:3.11-slim-bookworm`, pinned by digest.
* `ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1`; `WORKDIR /app`; copy `requirements.txt` first and `pip install --no-cache-dir -r`; then copy sources.
* **Non-root:** `useradd --system --uid 10001 --no-create-home appuser` then `USER 10001`.
* `CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8080"]`.
* `ui_proxy` copies only `main.py` and `index.html`. The tool services `COPY . .`.
* `.dockerignore`: `.env`, `*.env`, `!*.env.example`, `__pycache__/`, `*.pyc`, `k8s/`, `test_*`, `*.json.bak`.
* Secrets are **never** baked into images — inject at run time.
* Store optional compose and helper files under `rancher/`.

## Step 1: Build
```bash
docker build -t search-contract-clause:local services/search_contract_clause
docker build -t regenerate-pdf:local        services/regenerate_pdf
docker build -t ui-proxy:local              services/ui_proxy
```

## Step 2: Run
```bash
docker run -d --name search-contract-clause --env-file services/search_contract_clause/.env -p 8081:8080 search-contract-clause:local
docker run -d --name regenerate-pdf        --env-file services/regenerate_pdf/.env        -p 8082:8080 regenerate-pdf:local
docker run -d --name ui-proxy              --env-file services/ui_proxy/.env              -p 8080:8080 ui-proxy:local
```
Optional `rancher/docker-compose.yml` with the same three services, `env_file` per service, `restart: unless-stopped`, and `healthcheck` on `GET /health`.

## Step 3: Run natively (no containers)
```bash
cd services/ui_proxy && ../../scripts/.venv/bin/uvicorn main:app --reload --port 8080   # then open http://localhost:8080
cd services/search_contract_clause && uvicorn main:app --reload --port 8081
cd services/regenerate_pdf        && uvicorn main:app --reload --port 8082
```
For the agent to reach the tools locally, expose 8081/8082 with a tunnel (e.g. `ngrok http 8081`) and use that URL in the OpenAPI `servers` entry (Spec 6).

## Validation
* `curl localhost:8080/health`, `:8081/health`, `:8082/health` → `{"status":"ok"}`.
* `docker exec <c> id -u` → `10001`; `docker exec <c> ls -a /app` shows no `.env`.
* Complete the Spec 8 journey against the containers.

## Cleanup
* Documentation: super simple, non-verbose, max 3–4 pages per .md; place into `rancher/docs/`.
* Ensure `.gitignore` covers `.env` files and logs.
