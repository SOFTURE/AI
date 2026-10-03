# Research: billing-entitlements

Sources: `modules/auth` (`AuthUser`, `requireUser`, `authorizeRole`, the `onRegistered` hook),
`modules/mcp-access` (`getAccessTokenStatus`: calendar days in the app's time zone, a warning
window), `modules/waitlist` and `modules/privacy` (module shape, contributors), the example app's
`softure.config.ts`. FIRE_TRACKER is outside this session's scope; the roadmap baseline says FIRE
keeps `paid_until` and `trial_ends_at` on its users table with a hand-written guard.

## Unknowns from the roadmap

1. **How a new user gets a trial row.** Neither the auth hook nor a lazy insert. An account without
   a row is on the trial that starts at its `auth.users.created_at`, computed on read, so a read has
   no side effect, the app's single `onRegistered` hook stays free (the example already uses it for
   consents), and accounts that existed before billing was enabled get a trial too. A row is written
   only by a change (`changeEntitlement`: a grant, a revoke, a trial extension), which first pins
   the derived trial end into it. Trade-off: until a row exists, a change of `trial.days` moves the
   trial of row-less accounts; documented in the README.
2. **Unlimited / lifetime.** `is_lifetime boolean`, with `paid_until` NULL (a CHECK keeps the two
   exclusive). Postgres `infinity` was rejected: a JavaScript `Date` cannot hold it.
3. **Time zone of the trial end.** A trial of N days ends at the start of the local day N days after
   the start day, in `config.timezone`: a 14-day trial begun on any hour of 3 October ends at
   midnight starting 17 October, local time. Days left count calendar days in the same zone, today
   included (mcp-access precedent).

## Guard semantics

- `paid` while `is_lifetime` or `now < paid_until`; otherwise `trial` while `now < trial_ends_at`;
  otherwise `read_only` (reason: whichever of the two ended last).
- Grants and trial extensions never shorten; a revoke removes paid access and leaves the trial.
- `requireWriteAccess` redirects a visitor without a session to login (as `requireUser`), and
  returns `Err("billing.read_only")` to a read-only account, for the action to show.
