---
change_id: billing-entitlement-sql-555
status: archived
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

- [x] Phase 1: test factory (078b35d)
- [x] Phase 2: SQL surface (3d01238)
- [x] Phase 3: docs

`src/schema.ts` kept its header: it lists tables, and 0012 adds none. The property tests create their accounts with
`createTestAccount` (auth's registration rate limit refuses more than a few registrations from one client). Two
mutations of the migration (paid access covering its end instant; the creation day read in UTC) each fail the four
property tests. `EXPLAIN` on `entitlement_state` shows the function inlined into two primary-key index scans.
Gates on the branch: typecheck, lint, `npm test` for billing and `tests/repo`.
