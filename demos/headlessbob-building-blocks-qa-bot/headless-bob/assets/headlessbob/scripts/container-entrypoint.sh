#!/bin/sh
set -eu
umask 077
mkdir -p "$HOME/.bob/settings" "$DATA_DIR"
# Only import the operator's existing license consent, never their personal
# account settings, MCP configuration, task database, or credentials.
if [ -f /bob-config/settings.json ] && [ ! -f "$HOME/.bob/settings/settings.json" ]; then
  cp /bob-config/settings.json "$HOME/.bob/settings/settings.json"
fi
exec "$@"
