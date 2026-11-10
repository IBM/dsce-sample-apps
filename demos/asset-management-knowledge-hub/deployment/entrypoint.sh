#!/bin/sh
# =============================================================================
# entrypoint.sh — substitute environment variables into nginx.conf at startup
# then hand off to nginx.
#
# Required env vars (set these in Podman/Code Engine):
#   BACKEND_API_URL   — MCP server URL  e.g. https://mcp.example.com
#   INGEST_API_URL    — Ingestion API   e.g. https://ingest.example.com
#   OPENSEARCH_URL    — OpenSearch      e.g. https://opensearch.example.com:9200
#   API_KEY           — shared secret the backends require (X-API-Key). nginx adds
#                       it to proxied /api and /ingest-api requests. Use only
#                       [A-Za-z0-9_-] characters so it survives envsubst/nginx quoting.
#   UI_USERNAME       — administrator login for the UI (HTTP basic auth enforced by
#                       nginx). Only this account can start ingestion or delete
#                       documents. Letters, digits, '.', '_' and '-' only.
#   UI_PASSWORD       — password for UI_USERNAME. Required: the UI refuses to start
#                       without it, because nginx adds the API key for every caller.
#   ADMIN_API_KEY     — second secret the ingestion service requires for write routes.
#                       nginx sends it only for UI_USERNAME. [A-Za-z0-9_-] only.
#   UI_VIEWER_USERNAME / UI_VIEWER_PASSWORD
#                     — optional read-only login (search, chat, document list).
#
# Defaults are safe for local Podman testing (proxied via host.containers.internal).
# =============================================================================
set -e

: "${BACKEND_API_URL:=http://host.containers.internal:6868}"
: "${INGEST_API_URL:=http://host.containers.internal:8080}"
: "${OPENSEARCH_URL:=https://host.containers.internal:9200}"
: "${API_KEY:=}"
: "${ADMIN_API_KEY:=}"
: "${UI_USERNAME:=}"
: "${UI_PASSWORD:=}"
: "${UI_VIEWER_USERNAME:=}"
: "${UI_VIEWER_PASSWORD:=}"

if [ -z "${UI_USERNAME}" ] || [ -z "${UI_PASSWORD}" ]; then
  echo "ERROR: UI_USERNAME and UI_PASSWORD must be set (the UI is not served unauthenticated)." >&2
  exit 1
fi
if ! printf '%s' "${UI_USERNAME}" | grep -Eq '^[A-Za-z0-9._-]+$'; then
  echo "ERROR: UI_USERNAME may only contain letters, digits, '.', '_' and '-'." >&2
  exit 1
fi

# nginx auth_basic file. {PLAIN} avoids needing openssl/htpasswd in the image; the
# file is mode 600 in the container's /tmp, and the same secret is already in the
# container environment. A newline would break the one-entry-per-line format.
if [ "$(printf '%s' "${UI_PASSWORD}" | wc -l)" -gt 0 ]; then
  echo "ERROR: UI_PASSWORD must not contain newlines." >&2
  exit 1
fi
(umask 077; printf '%s:{PLAIN}%s\n' "${UI_USERNAME}" "${UI_PASSWORD}" > /tmp/htpasswd)
unset UI_PASSWORD

# Optional read-only account. It must differ from the administrator.
if [ -n "${UI_VIEWER_USERNAME}${UI_VIEWER_PASSWORD}" ]; then
  if [ -z "${UI_VIEWER_USERNAME}" ] || [ -z "${UI_VIEWER_PASSWORD}" ]; then
    echo "ERROR: set both UI_VIEWER_USERNAME and UI_VIEWER_PASSWORD, or neither." >&2
    exit 1
  fi
  if ! printf '%s' "${UI_VIEWER_USERNAME}" | grep -Eq '^[A-Za-z0-9._-]+$'; then
    echo "ERROR: UI_VIEWER_USERNAME may only contain letters, digits, '.', '_' and '-'." >&2
    exit 1
  fi
  if [ "${UI_VIEWER_USERNAME}" = "${UI_USERNAME}" ]; then
    echo "ERROR: UI_VIEWER_USERNAME must differ from UI_USERNAME." >&2
    exit 1
  fi
  if [ "$(printf '%s' "${UI_VIEWER_PASSWORD}" | wc -l)" -gt 0 ]; then
    echo "ERROR: UI_VIEWER_PASSWORD must not contain newlines." >&2
    exit 1
  fi
  (umask 077; printf '%s:{PLAIN}%s\n' "${UI_VIEWER_USERNAME}" "${UI_VIEWER_PASSWORD}" >> /tmp/htpasswd)
fi
unset UI_VIEWER_PASSWORD

if [ -z "${ADMIN_API_KEY}" ]; then
  echo "WARNING: ADMIN_API_KEY is not set — ingestion and delete requests will be rejected (403)." >&2
elif ! printf '%s' "${ADMIN_API_KEY}" | grep -Eq '^[A-Za-z0-9_-]+$'; then
  echo "ERROR: ADMIN_API_KEY may only contain letters, digits, '_' and '-'." >&2
  exit 1
fi

if [ -z "${API_KEY}" ]; then
  echo "WARNING: API_KEY is not set — the backends will reject proxied requests (401)." >&2
elif ! printf '%s' "${API_KEY}" | grep -Eq '^[A-Za-z0-9_-]+$'; then
  echo "ERROR: API_KEY may only contain letters, digits, '_' and '-'." >&2
  exit 1
fi

# Derive hostnames (scheme stripped, path stripped) for use in proxy Host headers.
# nginx's $proxy_host is only populated for static proxy_pass targets; for
# variable-based proxy_pass we must supply the Host header explicitly.
# sed strips "scheme://" prefix and any "/path" suffix, leaving "host" or "host:port".
INGEST_HOST=$(echo "${INGEST_API_URL}"   | sed 's|^[a-z]*://||; s|/.*||')
OPENSEARCH_HOST=$(echo "${OPENSEARCH_URL}" | sed 's|^[a-z]*://||; s|/.*||')
BACKEND_HOST=$(echo "${BACKEND_API_URL}" | sed 's|^[a-z]*://||; s|/.*||')

export BACKEND_API_URL INGEST_API_URL OPENSEARCH_URL API_KEY ADMIN_API_KEY UI_USERNAME
export INGEST_HOST OPENSEARCH_HOST BACKEND_HOST

# Expand ${VAR} placeholders in the nginx config template
envsubst '${BACKEND_API_URL} ${INGEST_API_URL} ${INGEST_HOST} ${BACKEND_HOST} ${API_KEY} ${ADMIN_API_KEY} ${UI_USERNAME}' \
  < /etc/nginx/nginx.conf \
  > /tmp/nginx.conf.rendered

cp /tmp/nginx.conf.rendered /etc/nginx/nginx.conf

exec nginx -g "daemon off;"
