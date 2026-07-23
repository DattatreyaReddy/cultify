#!/data/data/com.termux/files/usr/bin/bash
# Runs the booking flow and logs output. Retry logic and notifications live
# in index.js itself so they apply the same way regardless of caller.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$REPO_DIR/termux/logs"
mkdir -p "$LOG_DIR"

# Prune logs older than 30 days.
find "$LOG_DIR" -name '*.log' -mtime +30 -delete 2>/dev/null || true

LOG_FILE="$LOG_DIR/$(date +%F).log"

cd "$REPO_DIR"
{
    echo "=== Run started at $(date) ==="
    node index.js
    EXIT_CODE=$?
    echo "=== Run finished at $(date), exit code $EXIT_CODE ==="
} >> "$LOG_FILE" 2>&1
