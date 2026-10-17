---
change_id: billing-entitlement-sql-555
status: in_progress
---

# Plan: entitlement state in SQL and a test factory (issue #555)

Input: change.md, research.md. Complexity: medium (one migration, a TS helper, a testing entry point, tests, docs).

## Phase 1: test factory (TDD)

Files: `modules/billing/src/testing/{index,entitlement}.ts`, `package.json` (`./testing` export),
`tests/testing.test.ts`.

1. Tests first: `createTestEntitlement` writes the row (defaults: trial end = the derived trial with a context, the
   account's creation with a bare database; no paid end; not lifetime) and overwrites it on a second call;
   `setTestEntitlementState` gives `getEntitlement` the named state (trial, paid, lifetime, read-only for both
   reasons) at the clock's instant; an unknown account throws.
2. The helpers.

## Phase 2: SQL surface (TDD)

Files: `migrations/0012_create_entitlement_state_functions.sql`, `src/server/entitlement-sql.ts`,
`src/server/index.ts`, `src/schema.ts` (header list), `tests/entitlement-sql.test.ts`.

1. Tests first: a seeded property test over three configurations (Warsaw 14 days, `trial.startsAt`, America/Santiago
   and 0 days) with accounts without a row and with random rows, checked at random instants against
   `getEntitlement`; `entitlement_state` for one account and none for an unknown id; `getEntitlementStatesSql`
   fills the configuration.
2. The migration and `getEntitlementStatesSql(ctx, asOf)`.

## Phase 3: docs

`README.md` (the SQL contract, the testing helpers, the migration for an app dropping its own inserts),
`CHANGELOG.md` `## Unreleased`.

## Progress

- [ ] Phase 1: test factory
- [ ] Phase 2: SQL surface
- [ ] Phase 3: docs
