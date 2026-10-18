#!/usr/bin/env bash
# Apply config/runtime migrations after git pull. Safe to re-run.
# Usage: bash termux/upgrade.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

TARGET="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
STAMP="$REPO_DIR/.cultify-version"
APPLIED="0.0.0"
if [ -f "$STAMP" ]; then
    APPLIED="$(tr -d '[:space:]' < "$STAMP")"
else
    echo "No version stamp found; running all migrations from the oldest baseline."
fi

echo "==> Cultify upgrade: $APPLIED -> $TARGET"

echo "==> Installing npm dependencies..."
npm install --omit=dev

echo "==> Making scripts executable..."
chmod +x "$REPO_DIR/termux/"*.sh

echo "==> Running versioned migrations..."
node "$REPO_DIR/scripts/ensure-user-schedule.js"
node "$REPO_DIR/scripts/run-migrations.js" "$APPLIED" "$TARGET"

echo "==> Installing automatic post-pull upgrade hooks..."
bash "$REPO_DIR/scripts/install-git-hooks.sh"

printf '%s\n' "$TARGET" > "$STAMP"

if [ -n "${PREFIX:-}" ] && [[ "$PREFIX" == *com.termux* ]]; then
    echo "==> Re-registering JobScheduler job..."
    bash "$REPO_DIR/termux/setup.sh"
else
    echo "Not in Termux; skipped job re-registration. On the phone run: bash termux/setup.sh"
fi

echo "==> Upgrade complete. Now at $TARGET"
echo
echo "Next:"
echo "  - Review schedule.local.yml config entries."
echo "  - Session refresh: node scripts/print-bookmarklet.js"
echo "    then Share to Termux, or: bash termux/paste-session.sh"
echo "See CHANGELOG.md for details."
