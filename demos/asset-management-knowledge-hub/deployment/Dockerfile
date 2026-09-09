# =============================================================================
# Maximo Knowledge Hub — Frontend Dockerfile
# Multi-stage build:
#   Stage 1 (builder) : Node 20 UBI 9  → install deps, run vite build
#   Stage 2 (runtime) : nginx UBI 9    → serve static dist, proxy /api + /ingest-api
#
# Base images:
#   registry.access.redhat.com/ubi9/nodejs-20-minimal  (Red Hat UBI 9, Node 20)
#   registry.access.redhat.com/ubi9/nginx-122           (Red Hat UBI 9, nginx 1.22)
#
# Build args (all optional — override with --build-arg on the CLI):
#   VITE_MCP_SERVER_URL   default: ""  (relative /api path used in prod)
#   VITE_INGESTION_URL    default: ""  (relative /ingest-api path used in prod)
#   VITE_OPENSEARCH_URL   default: ""  (relative /opensearch-api path)
# =============================================================================

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal AS builder

# Build-time env vars injected into the Vite bundle at build time.
# Leave empty to use relative proxy paths (recommended — nginx handles routing).
ARG VITE_MCP_SERVER_URL=""
ARG VITE_INGESTION_URL=""
ARG VITE_OPENSEARCH_URL=""

ENV VITE_MCP_SERVER_URL=$VITE_MCP_SERVER_URL \
    VITE_INGESTION_URL=$VITE_INGESTION_URL \
    VITE_OPENSEARCH_URL=$VITE_OPENSEARCH_URL \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# UBI minimal images run as uid 1001 by default — npm needs write access
USER 0

WORKDIR /app

# Copy dependency manifests first (layer cache friendly)
COPY frontend/package.json frontend/package-lock.json ./

# Install ALL deps including devDependencies (vite, sass, etc. are needed for the build).
# NODE_ENV must NOT be "production" here — npm skips devDependencies when it is.
RUN npm ci

# Copy the full frontend source
COPY frontend/ ./

# Build the static bundle → /app/dist
# Set NODE_ENV=production only for the vite build step itself.
RUN NODE_ENV=production npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM registry.access.redhat.com/ubi9/nginx-122 AS runtime

# UBI nginx-122 already runs as uid 1001 (default) — switch to root only for setup
USER 0

# UBI nginx-122 static root is /opt/app-root/src
COPY --from=builder /app/dist /opt/app-root/src

# Inject our custom nginx config template and entrypoint script
COPY deployment/nginx.conf    /etc/nginx/nginx.conf
COPY deployment/entrypoint.sh /entrypoint.sh

# Fix permissions on writable paths.
# pid file lives at /run/nginx.pid on this image (not /var/run).
# gettext (envsubst) is pre-installed on ubi9/nginx-122 — no install needed.
RUN chmod -R g+rwX /var/log/nginx /etc/nginx \
    && touch /run/nginx.pid \
    && chown 1001:0 /run/nginx.pid \
    && chmod +x /entrypoint.sh

USER 1001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/nginx-health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
