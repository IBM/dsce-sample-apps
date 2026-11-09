# syntax=docker/dockerfile:1
# Instana AI Assistant — bridge (Express) + UI (Vite build) + mcp-instana (Python, stdio)
#
# STREAM_MODE defaults to `mock` (simulated data, no credentials). For live data
# set STREAM_MODE=realtime and provide INSTANA_BASE_URL, INSTANA_API_TOKEN and the
# BOB_* variables at run time (Code Engine secret / `--env-file`).
# Secrets are NOT baked in.

# ── Stage 1: build the UI ─────────────────────────────────────────────────────
FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS ui-build
WORKDIR /build
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# ── Stage 2: bridge dependencies (production only) ───────────────────────────
FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS bridge-deps
WORKDIR /bridge
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS runtime
ENV NODE_ENV=production

# Python + uv are required because the bridge spawns `mcp-instana` over stdio.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3=3.11.* \
      ca-certificates=2023* \
      curl=7.88.* \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Install the MCP server at build time so start-up needs no network/package fetch.
ENV UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PYTHON_PREFERENCE=system \
    UV_LINK_MODE=copy
RUN uv tool install mcp-instana \
 && chmod -R a+rX /opt/uv-tools \
 && mcp-instana --help >/dev/null

WORKDIR /app
ENV PORT=8080 \
    INSTANA_MCP_COMMAND=mcp-instana \
    INSTANA_MCP_ARGS='["--transport","stdio"]'

COPY --from=bridge-deps /bridge/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/index.mjs server/mockRoutes.mjs server/mockData.mjs ./server/
COPY --from=ui-build /build/dist ./dist

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["node", "server/index.mjs"]
