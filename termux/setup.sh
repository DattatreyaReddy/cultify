#!/data/data/com.termux/files/usr/bin/bash
# One-time Termux setup: installs deps, registers the JobScheduler job, and
# wires up re-registration on boot. Safe to re-run.
set -euo pipefail

if [ -z "${PREFIX:-}" ] || [[ "$PREFIX" != *com.termux* ]]; then
    echo "This script must be run inside Termux." >&2
    exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOB_ID=1
PERIOD_MS=900000 # 15 min, Android's enforced minimum for periodic jobs.

echo "==> Installing packages (nodejs, termux-api)..."
pkg install -y nodejs termux-api

if ! command -v termux-job-scheduler >/dev/null 2>&1; then
    echo "termux-job-scheduler not found. Install the Termux:API app (from the" >&2
    echo "same source as Termux, e.g. F-Droid) alongside the termux-api package." >&2
    exit 1
fi

echo "==> Installing dependencies..."
cd "$REPO_DIR" && npm install --omit=dev

chmod +x "$REPO_DIR/termux/watcher.sh" "$REPO_DIR/termux/run-booking.sh"

echo "==> Registering JobScheduler job (every $((PERIOD_MS / 60000)) min)..."
termux-job-scheduler \
    --job-id "$JOB_ID" \
    --period-ms "$PERIOD_MS" \
    --persisted true \
    --network any \
    --script "$REPO_DIR/termux/watcher.sh"

echo "==> Wiring up re-registration on boot..."
mkdir -p "$HOME/.termux/boot"
BOOT_SCRIPT="$HOME/.termux/boot/cultify-reregister.sh"
cat > "$BOOT_SCRIPT" <<EOF
#!$PREFIX/bin/bash
termux-wake-lock
termux-job-scheduler \\
    --job-id $JOB_ID \\
    --period-ms $PERIOD_MS \\
    --persisted true \\
    --network any \\
    --script "$REPO_DIR/termux/watcher.sh"
EOF
chmod +x "$BOOT_SCRIPT"

cat <<'EOF'

==> Setup complete. Two manual steps remain (Android won't let a script do these):

1. Install the Termux:Boot app (same source as Termux) so the job above
   re-registers itself after every reboot, then open it once to activate it.
2. Disable battery optimization for Termux, Termux:API, and Termux:Boot:
   Android Settings -> Apps -> [app] -> Battery -> Unrestricted.
   On MIUI/ColorOS/FuntouchOS/OneUI etc. also check the manufacturer's own
   "autostart"/"background activity" toggle for these apps.

Copy your .env (see .env.example) into this repo before the next scheduled run.
EOF
