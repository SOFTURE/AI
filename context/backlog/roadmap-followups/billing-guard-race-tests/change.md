---
change_id: billing-guard-race-tests
title: "Billing guards and lock races are tested where they can fail"
status: backlog
roadmap_item: FU-26
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

CI proves billing's guards and locks: `requireWriteAccess` and every billing server action are unit-tested as anonymous, member and admin; the first-insert race of `changeEntitlement` and two concurrent plan grants run on two Postgres connections; an e2e covers a paid period that ended; a misspelt `adminRole` (not among `auth({ roles })`) fails at setup instead of silently locking every admin out.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-26** (roadmap `followups`):

> - **Outcome:** CI proves billing's guards and locks: `requireWriteAccess` and every billing server action are unit-tested as anonymous, member and admin; the first-insert race of `changeEntitlement` and two concurrent plan grants run on two Postgres connections; an e2e covers a paid period that ended; a misspelt `adminRole` (not among `auth({ roles })`) fails at setup instead of silently locking every admin out.
> - **Prerequisites:** FU-25 on `master` (lane C).
> - **Unknowns:** How a unit test mocks the Next session for `/next` actions (auth's test helpers vs. a module mock); running the two-connection tests against the CI Postgres service vs. the e2e database.
> - **Baseline:** monetization MO-1 and MO-2: the guards are correct today but no unit test calls them without a session or role; the race tests run on PGlite, one connection, so they cannot fail (MO-1 impl review #5, MO-2 impl review #1). After: the gap is closed by the tests themselves.

## Constraints

- Owns: `modules/billing/tests/`, the setup assertion in `src/server/setup.ts`, `examples/next-app/e2e/billing-entitlements.spec.ts` (lane C, after FU-25).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-12 (`billing-retro-reviews`, 2026-10-04).
