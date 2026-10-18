#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Removing obsolete session-share files..."
rm -f \
    "$REPO_DIR/scripts/print-bookmarklet.js" \
    "$REPO_DIR/termux/create-bookmarklet.sh" \
    "$REPO_DIR/termux/install-share-handler.sh" \
    "$REPO_DIR/termux/url-opener.sh" \
    "$REPO_DIR/test/bookmarklet.test.js"

OPENER="$HOME/bin/termux-url-opener"
PREV="$HOME/bin/termux-url-opener.cultify-prev"
if [ -f "$OPENER" ] && grep -q 'cultify-url-opener' "$OPENER"; then
    if [ -f "$PREV" ]; then
        mv "$PREV" "$OPENER"
        echo "==> Restored previous Termux share handler."
    else
        rm "$OPENER"
        echo "==> Removed obsolete Cultify Termux share handler."
    fi
fi
