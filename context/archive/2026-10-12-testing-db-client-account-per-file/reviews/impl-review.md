---
change_id: testing-db-client-account-per-file
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: testing-db-client-account-per-file

## Verdict

Approved after one fix. Both helpers match the plan; existing exports are unchanged.

## Plan coverage

| Phase | Commit | Covered |
| --- | --- | --- |
| 1. Test database client | 18385a3 | `database-client.ts`, entry export, `pg` optional peer, 8 tests |
| 2. One account per test file | d925bb0 | `signInPerFile` in `auth.ts`, 2 browser tests, README, CHANGELOG `Unreleased` |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | `database-client.ts` imports `pg` but the package listed no `@types/pg`; typecheck passed only through the hoisted copy from `@softure-ai/db`. | Fixed: `@types/pg` added to devDependencies. |
| F2 | Check | `countRows` puts only validated, quoted identifiers into SQL; values go through `$n`. Injection attempts are refused before any query (test). | No change. |
| F3 | Check | The emitted `dist/playwright/database-client.d.ts` names `pg` only in a comment, so an app without `@types/pg` type-checks. | No change. |
| F4 | Check | A refused registration resets the stored attempt, so the next `signIn` registers again (test asserts two register posts). | No change. |
| F5 | Suggestion | The refused-registration browser test takes about 10 s because `registerAccount` waits for its landing timeout twice. | Accepted: the same wait as the existing `logIn` refusal test. |

## Progress audit

Every ticked item has its test or file: 1.1 `tests/playwright-database.test.ts`, 1.2 `grep pg dist/playwright/*.d.ts`,
2.1 the two `signInPerFile` cases in `tests/playwright-browser.test.ts` (run with `PLAYWRIGHT_CHROMIUM_PATH`), 2.2
README rows and `## Unreleased`; gates by the pre-commit and pre-push hooks.

## Decisions (auto)

- F1 fixed in this review; F5 accepted.
