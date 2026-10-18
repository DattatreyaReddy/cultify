#!/usr/bin/env bash
# Receives Android shares (termux-url-opener). Cultify session payloads are
# imported into .cultify-session; everything else is passed to the previous opener.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAYLOAD="${1:-}"

set +e
printf '%s' "$PAYLOAD" | node "$REPO_DIR/termux/import-session.js" --maybe
status=$?
set -e
if [ "$status" -eq 0 ]; then
    exit 0
fi
if [ "$status" -eq 1 ]; then
    exit 1
fi

PREV="${CULTIFY_PREV_OPENER:-$HOME/bin/termux-url-opener.cultify-prev}"
if [ -x "$PREV" ]; then
    exec "$PREV" "$@"
fi
