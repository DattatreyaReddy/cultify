#!/usr/bin/env bash
# Installs ~/bin/termux-url-opener so Share -> Termux can import a session.
# Sourced or executed from setup.sh / upgrade.sh. No-op outside Termux.
set -euo pipefail

if [ -z "${PREFIX:-}" ] || [[ "$PREFIX" != *com.termux* ]]; then
    echo "Skipping Termux share handler (not running in Termux)."
    return 0 2>/dev/null || exit 0
fi

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

mkdir -p "$HOME/bin"
OPENER="$HOME/bin/termux-url-opener"
PREV="$HOME/bin/termux-url-opener.cultify-prev"
if [ -e "$OPENER" ] && ! grep -q 'cultify-url-opener' "$OPENER" 2>/dev/null; then
    mv "$OPENER" "$PREV"
    echo "    Existing termux-url-opener saved as $PREV"
fi
cat > "$OPENER" <<EOF
#!$PREFIX/bin/bash
# cultify-url-opener
export CULTIFY_PREV_OPENER="$PREV"
exec bash "$REPO_DIR/termux/url-opener.sh" "\$@"
EOF
chmod +x "$OPENER"
echo "Installed $OPENER"
