#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

echo "==> Converting weekday-keyed schedule to config list format..."
node "$REPO_DIR/scripts/migrate-weekday-schedule.js"