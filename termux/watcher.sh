#!/data/data/com.termux/files/usr/bin/bash
# Invoked every ~15 min by termux-job-scheduler (see setup.sh). Cheap no-op
# outside the target window; runs the booking flow once per day inside it.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./schedule.conf
source "$DIR/schedule.conf"

MARKER_FILE="$HOME/.cultify-last-run"
TODAY="$(date +%F)"

if [ -f "$MARKER_FILE" ] && [ "$(cat "$MARKER_FILE")" = "$TODAY" ]; then
    exit 0
fi

TARGET_HOUR="${TARGET_TIME%%:*}"
TARGET_MIN="${TARGET_TIME##*:}"
# Base 10 forces (avoids octal parsing of values like 08, 09).
TARGET_MINUTES=$((10#$TARGET_HOUR * 60 + 10#$TARGET_MIN))
WINDOW_END_MINUTES=$((TARGET_MINUTES + WINDOW_MINUTES))
NOW_MINUTES=$((10#$(date +%H) * 60 + 10#$(date +%M)))

if [ "$NOW_MINUTES" -lt "$TARGET_MINUTES" ] || [ "$NOW_MINUTES" -ge "$WINDOW_END_MINUTES" ]; then
    exit 0
fi

echo "$TODAY" > "$MARKER_FILE"
"$DIR/run-booking.sh"
