#!/bin/sh
# =============================================================================
# entrypoint.sh — substitute environment variables into nginx.conf at startup
# then hand off to nginx.
#
# Required env vars (set these in Podman/Code Engine):
#   BACKEND_API_URL   — MCP server URL  e.g. https://mcp.example.com
#   INGEST_API_URL    — Ingestion API   e.g. https://ingest.example.com
#   OPENSEARCH_URL    — OpenSearch      e.g. https://opensearch.example.com:9200
#
# Defaults are safe for local Podman testing (proxied via host.containers.internal).
# =============================================================================
set -e

: "${BACKEND_API_URL:=http://host.containers.internal:6868}"
: "${INGEST_API_URL:=http://host.containers.internal:8080}"
: "${OPENSEARCH_URL:=https://host.containers.internal:9200}"

# Derive hostnames (scheme stripped, path stripped) for use in proxy Host headers.
# nginx's $proxy_host is only populated for static proxy_pass targets; for
# variable-based proxy_pass we must supply the Host header explicitly.
# sed strips "scheme://" prefix and any "/path" suffix, leaving "host" or "host:port".
INGEST_HOST=$(echo "${INGEST_API_URL}"   | sed 's|^[a-z]*://||; s|/.*||')
OPENSEARCH_HOST=$(echo "${OPENSEARCH_URL}" | sed 's|^[a-z]*://||; s|/.*||')
BACKEND_HOST=$(echo "${BACKEND_API_URL}" | sed 's|^[a-z]*://||; s|/.*||')

export BACKEND_API_URL INGEST_API_URL OPENSEARCH_URL
export INGEST_HOST OPENSEARCH_HOST BACKEND_HOST

# Expand ${VAR} placeholders in the nginx config template
envsubst '${BACKEND_API_URL} ${INGEST_API_URL} ${OPENSEARCH_URL} ${INGEST_HOST} ${OPENSEARCH_HOST} ${BACKEND_HOST}' \
  < /etc/nginx/nginx.conf \
  > /tmp/nginx.conf.rendered

cp /tmp/nginx.conf.rendered /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
