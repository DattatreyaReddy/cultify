#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

echo "==> Migrating legacy .env schedule preferences..."
node "$REPO_DIR/scripts/migrate-env-schedule.js"

echo "==> Installing Termux share handler..."
bash "$REPO_DIR/termux/install-share-handler.sh"