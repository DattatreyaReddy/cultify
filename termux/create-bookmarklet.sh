#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOKMARKLET="$(node "$REPO_DIR/scripts/print-bookmarklet.js")"

if command -v termux-clipboard-set >/dev/null 2>&1; then
    printf '%s' "$BOOKMARKLET" | termux-clipboard-set
    echo "Bookmarklet copied to clipboard. Paste it as the URL of a browser bookmark named 'Cultify session export'."
else
    echo "Clipboard command termux-clipboard-set is unavailable. Copy the line below into a browser bookmark URL:"
    printf '%s\n' "$BOOKMARKLET"
fi
