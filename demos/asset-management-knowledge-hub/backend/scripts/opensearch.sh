#!/usr/bin/env bash
# =============================================================================
# backend/scripts/opensearch.sh  — LEGACY SHIM
#
# This script has been superseded by backend/opensearch/start.sh
# It is kept here for backwards compatibility and simply delegates.
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEW_SCRIPT="$SCRIPT_DIR/../opensearch/start.sh"

if [[ ! -f "$NEW_SCRIPT" ]]; then
  echo "ERROR: Cannot find $NEW_SCRIPT" >&2
  exit 1
fi

exec bash "$NEW_SCRIPT" "$@"
