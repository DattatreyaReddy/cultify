#!/usr/bin/env bash
# Paste a Cult.fit cURL command or Cookie header from the clipboard or dialog.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

payload=""
if command -v termux-clipboard-get >/dev/null 2>&1; then
    payload="$(termux-clipboard-get || true)"
fi

if ! node -e "process.exit(require('$REPO_DIR/session').isSessionPayload(process.argv[1]) ? 0 : 1)" "$payload"; then
    if command -v termux-dialog >/dev/null 2>&1; then
        dialog_json="$(termux-dialog -t 'Cultify session' -i 'Paste cult.fit curl or Cookie header' || true)"
        payload="$(node -e "const j=process.argv[1]; try { const p=JSON.parse(j); process.stdout.write(p.text || p.value || ''); } catch { process.stdout.write(j); }" "$dialog_json")"
    fi
fi

if [ -z "${payload// }" ]; then
    echo "Nothing to import. Copy a cult.fit curl or Cookie header, then re-run." >&2
    exit 1
fi

printf '%s' "$payload" | node "$REPO_DIR/termux/import-session.js"
