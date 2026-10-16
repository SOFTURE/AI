---
change_id: db-drizzle-after-ledger-534
status: archived
---

# Plan: drizzleAppMigrations ledger option and shared-ledger refusal (issue #534)

Input: change.md, research.md. Complexity: small (one package, two source files, tests, docs).

## Phase 1: ledger option and refusal (TDD)

Files: `foundation/db/src/migrations/drizzle.ts`, `foundation/db/src/migrations/migrator.ts`,
`foundation/db/src/migrations/problems.ts`, `foundation/db/tests/drizzle-ledger-534.test.ts`, a second fixture folder
`foundation/db/tests/fixtures/app-drizzle-after/` whose only file is older than `app-drizzle`'s.

1. Tests first, on both drivers: a fresh database with `before` on the default ledger and `after` on
   `__drizzle_migrations_after` (its file older than the `before` file) applies both folders and records each in its
   own ledger; a second run applies nothing; `before` and `after` on the same ledger (default, or both naming the same
   table) are refused by `migrate` and `planMigrations` with `db.app_migrations_shared_ledger`, nothing runs (no app
   table, no ledger row), and `describeProblem` names the ledger and the fix.
2. Implement: the options object, a `WeakMap` hook → `"<schema>.<table>"`, `getDrizzleLedger(hook)`; `checkAppHooks`
   in the migrator next to `checkBaseline`; the problem variant and its line.

## Phase 2: docs

`foundation/db/README.md` (the `after` example with its own ledger, why, the refusal), `foundation/db/CHANGELOG.md`
`## Unreleased`, the `drizzleAppMigrations` doc comment.

## Progress

- [x] Phase 1: ledger option and refusal (`9602cc1`; 5 tests written first, all red before the change)
- [x] Phase 2: docs (README `after` example and ledger paragraph, CHANGELOG `## Unreleased`)

Gates on the branch: typecheck, lint and the language gate green (pre-commit); the full `npm test` runs in pre-push.
