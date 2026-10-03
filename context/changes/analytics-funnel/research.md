# Research: analytics-funnel

Sources: FIRE_TRACKER (read only) `src/lib/funnel-steps.ts`, `src/lib/funnel-beacon.ts`,
`src/db/funnel-counts.ts`, `src/app/actions/do-funnel.ts`, `src/app/kalkulator/licznik/route.ts`,
`scripts/kanaly-report.sql`; this repository's MO-4 (`archive/2026-10-03-analytics-channel-tags`),
`modules/security` (`readSmallBody`), `modules/waitlist` and `modules/mcp-access` (route factory,
health check, migrations).

## 1. What FIRE counts and how

- One row per (day, channel, step) with a counter; `''` is "no tag". The day is computed in a fixed
  zone (`Europe/Warsaw`), not the server's.
- One `INSERT … ON CONFLICT DO UPDATE` chooses the channel's key and increments, so parallel events
  never lose each other. New tags past 100 a day count under an overflow key outside the tag's
  alphabet; a tag already known is never capped.
- The beacon carries `k=<step>&z=<tag>`; the pixel reads the tag from the landing page's Referer.
  Bad input always answers 204 (or the GIF): access logs record every 4xx, and a scanner gets no
  oracle. 503 only when the database fails. `no-store` everywhere.
- No per-address rate limit on purpose: it would store every visitor's address.
- The report is a SQL script joining the funnel with `waitlist_signups` and `users.signup_channel`.

## 2. Decisions for the module

| Question | Choice | Why |
| --- | --- | --- |
| Steps | `funnel.steps: [{ id, via }]`, `via` = `pixel`, `beacon` or `server` | the endpoint refuses `server` steps, so sign-ups cannot be inflated from outside |
| Channel of a beacon | read from the page's Referer, not the body | same rule as the rest of the module (`readChannel`); the body carries only the step |
| Other modules' counts (unknown in the roadmap) | the app counts them as `server` steps through hooks; the report reads only `funnel_counts` | no cross-schema reads; auth has `onRegistered` (`countRegistration`), the waitlist has no hook yet (FU-7) |
| Day | `Intl` with `config.timezone` | independent of the server's zone; one function for counting and for the report window |
| Cap | `channelCap` (default 100), overflow key `~overflow`; the options refuse a pattern that accepts it | FIRE's bound, configurable |
| Retention (unknown in the roadmap) | kept until the app calls `pruneFunnelCounts({ keepDays })` | the sums hold no personal data |
| Body limit | `readSmallBody` from security, 256 bytes | the body is `step=<id>` |
| A failed count in sign-up | a savepoint, logged, never thrown | a failed statement aborts the whole transaction; a counter must not refuse sign-ups |
