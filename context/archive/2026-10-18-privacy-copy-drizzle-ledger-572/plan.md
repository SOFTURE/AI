---
change_id: privacy-copy-drizzle-ledger-572
status: archived
---

# Plan: copyAccount compares the drizzle journal too (issue #572)

Input: change.md, research.md. Complexity: small (one reader, tests, docs).

## Phase 1: drizzle ledgers in the check (TDD)

Files: `modules/privacy/src/server/copy-account.ts`, `modules/privacy/tests/copy-account.test.ts`.

1. Tests first:
   - same module ledger, a drizzle migration only in the target: refused with
     `drizzle.__drizzle_migrations#<when> only in the target`, nothing written; `ledger: "ignore"` copies;
   - the same drizzle journal on both sides (and a second ledger table in `drizzle`) copies; a changed hash is named
     as `has another checksum`;
   - neither database has the `drizzle` schema: copies as today (the existing tests).
2. `readLedger` also reads every `drizzle` table with columns `hash` and `created_at` into the same map; doc comments
   of `ledger` and `Ledger` updated.

## Phase 2: docs

`modules/privacy/README.md` (refusal list, "Same migrations"), `CHANGELOG.md` `## Unreleased` with what the adopting
app can drop.

## Progress

- [x] Phase 1: drizzle ledgers in the check (8380f90; 2 tests, the refusal test red before the change; 15 of 15 copy tests pass)
- [x] Phase 2: docs (a436dd8; README refusal list and "Same migrations", CHANGELOG `## Unreleased` with the migration)
