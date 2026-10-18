# Changelog

## 1.1.0

Breaking config change if you still use `PREFERRED_SLOTS` / `PREFERRED_WORKOUT` in `.env`. Run `bash termux/upgrade.sh` after `git pull`.

- Weekday workout and slot preferences live in `schedule.yml` (not env vars)
- Expired sessions can be refreshed into `.cultify-session` without editing `.env` (bookmarklet share, or `bash termux/paste-session.sh`)
- Session-expired notification opens https://next.cult.fit and does not retry
- Added `js-yaml` dependency

## 1.0.0

Initial Termux JobScheduler booking flow with `CURL_COMMAND`, `PREFERRED_SLOTS`, and `PREFERRED_WORKOUT` in `.env`.
