# Cultify

Automated Cult.fit class booking, running locally on an Android phone via Termux.

## Overview

Cultify attempts to book fitness classes around a time you configure, using browser session cookies on your Android phone via Termux and Android's JobScheduler. It does not require a hosted server or CI runner; Android may delay scheduled jobs, so booking is not guaranteed to happen at an exact time.

## Features

- Automatic class booking based on your preferences (center, plus workout and time slots per weekday)
- Smart booking logic (skips if already booked that day)
- Waitlist support (joins the queue when a class is full, skips overly long waitlists — counts as a successful outcome)
- Retries automatically on the next JobScheduler check (~15 min later) if nothing matched or a request failed, up to 3 attempts per day
- Local, clickable Android notification with the result (booked / already booked / no match / session expired / error) — tapping a booked notification opens the class; tapping session expired opens next.cult.fit

## How It Works

1. Uses cookies from `.cultify-session` when present, overriding any bootstrap cookies or authorization in `.env`; without an imported session it uses credentials from `.env`
2. Fetches available classes via the Cult.fit API
3. Filters by your configured preferences (center, plus that weekday's workout and time slots)
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

### 1. Clone and configure

```bash
pkg install git
git clone https://github.com/YOUR_USERNAME/cultify.git
cd cultify
cp .env.example .env
```

Edit `.env` for your preferred city and center, and edit `schedule.yml` for weekday workout and time-slot preferences. Days you omit are skipped. `CURL_COMMAND` is optional: you can use the browser-session flow below without putting a curl command in `.env`.

If you prefer curl bootstrap credentials, log in at https://next.cult.fit, open DevTools → Network, copy a `cult.fit` request as cURL (bash), and set `CURL_COMMAND` in `.env`. Treat the full curl as a password: it can include authentication cookies. See `.env.example` for the optional setting.

### 2. Run setup

```bash
bash termux/setup.sh
```

This installs Node.js, registers the daily JobScheduler job (checks in every ~15 min; inside your configured window it runs the booking flow, retrying on subsequent checks — up to 3 attempts total — until it succeeds or the window closes), and wires up a boot script so the job survives a phone reboot.

It prints two things you must do manually (Android doesn't allow scripting these):

1. Open the Termux:Boot app once so it's activated.
2. Disable battery optimization for Termux, Termux:API, and Termux:Boot: **Android Settings → Apps → [app] → Battery → Unrestricted**. On heavily customized Android skins (MIUI, ColorOS, FuntouchOS, OneUI, etc.) also check that manufacturer's own "autostart"/"background activity" toggle for these three apps — otherwise Android may still kill the job.

### 3. Log in and import a browser session (recommended)

You can skip `CURL_COMMAND` and `.env` cookie credentials by importing a browser session:

1. Open https://next.cult.fit in your phone browser and log in.
2. In Termux, generate the bookmarklet code:

   ```bash
   node scripts/print-bookmarklet.js
   ```

3. Add the printed `javascript:...` text as a bookmark in the phone browser. While logged in to next.cult.fit, open that bookmark and choose **Share → Termux**. Setup installs the Termux share handler, which saves the imported session to `.cultify-session`.

If the bookmarklet share is missing the HttpOnly `at` / `st` cookies, copy a curl command or `Cookie` header from the browser and run:

```bash
bash termux/paste-session.sh
```

The importer requires both `at` and `st`. It saves only recognized session cookies; `cf_clearance` and unrelated browser cookies are ignored. The imported session is used automatically on the next run and takes precedence over bootstrap cookies and authorization in `.env`. Import the session before the configured booking window; without either an imported session or bootstrap credentials, startup reports how to log in/import and cannot make booking requests.

### 4. Set your target time

Edit `termux/schedule.conf`:

```bash
TARGET_TIME="22:00"   # 24h HH:MM, local phone time
WINDOW_MINUTES=60      # must cover 3 attempts, ~15 min apart: (MAX_ATTEMPTS - 1) * 15 + 15
```

Set `TARGET_TIME` based on when bookings open for your account and location. Android may run the job later than the configured time.

## Manual run / testing

```bash
node index.js
```

Runs the booking flow once immediately (with the same notification), useful for testing your `.env` and `schedule.yml` before relying on the scheduled job.

Note: this respects the same persisted state as the scheduled job (see below) — if today is already marked done in `.cultify-state.json` (repo root), a manual run will just log that and exit. Delete that file (or wait for the next day) to force a fresh attempt.

## Checking results

Everything is logged to `termux/logs/<date>.log` (auto-pruned after 30 days), and you'll get an Android notification either way:

- **Cultify: Class booked!** — booked or joined a waitlist successfully (tap to open the class in the Cult.fit app)
- **Cultify: Already booked** — you already had a booking for that date (also tappable)
- **Cultify: No class booked** — nothing matched your preferences; retries automatically on the next JobScheduler check unless attempts are exhausted
- **Cultify: Session expired** — cookies were rejected (`Login Required` / `AUTH EXPIRED` / HTTP 401). Tap to open next.cult.fit, then import a fresh session (below). This does not retry.
- **Cultify: Booking failed** — an error occurred (check the log for details); also retries automatically unless attempts are exhausted

### Retry state

Each invocation reads/writes `.cultify-state.json` (repo root) — `{ date, attempts, done }`. `watcher.sh` uses `done` to decide whether to bother running the booking flow on a given JobScheduler tick, and `index.js` uses `attempts` to know when to stop retrying (`MAX_ATTEMPTS = 3` per day, defined in `index.js`). The file resets automatically once the date changes.

## Configuration Reference

| Variable | Description | Default |
|---|---|---|
| `CURL_COMMAND` | Optional curl command for API headers and fallback cookies; imported session cookies take precedence when present | — |
| `PREFERRED_CITY` | Injected into cookies if missing | `Hyderabad` |
| `PREFERRED_CENTER` | Numeric Cult.fit center ID | `1515` |
| `SCHEDULE_FILE` | Path to weekday workout/slot YAML | `schedule.yml` (repo root) |
| `ENABLE_WAITLIST` | Join waitlist when full (skips if 15+ people already waitlisted) | `true` |

### Weekday schedule (`schedule.yml`)

```yaml
config:
  - workout: HRX WORKOUT
    slots: ["07:00:00", "08:00:00"]
    days: [monday]
  - workout: ADIDAS STRENGTH+
    slots: ["07:30:00", "08:30:00"]
    days: [monday, tuesday]
```

Each config entry applies to its listed days; omit `days` to apply it to all seven days. Entries are tried in order, so later entries act as fallbacks. Quote times so YAML keeps them as strings (`"07:00:00"`, `"7:00"`, or `"7AM"`). Schedules use the `config` list format. During upgrade from a weekday-keyed schedule, the migration converts it and saves the original as `schedule.yml.pre-2.0.0`.

```yaml
config:
  - workout: HRX WORKOUT
    slots: ["07:00:00", "08:00:00"]
  - workout: BURN
    slots: ["09:00:00"]
```

Run `bash termux/upgrade.sh` after pulling an update to apply pending migrations and refresh dependencies. Migrations in `scripts/migrations/` are applied in version order, including when skipping releases. Setup and upgrades install local Git hooks that run the upgrade after future pull merges or rebases; any existing hooks are preserved and invoked first. If Git hooks are disabled or the repository uses a GUI that bypasses them, run the upgrade command manually.

### Refreshing the session (no `.env` edit)

Cult.fit does not document a supported token-refresh API. When cookies expire, log in in the phone browser and import `at` / `st` (and related cookies) into gitignored `.cultify-session`; no `.env` edit or `CURL_COMMAND` is required for this flow. Booking still uses `www.cult.fit`; login is on `https://next.cult.fit`. The importer reads cookies from a copied curl command's `Cookie` header (or `-b` option); it does not execute the curl request or use its URL to refresh tokens. It stores only its allowlisted session cookies; `cf_clearance` and other unrecognized cookies are ignored. An imported `.cultify-session` takes precedence over `.env` cookies and clears its authorization header unless the session file contains an authorization value. Without an imported session file, `.env` credentials remain the fallback. Other API configuration continues to use its configured values. Both the session file and a copied curl command contain password-equivalent credentials; do not share or commit them. The session file is written atomically with owner-only permissions on supported filesystems.

An API `401`, a recognized login-expired message, or a final redirect to `next.cult.fit` is reported as **Session expired**. Other errors (including unrelated `403` responses) remain booking failures so they are not mistaken for an expired login. A missing session file falls back to the bootstrap `.env` credentials; an existing but empty, malformed, or unreadable session file fails explicitly rather than silently using potentially stale credentials.

**Bookmarklet (on next.cult.fit after login):**

```bash
node scripts/print-bookmarklet.js
```

Create a browser bookmark whose URL is that `javascript:...` line. Tap it while logged in, then **Share → Termux**. `setup.sh` installs `~/bin/termux-url-opener` so that share writes `.cultify-session`.

`document.cookie` cannot see HttpOnly cookies. If the share is missing `at`/`st`, copy a curl command or Cookie header from the browser and run `bash termux/paste-session.sh`:

On a desktop, you can also pipe a copied Cookie header or curl command to the importer:

```bash
pbpaste | node termux/import-session.js          # macOS
termux-clipboard-get | node termux/import-session.js
```

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

**"Login Required!" / session expired** — Cult.fit rejected the saved cookies. Session lifetime can vary. Tap the notification to open next.cult.fit, log in, then share the bookmarklet to Termux or run `bash termux/paste-session.sh`. You do not need to edit `.env`.

**Job doesn't seem to run** — check `termux-job-scheduler --pending` to confirm the job is registered, and double-check the battery optimization / manufacturer autostart settings above. These are by far the most common reason a background Termux job silently stops firing.

**Job stopped after a reboot** — confirm Termux:Boot is installed and has been opened at least once; `~/.termux/boot/cultify-reregister.sh` (created by `setup.sh`) re-registers the job on every boot.

## Limitations

- Up to 3 booking attempts per day (by design), spaced by JobScheduler ticks (~15 min apart, not a guaranteed exact interval)
- Requires an active Cult.fit membership and a phone that stays on/connected around the target time
- Session cookies may need manual refresh; Cult.fit does not document a supported token-refresh API
- Waitlist position/confirmation is determined by Cult.fit, not this script

## License

MIT License — see [LICENSE](LICENSE).

## Inspired by

- https://medium.com/@nobrains/how-i-automated-booking-my-cult-classes-cbc568f05cc8
- https://github.com/nobrains/CureFit
