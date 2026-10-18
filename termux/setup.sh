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

TARGET="$(tr -d '[:space:]' < "$REPO_DIR/VERSION")"
STAMP="$REPO_DIR/.cultify-version"
APPLIED="0.0.0"
if [ -f "$STAMP" ]; then
    APPLIED="$(tr -d '[:space:]' < "$STAMP")"
else
    echo "No version stamp found; running all migrations from the oldest baseline."
fi

echo "==> Applying pending migrations..."
node "$REPO_DIR/scripts/run-migrations.js" "$APPLIED" "$TARGET"
printf '%s\n' "$TARGET" > "$STAMP"

echo "==> Installing automatic post-pull upgrade hooks..."
bash "$REPO_DIR/scripts/install-git-hooks.sh"

chmod +x "$REPO_DIR/termux/watcher.sh" "$REPO_DIR/termux/run-booking.sh" \
    "$REPO_DIR/termux/url-opener.sh" "$REPO_DIR/termux/paste-session.sh"

echo "==> Installing Termux share handler (termux-url-opener)..."
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

Copy your .env (see .env.example) into this repo and edit schedule.yml
before the next scheduled run.

To refresh an expired session: log in at https://next.cult.fit, run the
bookmarklet (see README), and share to Termux. Or paste a curl into:
  bash termux/paste-session.sh
EOF
