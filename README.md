# Cultify

Automated Cult.fit class booking, running locally on an Android phone via Termux.

## Overview

Cultify books fitness classes at Cult.fit centers automatically, right when the next day's slots open. It authenticates using browser session cookies and runs on your own phone via Termux + Android's JobScheduler — no cloud CI, no queueing delays, no server costs.

> This project previously ran on a GitHub Actions cron schedule. That's been removed: GitHub's scheduled-workflow queue can delay triggers by several minutes during peak load, which matters when popular slots fill up within seconds of opening. Running on your own phone removes that queue entirely.

## Features

- Automatic class booking based on your preferences (center, time slots, workout type)
- Smart booking logic (skips if already booked that day)
- Waitlist support (joins the queue when a class is full, skips overly long waitlists — counts as a successful outcome)
- Retries automatically on the next JobScheduler check (~15 min later) if nothing matched or a request failed, up to 3 attempts per day
- Local, clickable Android notification with the result (booked / already booked / no match / error) — tapping it opens the class in the Cult.fit app
- Runs entirely on-device — no server, no CI queue, no external costs

## How It Works

1. Extracts authentication from a browser curl command (`.env`)
2. Fetches available classes via the Cult.fit API
3. Filters by your configured preferences (center, time, workout type)
4. Checks for an existing booking on the target date — skips if found
5. Books the first available matching class (or joins a short-enough waitlist)
6. If nothing matched or a request failed, persists attempt state to `.cultify-state.json` (repo root) so the next JobScheduler check (~15 min later) retries automatically — up to 3 attempts/day total
7. Sends a clickable Android notification with the outcome (tapping it opens the class in the Cult.fit app)
8. Logs everything to `termux/logs/`

## Prerequisites

- Active Cult.fit membership
- An Android phone you're comfortable leaving Termux running on
- [Termux](https://f-droid.org/packages/com.termux/), [Termux:API](https://f-droid.org/packages/com.termux.api/), and [Termux:Boot](https://f-droid.org/packages/com.termux.boot/) — install all three **from F-Droid**, not the Play Store (the Play Store build is unmaintained and won't work with the API/Boot add-ons)

## Setup

### 1. Get authentication

You need a curl command containing your session cookies:

1. Open https://www.cult.fit in a browser and log in
2. Open DevTools (F12) → Network tab → refresh the page
3. Pick any request to the `cult.fit` domain → right-click → Copy → Copy as cURL (bash)
4. Flatten it to a single line (remove the trailing backslashes/line breaks)

### 2. Clone and configure

```bash
pkg install git
git clone https://github.com/YOUR_USERNAME/cultify.git
cd cultify
cp .env.example .env
```

Edit `.env` and set `CURL_COMMAND` to the curl string from step 1. Adjust `PREFERRED_CENTER`, `PREFERRED_SLOTS`, `PREFERRED_WORKOUT`, and `ENABLE_WAITLIST` as needed — see `.env.example` for defaults and format.

### 3. Run setup

```bash
bash termux/setup.sh
```

This installs Node.js, registers the daily JobScheduler job (checks in every ~15 min; inside your configured window it runs the booking flow, retrying on subsequent checks — up to 3 attempts total — until it succeeds or the window closes), and wires up a boot script so the job survives a phone reboot.

It prints two things you must do manually (Android doesn't allow scripting these):

1. Open the Termux:Boot app once so it's activated.
2. Disable battery optimization for Termux, Termux:API, and Termux:Boot: **Android Settings → Apps → [app] → Battery → Unrestricted**. On heavily customized Android skins (MIUI, ColorOS, FuntouchOS, OneUI, etc.) also check that manufacturer's own "autostart"/"background activity" toggle for these three apps — otherwise Android may still kill the job.

### 4. Set your target time

Edit `termux/schedule.conf`:

```bash
TARGET_TIME="22:00"   # 24h HH:MM, local phone time
WINDOW_MINUTES=60      # must cover 3 attempts, ~15 min apart: (MAX_ATTEMPTS - 1) * 15 + 15
```

Cult.fit typically opens next-day booking in the evening — set `TARGET_TIME` to just before that.

## Manual run / testing

```bash
node index.js
```

Runs the booking flow once immediately (with the same notification), useful for testing your `.env` and preferences before relying on the scheduled job.

Note: this respects the same persisted state as the scheduled job (see below) — if today is already marked done in `.cultify-state.json` (repo root), a manual run will just log that and exit. Delete that file (or wait for the next day) to force a fresh attempt.

## Checking results

Everything is logged to `termux/logs/<date>.log` (auto-pruned after 30 days), and you'll get an Android notification either way:

- **Cultify: Class booked!** — booked or joined a waitlist successfully (tap to open the class in the Cult.fit app)
- **Cultify: Already booked** — you already had a booking for that date (also tappable)
- **Cultify: No class booked** — nothing matched your preferences; retries automatically on the next JobScheduler check unless attempts are exhausted
- **Cultify: Booking failed** — an error occurred (check the log for details); also retries automatically unless attempts are exhausted

### Retry state

Each invocation reads/writes `.cultify-state.json` (repo root) — `{ date, attempts, done }`. `watcher.sh` uses `done` to decide whether to bother running the booking flow on a given JobScheduler tick, and `index.js` uses `attempts` to know when to stop retrying (`MAX_ATTEMPTS = 3` per day, defined in `index.js`). The file resets automatically once the date changes.

## Configuration Reference

| Variable | Description | Default |
|---|---|---|
| `CURL_COMMAND` | Full curl command with auth headers/cookies (required) | — |
| `PREFERRED_CITY` | Injected into cookies if missing | `Hyderabad` |
| `PREFERRED_CENTER` | Numeric Cult.fit center ID | `1515` |
| `PREFERRED_SLOTS` | Comma-separated `HH:MM:SS` slots, tried in order | `07:00:00,08:00:00,09:00:00` |
| `PREFERRED_WORKOUT` | Comma-separated exact workout name(s), in preference order | `HRX WORKOUT` |
| `ENABLE_WAITLIST` | Join waitlist when full (skips if 15+ people already waitlisted) | `true` |

### Finding your center ID

Run `node index.js` once with any `PREFERRED_CENTER` — it logs a "Nearby gyms" list with each center's name and ID.

### Available workout names

| Workout Name | Category ID |
|---|---|
| HRX WORKOUT | 69 |
| ADIDAS STRENGTH+ | 69 |
| DANCE FITNESS | 56 |
| FUSION DANCE FITNESS | 56 |
| BOXING BAG WORKOUT | 8 |
| BURN | 66 |
| EVOLVE YOGA | 5 |

## Troubleshooting

**"Login Required!" errors** — session cookies expired (typically 7-30 days). Get a fresh curl command (Setup step 1) and update `CURL_COMMAND` in `.env`.

**Job doesn't seem to run** — check `termux-job-scheduler --pending` to confirm the job is registered, and double-check the battery optimization / manufacturer autostart settings above. These are by far the most common reason a background Termux job silently stops firing.

**Job stopped after a reboot** — confirm Termux:Boot is installed and has been opened at least once; `~/.termux/boot/cultify-reregister.sh` (created by `setup.sh`) re-registers the job on every boot.

## Limitations

- Up to 3 booking attempts per day (by design), spaced by JobScheduler ticks (~15 min apart, not a guaranteed exact interval)
- Requires an active Cult.fit membership and a phone that stays on/connected around the target time
- Session cookies need periodic manual refresh (7-30 days)
- Waitlist position/confirmation is determined by Cult.fit, not this script

## License

MIT License — see [LICENSE](LICENSE).

## Inspired by

- https://medium.com/@nobrains/how-i-automated-booking-my-cult-classes-cbc568f05cc8
- https://github.com/nobrains/CureFit
