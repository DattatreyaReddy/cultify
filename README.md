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

## How it works

Cultify uses `.cultify-session` when it exists; its cookies and authorization replace those from `.env`. Without an imported session, credentials from `.env` are used. The script fetches class availability, applies the configured weekday/workout/slot preferences from your local `schedule.local.yml`, skips dates that are already booked, and attempts the first matching class or eligible waitlist. Attempts and outcomes are saved in `.cultify-state.json`; Termux logs runs under `termux/logs/`.

## Prerequisites

- Active Cult.fit membership
- An Android phone you're comfortable leaving Termux running on
- [Termux](https://f-droid.org/packages/com.termux/), [Termux:API](https://f-droid.org/packages/com.termux.api/), and [Termux:Boot](https://f-droid.org/packages/com.termux.boot/) — install all three **from F-Droid**, not the Play Store (the Play Store build is unmaintained and won't work with the API/Boot add-ons)

## Setup

### Choose an authentication method

Cultify supports two ways to provide Cult.fit session credentials. Neither method prevents sessions from expiring, and Cult.fit does not document a supported token-refresh API.

| Method | What you do | Pros | Cons |
|---|---|---|---|
| **Browser login + session import (recommended)** | Log in at `next.cult.fit`, then use a saved bookmarklet and share the session to Termux. | No curl or cookie values in `.env`; imported session is used on later runs; same bookmark is reused. | Not automatic login or token refresh. Initial bookmark setup is manual; after session expiry, log in, tap the bookmark, and share to Termux. |
| **`CURL_COMMAND` / `COOKIES` in `.env`** | Copy a Cult.fit request as cURL from browser DevTools, or provide a Cookie header directly. | No bookmarklet setup; curl may provide API headers as well as bootstrap cookies. | Credentials can contain password-equivalent cookies; protect `.env`. Cookies can expire and replacing them in `.env` is manual. |

If both are present, `.cultify-session` cookies take precedence over `.env` cookies and its authorization value replaces the one from `.env`; other API headers from `CURL_COMMAND` remain in use. Choose browser login to refresh without editing `.env`. Choose `CURL_COMMAND` or `COOKIES` if you prefer `.env` configuration and accept that you may need to replace credentials when they expire.

### 1. Clone and configure

```bash
pkg install git
git clone https://github.com/YOUR_USERNAME/cultify.git
cd cultify
cp .env.example .env
```

Edit `.env` for your preferred city and center. `termux/setup.sh` creates `schedule.local.yml` from the tracked `schedule.yml` starter template; edit the local file for weekday workout and time-slot preferences after setup. Days you omit are skipped. For the `.env` method, log in at https://next.cult.fit, open DevTools → Network, copy a `cult.fit` request as cURL (bash), and set `CURL_COMMAND` in `.env`; alternatively set `COOKIES` to a Cookie header. Treat either value as a password. See `.env.example` for settings. For browser login + session import, leave these credentials unset and follow step 3.

### 2. Run setup

```bash
bash termux/setup.sh
```

This installs Node.js, registers the daily JobScheduler job (checks in every ~15 min; inside your configured window it runs the booking flow, retrying on subsequent checks — up to 3 attempts total — until it succeeds or the window closes), and wires up a boot script so the job survives a phone reboot.

Setup creates `schedule.local.yml` from `schedule.yml` if the personal file does not already exist. The tracked `schedule.yml` remains an example/template; edit `schedule.local.yml` so your preferences are not overwritten by future updates.

It prints two things you must do manually (Android doesn't allow scripting these):

1. Open the Termux:Boot app once so it's activated.
2. Disable battery optimization for Termux, Termux:API, and Termux:Boot: **Android Settings → Apps → [app] → Battery → Unrestricted**. On heavily customized Android skins (MIUI, ColorOS, FuntouchOS, OneUI, etc.) also check that manufacturer's own "autostart"/"background activity" toggle for these three apps — otherwise Android may still kill the job.

### 3. Browser login + session import (manual; not automatic login)

This method avoids storing cookies in `.env`, but it does not refresh the login automatically. Create the bookmarklet once; whenever a session is missing or expires, log in and reuse the saved bookmark to import a fresh one.

1. In Termux, generate the bookmarklet code:

   ```bash
   node scripts/print-bookmarklet.js
   ```

2. Copy the entire `javascript:...` line from the output. In your browser, create a bookmark for any page (for example, `https://next.cult.fit`), then edit that bookmark: set its name to `Cultify session export` and replace its URL/address with the copied `javascript:...` line. Save it. Browser menu names can vary slightly by version.

   **Chrome for Android**
   - Open `https://next.cult.fit` and sign in, then use **⋮ → Add to bookmarks** (or the star icon) to create a temporary bookmark.
   - Open **⋮ → Bookmarks**, find the new bookmark, and use its **⋮ → Edit** action.
   - Set the name to `Cultify session export`, replace the URL with the copied `javascript:...` line, then save.

   **Firefox for Android**
   - Open `https://next.cult.fit` and sign in, then use **⋮ → Bookmark** to create a temporary bookmark.
   - Open **⋮ → Bookmarks**, long-press the new bookmark, and choose **Edit bookmark**.
   - Set the name to `Cultify session export`, replace the address with the copied `javascript:...` line, then save.

3. Whenever you need a session (including after it expires), open `https://next.cult.fit` in the same browser and sign in if prompted. Open the browser's Bookmarks menu, tap **Cultify session export**, and choose **Share → Termux**. Setup installs the Termux share handler, which saves the imported session to `.cultify-session`. The bookmark is reused; do not recreate it for each refresh.

The bookmarklet may not see HttpOnly cookies. If the imported payload is missing `at` / `st`, copy a curl command or `Cookie` header from the browser and run:

```bash
bash termux/paste-session.sh
```

The importer requires both `at` and `st`. It saves only recognized session cookies; `cf_clearance` and unrelated browser cookies are ignored. It reads cookies from the shared bookmarklet payload or a pasted curl/Cookie header; it does not execute the curl request. The imported session is used automatically on the next run and takes precedence over bootstrap cookies and authorization in `.env`. Import the session before the configured booking window; without either an imported session or bootstrap credentials, startup explains how to import a session and cannot make booking requests. Treat `.cultify-session` as a password; it is gitignored and written atomically with owner-only permissions on supported filesystems.

On a desktop, you can pipe a copied Cookie header or curl command to the importer:

```bash
pbpaste | node termux/import-session.js          # macOS
```

On Android/Termux, use `bash termux/paste-session.sh` instead.

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

Runs the booking flow once immediately (with the same notification), useful for testing your `.env` and `schedule.local.yml` before relying on the scheduled job.

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
| `CURL_COMMAND` | Optional curl command for API headers and bootstrap cookies; imported session takes precedence when present | — |
| `COOKIES` | Optional Cookie header used when `CURL_COMMAND` is not set and no imported session exists | — |
| `PREFERRED_CITY` | Injected into cookies if missing | `Hyderabad` |
| `PREFERRED_CENTER` | Numeric Cult.fit center ID | `1515` |
| `SCHEDULE_FILE` | Optional path to weekday workout/slot YAML | `schedule.local.yml` (repo root) |
| `ENABLE_WAITLIST` | Join waitlist when full (skips if 15+ people already waitlisted) | `true` |

### Weekday schedule (`schedule.local.yml`)

Edit `schedule.local.yml` (created by setup from the tracked `schedule.yml` template). If running without setup, copy the template first:

```bash
cp schedule.yml schedule.local.yml
```

```yaml
config:
  - workout: HRX WORKOUT
    slots: ["07:00:00", "08:00:00"]
    days: [monday]
  - workout: ADIDAS STRENGTH+
    slots: ["07:30:00", "08:30:00"]
    days: [monday, tuesday]
```

Each config entry applies to its listed days; omit `days` to apply it to all seven days. Entries are tried in order, so later entries act as fallbacks. Quote times so YAML keeps them as strings (`"07:00:00"`, `"7:00"`, or `"7AM"`). Schedules use the `config` list format. During upgrade from a weekday-keyed schedule, the migration converts the personal schedule and saves the original as `schedule.local.yml.pre-2.0.0`.

### Updating Cultify

Run `bash termux/upgrade.sh` after pulling an update to apply pending migrations and refresh dependencies. Migrations in `scripts/migrations/` are applied in version order, including when skipping releases. Setup and upgrades install local Git hooks that run the upgrade after future pull merges or rebases; any existing hooks are preserved and invoked first. If Git hooks are disabled or the repository uses a GUI that bypasses them, run the upgrade command manually. The personal `schedule.local.yml` is gitignored; keep editing it rather than the tracked `schedule.yml` template to avoid schedule conflicts in future pulls.

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

**"Login Required!" / session expired** — Cult.fit rejected the saved cookies. Session lifetime can vary. Tap the notification to open next.cult.fit, log in, then open your saved bookmarklet and share it to Termux, or run `bash termux/paste-session.sh`. You do not need to recreate the bookmark or edit `.env`.

An API `401`, recognized login-expired message, or final redirect to `next.cult.fit` is reported as **Session expired**. Unrelated errors, including other `403` responses, remain booking failures. A missing `.cultify-session` can fall back to `.env` credentials; an existing empty, malformed, or unreadable session file fails explicitly.

**Job doesn't seem to run** — check `termux-job-scheduler --pending` to confirm the job is registered, and double-check the battery optimization / manufacturer autostart settings above. These are by far the most common reason a background Termux job silently stops firing.

**Job stopped after a reboot** — confirm Termux:Boot is installed and has been opened at least once; `~/.termux/boot/cultify-reregister.sh` (created by `setup.sh`) re-registers the job on every boot.

## Limitations

- Up to 3 booking attempts per day (by design), spaced by JobScheduler ticks (~15 min apart, not a guaranteed exact interval)
- Requires an active Cult.fit membership and a phone that stays on/connected around the target time
- Session cookies may expire and require manual refresh
- Waitlist position/confirmation is determined by Cult.fit, not this script

## License

MIT License — see [LICENSE](LICENSE).

## Inspired by

- https://medium.com/@nobrains/how-i-automated-booking-my-cult-classes-cbc568f05cc8
- https://github.com/nobrains/CureFit
