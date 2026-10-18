# Changelog

## 2.0.0

Breaking change: `schedule.yml` must use the `config:` list format. The upgrade migration converts weekday-keyed schedules and saves the original as `schedule.yml.pre-2.0.0`.

- Config entries can target multiple weekdays; omit `days` to apply an entry every day
- Upgrades apply versioned migrations in order, including migrations from skipped releases

## 1.2.0

- Shared schedule entries can target multiple weekdays; omit `days` to use an entry every day
- Existing weekday-keyed schedule files remain supported
- Termux upgrades apply versioned migrations in order, including migrations from skipped releases

## 1.1.0

Breaking config change if you still use `PREFERRED_SLOTS` / `PREFERRED_WORKOUT` in `.env`. Run `bash termux/upgrade.sh` after `git pull`.

- Weekday workout and slot preferences live in `schedule.yml` (not env vars)
- Expired sessions can be refreshed into `.cultify-session` without editing `.env` (bookmarklet share, or `bash termux/paste-session.sh`)
- Session-expired notification opens https://next.cult.fit and does not retry
- Added `js-yaml` dependency

## 1.0.0

Initial Termux JobScheduler booking flow with `CURL_COMMAND`, `PREFERRED_SLOTS`, and `PREFERRED_WORKOUT` in `.env`.
