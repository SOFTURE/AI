---
change_id: billing-entitlement-sql-555
---

# Research: billing-entitlement-sql-555

Sources: `modules/billing/src/entitlement.ts` (`resolveEntitlement`), `src/server/entitlements.ts`
(`getDefaultRecord`, `findEntitlementRecord`), `src/calendar.ts` (`getStartOfDay`), migrations 0001 and 0003,
`modules/mailing/migrations/0005_*.sql`, `modules/auth/src/testing/account.ts`, `tests/support.ts`.

- A record is `{ trialEndsAt, paidUntil, isLifetime }`; an account without a row derives
  `trialEndsAt = startOfDay(max(localDay(created_at), trial.startsAt) + trial.days)` in the app's time zone.
- Resolution order: lifetime → paid; `now < paidUntil` → paid until it; `now < trialEndsAt` → trial; else read-only
  since `paidUntil` (reason `paid_ended`) when it is after the trial end, otherwise since the trial end.
- Migration 0003 dropped `entitlements_lifetime_without_end`: `paid_until` lives on under lifetime access.
- `(day + n)::timestamp AT TIME ZONE tz` gives the start of a local day. Probed on PGlite: Warsaw 2026-10-17 →
  `2026-10-16T22:00Z` (matches the tests); America/Santiago 2026-09-06, where 00:00 is skipped, → `04:00Z`, which
  is 01:00 local and what `getStartOfDay` returns. `greatest()` ignores NULL, so a missing `trial_starts_on` works.
- Mailing's surface: plain `LANGUAGE sql STABLE` functions, every name qualified (a function runs with the caller's
  `search_path`), rollback in the header.
- `createTestAccount(target, input)` takes a database or a module context; billing rows need the account first
  (foreign key to `auth.users`).
- No property-testing library in the repository; a seeded generator in the test is enough.
