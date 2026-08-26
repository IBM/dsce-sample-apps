# Specification 9: Containerization on OpenShift (IBM Cloud)

Deploy the Orbital Suppliers application to the ROKS cluster provisioned in Spec 8.

## Prerequisites

Check each item before proceeding. Stop and tell the user if anything is missing.

- `OCP_APP_HOSTNAME` must be set in `.env` (written by Spec 8 Step 3).

| Tool | Check | Install if missing |
|---|---|---|
| `ibmcloud` CLI | `ibmcloud version` | ❌ User must install manually |
| `oc` CLI | `oc version --client` | `brew install openshift-cli` |
| `kustomize` | `kustomize version` | `brew install kustomize` |
| `docker` or `podman` | See check below | ❌ User must start/install |

```bash
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "docker: ready"
elif command -v podman &>/dev/null && podman info &>/dev/null 2>&1; then
  echo "podman: ready"
else
  echo "ERROR: No container runtime available. Start Docker Desktop / Rancher Desktop / Podman Desktop."
  exit 1
fi
```

Load the following skills:
- `ibm-cloud` — `ibmcloud` CLI commands, ICR login, `oc` cluster targeting
- `infrastructure-as-code-terraform` — Kustomize manifest patterns and overlay management

---

## Architecture

| Service | Runtime | Notes |
|---------|---------|-------|
| `frontend` | Nginx + React SPA | `VITE_BACKEND_URL` must be `""` — nginx proxies `/api/*` to the backend Service |
| `backend` | Node.js / Express | Embedding model pre-fetched at build time — no internet egress from cluster |
| `opensearch` | OpenSearch 2.13.0 | StatefulSet with PVC — must be pushed to ICR (cluster cannot pull from Docker Hub) |
| Database | External | IBM Cloud PostgreSQL via private VPE hostname (`DB_HOST_PRIVATE`) |
| WO Agent | External | watsonx Orchestrate via private endpoint (`WO_INSTANCE_URL_PRIVATE`) |

**Pod resource requests/limits:**

| Pod | Request | Limit |
|-----|---------|-------|
| `frontend` | 64 MB | 128 MB |
| `backend` | 512 MB | 768 MB |
| `opensearch` | 768 MB | 1 GB |

---

## Step 1: Build images

Place all Dockerfiles under `openshift/`. The build context is always the repo root.

### `Dockerfile.backend`

- Use `FROM node:20` (Debian-based) — **not** `node:20-alpine`. `onnxruntime-node` bundles glibc-linked binaries incompatible with Alpine musl.
- Check `backend/package.json` for the `"main"` field and use that as the `CMD` entry point. Do not assume a filename.

### `Dockerfile.frontend`

- Use `FROM --platform=$BUILDPLATFORM node:20-alpine AS builder` — runs `vite build` on native host architecture, avoiding esbuild QEMU crash on Apple Silicon.
- Use `FROM nginxinc/nginx-unprivileged:alpine` for the final stage — **not** `nginx:alpine`. OpenShift runs as arbitrary non-root UIDs; standard nginx requires root.
- The `ARG VITE_BACKEND_URL` default must be `""` — never a localhost URL.
- Build with `--no-cache` — Vite bakes `VITE_BACKEND_URL` into the JS bundle; layer cache silently ships the old URL.

### `Dockerfile.vector-db`

- Use `FROM opensearchproject/opensearch:2.13.0`. Pull locally and push to ICR — **do not** reference Docker Hub in any pod spec (no internet egress in cluster).
- Set env vars: `discovery.type=single-node`, `DISABLE_SECURITY_PLUGIN=true`, `DISABLE_INSTALL_DEMO_CONFIG=true`, `OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m`. Expose ports `9200` and `9300`.

### Build and push all images

All images must target `linux/amd64` — ROKS runs on x86-64. Use `--platform linux/amd64` on every build.

```bash
set -a; source .env; set +a
REGISTRY="${ICR_HOSTNAME}/${ICR_NAMESPACE}"

ibmcloud cr login --client docker   # never use 'docker login us.icr.io' directly

docker build --no-cache --platform linux/amd64 -f openshift/Dockerfile.frontend \
  --build-arg VITE_BACKEND_URL="" -t "${REGISTRY}/frontend:latest" .
docker push "${REGISTRY}/frontend:latest"

docker build --platform linux/amd64 -f openshift/Dockerfile.backend \
  -t "${REGISTRY}/backend:latest" .
docker push "${REGISTRY}/backend:latest"

docker build --platform linux/amd64 -f openshift/Dockerfile.vector-db \
  -t "${REGISTRY}/vector-db:latest" .
docker push "${REGISTRY}/vector-db:latest"
```

> **ICR hostname mapping:** The region name and registry hostname differ. `ibmcloud cr login` prints the correct hostname. Common mappings: `us-south` → `us.icr.io`, `eu-central` → `de.icr.io`, `uk-south` → `uk.icr.io`.

---

## Step 2: Kubernetes manifests

Use Kustomize overlays. Store base manifests under `openshift/manifests/base/` and overlays under `openshift/manifests/overlays/`.

**Namespace:** `orbital-suppliers`

**Resources to create:**

| Kind | Name | Notes |
|------|------|-------|
| `Namespace` | `orbital-suppliers` | |
| `ConfigMap` | `app-config` | Non-sensitive env vars (see below) |
| `Secret` | `app-secrets` | Sensitive env vars (see below) |
| `Deployment` | `frontend`, `backend` | |
| `StatefulSet` | `opensearch` | |
| `Service` | `frontend`, `backend`, `opensearch` | ClusterIP |
| `PVC` | `opensearch-data` | 5 GB RWO block |
| `Route` | `orbital-suppliers` | TLS edge → frontend:8080 |

**`ConfigMap` `app-config`** — non-sensitive:
`BACKEND_PORT`, `OPENSEARCH_HOST`, `OPENSEARCH_PORT`, `OPENSEARCH_INDEX`, `DB_HOST` (use `DB_HOST_PRIVATE` — not `DB_HOST`), `DB_PORT`, `DB_NAME`, `DB_SCHEMA`, `DB_SSL`

**`Secret` `app-secrets`** — sensitive:
`DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `PASSWORD_HASH_SECRET`, `SESSION_SECRET`, `USER_PASSWORD`, `WO_API_KEY`, `WO_INSTANCE_URL` (use `WO_INSTANCE_URL_PRIVATE`), `WO_AGENT_ID`, `WO_ENVIRONMENT_ID`

> Secrets must be created via `oc create secret` — never committed to git. `deploy.sh` handles this with `--dry-run=client -o yaml | oc apply -f -`.

### OpenSearch StatefulSet — OpenShift SCC requirements

OpenSearch runs as UID 1000, which is outside ROKS's `restricted-v2` UID range (`1000640000+`). Two steps are required:

1. Grant `anyuid` SCC to the namespace service account:
   ```bash
   oc adm policy add-scc-to-user anyuid system:serviceaccount:orbital-suppliers:default
   ```
2. Set `securityContext.fsGroup: 1000` on the pod spec so the PVC is group-writable on first mount. Without this, a fresh RWO block volume is root-owned and OpenSearch cannot write to it (`AccessDeniedException: /usr/share/opensearch/data/nodes`).

Do **not** add `runAsNonRoot: true`, `capabilities.drop`, or `seccompProfile` to the pod spec — they conflict with `anyuid`.

Also set `imagePullPolicy: Always` on the container so nodes re-pull from ICR after rebuilds rather than using a stale cached image.

### Kustomize gotchas

- Use `labels` (not deprecated `commonLabels`) to avoid mutating pod selector labels.
- To patch a static base `ConfigMap` from an overlay, use a `patches` block with a JSON patch op. `configMapGenerator` with `behavior: merge` only works when the base ConfigMap is also generator-managed.
- Validate before applying: `oc kustomize openshift/manifests/overlays/prod`

---

## Step 3: ICR pull secret

New namespaces on ROKS do not inherit the cluster's ICR pull secret. Copy it from `default` immediately after creating the namespace:

```bash
oc get secret all-icr-io -n default -o json | \
  python3 -c "
import sys, json
s = json.load(sys.stdin)
s['metadata'] = {'name': s['metadata']['name'], 'namespace': 'orbital-suppliers'}
print(json.dumps(s))
" | oc apply -f -

oc secrets link default all-icr-io --for=pull -n orbital-suppliers
```

Pods will hit `ImagePullBackOff` without this step.

---

## Step 4: nginx configuration

The frontend uses `VITE_BACKEND_URL=""`, so `axiosClient.js` sets `baseURL` to `/api`. All API calls become `/api/<route>`, which nginx proxies to the backend Service stripping the prefix.

> **Do not** proxy individual route names like `/orders` or `/products` directly — these are also React Router SPA routes. nginx would intercept browser navigations and return `{"error":"No token provided"}` instead of `index.html`.

`openshift/nginx.conf`:

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    absolute_redirect off;

    # Proxy /api/* to backend, stripping the prefix
    location /api/ {
        proxy_pass http://backend:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Hashed static assets — safe to cache 1 year (Vite fingerprints filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html — never cache; ensures browsers always load the latest JS bundle
    location = /index.html {
        add_header Cache-Control "no-store";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`axiosClient.js` must stay in sync with nginx:

```js
baseURL: import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : '/api',
```

Rebuild and push the frontend image after any change to `nginx.conf` or `axiosClient.js`.

---

## Step 5: Deploy

```bash
set -a; source .env; set +a
ibmcloud login --apikey $IBMCLOUD_API_KEY -r us-south -g $IBM_CLOUD_RESOURCE_GROUP
./openshift/deploy.sh prod
```

`deploy.sh` must be executable: `git update-index --chmod=+x openshift/deploy.sh`

Monitor rollout:

```bash
oc get pods -n orbital-suppliers -w
oc get route orbital-suppliers -n orbital-suppliers
```

---

## Cleanup

- Add `openshift/.env.*`, `kubeconfig`, and `*.kubeconfig` to `.gitignore`.
- Write simple docs under `openshift/docs/` (`setup.md` and `configuration.md`, ≤ 3 pages each).
