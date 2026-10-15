---
change_id: auth-create-account-script-521
status: archived
---

# Plan: create-account ops script (issue #521)

Input: change.md, research.md. Complexity: small (one script, a shared helper, tests, docs).

## Phase 1: `createCreateAccountScript` (TDD)

Files: `modules/auth/src/scripts/create-account.ts`, `modules/auth/src/scripts/password-choice.ts` (moved from
`temporary-password.ts`), `modules/auth/src/scripts/index.ts`, `modules/auth/tests/create-account.test.ts`.

1. Tests first: a dry run writes nothing and reports `{ before: { accounts }, after: { userId, accounts,
   temporaryPassword } }`; `--commit` creates an account the login accepts with registration closed; a given hash
   is stored and reported as `passwordFrom: "hash"`; an existing email (any case) and an invalid email are refused;
   `maxAccounts: 1` refuses when one account exists and allows the first; `maxAccounts` below 1 or fractional throws
   at creation; the CLI output never carries the email or the hash.
2. Implement: lock `auth.users`, count, refuse at the limit, parse the email, choose the password, insert with
   `onConflictDoNothing`, report by user id.

## Phase 2: docs

`modules/auth/README.md` (section 1 list, "First account" paragraph after account recovery, known gap),
`modules/auth/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: `createCreateAccountScript` (`dc21e49`; 10 tests written first, all red before the change)
- [x] Phase 2: docs (`a75bf5d`; README "First account", section 1, known gap; CHANGELOG `## Unreleased`)

Gates on the branch: `npm run typecheck` and ESLint green; auth create-account and temporary-password tests 25 passed;
the full `npm test` runs in pre-push.
