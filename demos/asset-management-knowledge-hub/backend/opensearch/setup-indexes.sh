#!/usr/bin/env bash
# =============================================================================
# backend/opensearch/setup-indexes.sh
#
# Create (or update) the two OpenSearch indexes used by Maximo Knowledge Hub.
#
#   maximo-documents        — PDF / document RAG chunks (written by ingestion pipeline)
#   maximo_web_knowledge    — web-crawled content        (written by spiderbot)
#
# Run ONCE after starting OpenSearch for the first time, or after a reset.
# Safe to re-run — existing indexes are left untouched (no data loss).
#
# USAGE (from repo root):
#   bash backend/opensearch/setup-indexes.sh
#   bash backend/opensearch/setup-indexes.sh --force   # drop and recreate indexes
# =============================================================================

set -euo pipefail

CONTAINER="maximo-opensearch"
OS_USER="admin"
OS_PASS="admin"
BASE_URL="https://localhost:9200"
FORCE=0

# Parse args
for arg in "$@"; do
  [[ "$arg" == "--force" ]] && FORCE=1
done

# ── Resolve podman binary ──────────────────────────────────────────────────────
if command -v podman.exe &>/dev/null; then
  PODMAN="podman.exe"
elif command -v podman &>/dev/null; then
  PODMAN="podman"
else
  printf '\033[31m[✗]\033[0m podman / podman.exe not found on PATH.\n' >&2; exit 1
fi

# ── Colour helpers ─────────────────────────────────────────────────────────────
info() { printf '\033[36m[*]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[✓]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[✗]\033[0m %s\n' "$*" >&2; exit 1; }

# ── exec helper — runs curl inside the container ──────────────────────────────
os_curl() {
  # os_curl METHOD PATH [JSON_BODY]
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    $PODMAN exec "$CONTAINER" \
      curl -sk -o /dev/null -w "%{http_code}" \
      -u "${OS_USER}:${OS_PASS}" \
      -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    $PODMAN exec "$CONTAINER" \
      curl -sk -o /dev/null -w "%{http_code}" \
      -u "${OS_USER}:${OS_PASS}" \
      -X "$method" "${BASE_URL}${path}"
  fi
}

# ── container guard ───────────────────────────────────────────────────────────
if ! $PODMAN container exists "$CONTAINER" 2>/dev/null; then
  die "Container '$CONTAINER' is not running. Run: bash backend/opensearch/start.sh start"
fi

state=$($PODMAN inspect "$CONTAINER" --format "{{.State.Status}}" 2>/dev/null || echo "unknown")
[[ "$state" == "running" ]] || die "Container '$CONTAINER' is not running (state: $state)."

# ── index factory ─────────────────────────────────────────────────────────────
create_index() {
  local name="$1"
  local mapping="$2"

  # Check existence
  local status
  status=$($PODMAN exec "$CONTAINER" \
    curl -sk -o /dev/null -w "%{http_code}" \
    -u "${OS_USER}:${OS_PASS}" \
    "${BASE_URL}/${name}")

  if [[ "$status" == "200" ]]; then
    if [[ $FORCE -eq 1 ]]; then
      warn "Dropping index '${name}' (--force)..."
      os_curl DELETE "/${name}" >/dev/null 2>&1 || true
    else
      ok "Index '${name}' already exists — skipping (use --force to recreate)."
      return
    fi
  fi

  info "Creating index '${name}'..."
  local result
  result=$($PODMAN exec "$CONTAINER" \
    curl -sk \
    -u "${OS_USER}:${OS_PASS}" \
    -X PUT "${BASE_URL}/${name}" \
    -H "Content-Type: application/json" \
    -d "$mapping")

  if echo "$result" | grep -q '"acknowledged":true'; then
    ok "Index '${name}' created."
  else
    die "Failed to create index '${name}': ${result}"
  fi
}

# =============================================================================
# Index 1 — maximo-documents
#   Stores chunked PDF / document content for RAG queries.
#   Fields: documentId, fileName, content, chunkIndex, metadata (assetnum,
#           category, version, source), embedding (knn_vector, disabled until
#           KNN plugin is confirmed).
# =============================================================================
DOC_MAPPING=$(cat <<'EOF'
{
  "settings": {
    "number_of_shards":   1,
    "number_of_replicas": 0,
    "index": {
      "refresh_interval": "5s"
    }
  },
  "mappings": {
    "properties": {
      "documentId":  { "type": "keyword" },
      "fileName":    { "type": "text",    "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
      "content":     { "type": "text",    "analyzer": "english" },
      "chunkIndex":  { "type": "integer" },
      "indexedAt":   { "type": "date" },
      "metadata": {
        "properties": {
          "assetnum": { "type": "keyword" },
          "category": { "type": "keyword" },
          "version":  { "type": "keyword" },
          "source":   { "type": "keyword" },
          "section":  { "type": "text" }
        }
      }
    }
  }
}
EOF
)

# =============================================================================
# Index 2 — maximo_web_knowledge
#   Stores chunks from web pages crawled by the spiderbot.
#   Fields: url, title, siteLabel, topic, content, crawledAt, embedding.
#   url.keyword is used for collapse (de-duplication) in web_knowledge_search.
# =============================================================================
WEB_MAPPING=$(cat <<'EOF'
{
  "settings": {
    "number_of_shards":   1,
    "number_of_replicas": 0,
    "index": {
      "refresh_interval": "5s"
    }
  },
  "mappings": {
    "properties": {
      "url": {
        "type": "text",
        "fields": { "keyword": { "type": "keyword", "ignore_above": 2048 } }
      },
      "title":      { "type": "text",    "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
      "siteLabel":  { "type": "keyword" },
      "topic":      { "type": "text",    "fields": { "keyword": { "type": "keyword" } } },
      "content":    { "type": "text",    "analyzer": "english" },
      "crawledAt":  { "type": "date" },
      "chunkIndex": { "type": "integer" }
    }
  }
}
EOF
)

# ── Run ───────────────────────────────────────────────────────────────────────
echo ""
info "Setting up OpenSearch indexes for Maximo Knowledge Hub..."
echo ""

create_index "maximo-documents"     "$DOC_MAPPING"
create_index "maximo_web_knowledge" "$WEB_MAPPING"

echo ""
printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
printf '\033[32m ✅  Index setup complete\033[0m\n'
printf '\033[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m\n'
echo ""
echo "  Indexes ready:"
echo "    • maximo-documents        → ingestion pipeline / MCP server"
echo "    • maximo_web_knowledge    → spiderbot / MCP server"
echo ""
echo "  Verify with:"
echo "    bash backend/opensearch/start.sh health"
echo ""
echo "  Check indexes:"
echo "    $PODMAN exec $CONTAINER curl -sk -u ${OS_USER}:${OS_PASS} https://localhost:9200/_cat/indices?v"
echo ""
