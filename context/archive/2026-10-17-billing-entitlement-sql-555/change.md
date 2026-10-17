---
change_id: billing-entitlement-sql-555
title: "billing: entitlement state in SQL and a test factory in billing/testing (issue #555)"
status: archived
roadmap_item: null
issue: 555
branch: claude/project-thread-8t6fqx
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #555](https://github.com/SOFTURE/AI/issues/555): an adopting app re-implements billing's state machine
in SQL (recipient selection, reports) and inserts `billing.entitlements` rows by hand in fixtures, so any change to
the package's rules silently diverges.

## Context

Labels: `enhancement`, `pkg: billing`, `adoption`. Same shape as mailing's SQL surface (migration 0005). No version
bump; CHANGELOG `## Unreleased`; the coordinator cuts the combined release.

## Constraints

- The SQL surface agrees with `getEntitlement` (status, end, read-only start and reason) on a property test.
- The derived trial depends on the app's configuration (`trial.days`, `trial.startsAt`, the time zone), which the
  database does not know: the surface must not guess it.
- `@softure-ai/billing/testing` is never imported by the module's runtime code.

## Notes

- Framing: skipped. The issue names the fix.

## Decisions (auto)

- The trial policy is passed in as arguments, not stored in a settings table: no hidden state to sync and nothing
  to drift when the configuration changes. `getEntitlementStatesSql(ctx, asOf)` in `/server` fills the arguments
  from the app's configuration for SQL built in TypeScript; plain SQL (reports, psql) passes them itself.
- Two functions: `billing.entitlement_states(as_of, trial_days, time_zone, trial_starts_on)` over every account and
  `billing.entitlement_state(user_id, as_of, ...)` for one. `days_left` and `is_ending` stay in TypeScript
  (display concerns, reminder options).
- `createTestEntitlement(target, input)` upserts the row (so a test can move an account between states);
  `setTestEntitlementState(target, { userId, state })` puts an account in a named state relative to the clock.
  `target` is a database or a billing context, like auth's `createTestAccount`.
