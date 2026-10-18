#!/usr/bin/env bash
# Apply config/runtime migrations after git pull. Safe to re-run.
# Usage: bash termux/upgrade.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

TARGET="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
STAMP="$REPO_DIR/.cultify-version"
APPLIED="1.0.0"
if [ -f "$STAMP" ]; then
    APPLIED="$(tr -d '[:space:]' < "$STAMP")"
fi

echo "==> Cultify upgrade: $APPLIED -> $TARGET"

version_ge() {
    # Returns 0 if $1 >= $2 (semver major.minor.patch, missing parts = 0).
    local IFS=.
    local a=($1) b=($2)
    local i
    for i in 0 1 2; do
        local av="${a[$i]:-0}"
        local bv="${b[$i]:-0}"
        if [ "$av" -gt "$bv" ]; then
            return 0
        fi
        if [ "$av" -lt "$bv" ]; then
            return 1
        fi
    done
    return 0
}

if version_ge "$APPLIED" "$TARGET"; then
    echo "Already at $APPLIED. Re-running 1.1.0 steps so a partial upgrade can finish."
fi

echo "==> Installing npm dependencies..."
npm install --omit=dev

echo "==> Making scripts executable..."
chmod +x "$REPO_DIR/termux/"*.sh

echo "==> Migrating .env slot/workout prefs into schedule.yml (1.1.0)..."
node "$REPO_DIR/scripts/migrate-env-schedule.js"

echo "==> Installing Termux share handler (1.1.0 session refresh)..."
# shellcheck source=termux/install-share-handler.sh
source "$REPO_DIR/termux/install-share-handler.sh"

if [ -n "${PREFIX:-}" ] && [[ "$PREFIX" == *com.termux* ]]; then
    echo "==> Re-registering JobScheduler job..."
    bash "$REPO_DIR/termux/setup.sh"
else
    echo "Not in Termux; skipped job re-registration. On the phone run: bash termux/setup.sh"
fi

printf '%s\n' "$TARGET" > "$STAMP"
echo "==> Upgrade complete. Now at $TARGET"
echo
echo "Next:"
echo "  - Review schedule.yml (per-weekday workouts/slots)."
echo "  - Session refresh: node scripts/print-bookmarklet.js"
echo "    then Share to Termux, or: bash termux/paste-session.sh"
echo "See CHANGELOG.md for details."
