#!/data/data/com.termux/files/usr/bin/bash
# Invoked every ~15 min by termux-job-scheduler (see setup.sh). Cheap no-op
# outside the target window; otherwise runs the booking flow, which persists
# its own attempt/done state (see STATE_FILE in index.js) so this script just
# defers to that instead of tracking "done for today" itself.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./schedule.conf
source "$DIR/schedule.conf"

STATE_FILE="$HOME/.cultify-state.json"
TODAY="$(date +%F)"

if [ -f "$STATE_FILE" ]; then
    DONE="$(node -e "
        try {
            const s = require('$STATE_FILE');
            console.log(s.date === '$TODAY' && s.done ? 'yes' : 'no');
        } catch (e) {
            console.log('no');
        }
    ")"
    if [ "$DONE" = "yes" ]; then
        exit 0
    fi
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

"$DIR/run-booking.sh"
