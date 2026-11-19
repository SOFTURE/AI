# Plan: quality-review-security-jobs-deploy

## Phases

### Phase 1: security webhook (TDD)

- Tests (`webhook.test.ts`): a resend of the same signed body with a new delivery id header answers 200 and skips the
  work; a failing handler logs only the error's kind (`Error`), not its message.
- Done when: `npx vitest run modules/security` passes.

### Phase 2: jobs hooks and poll (TDD)

- Tests: a hook that never settles is logged as timed out after `hookTimeoutMs` and the worker goes on; the hook's
  signal is aborted; `err("socket hang up")` stores `jobs.handler_threw`, an over-long dotted code its first 200
  characters; a status poll that hangs ends as `network` after its time limit.
- Done when: `npx vitest run modules/jobs` passes.

### Phase 3: deploy exports (test-after)

- Drop the `export` of the nine constants and `getVerifyTables`; nothing outside their modules imports them.
- Done when: `npx vitest run tools/deploy` passes and typecheck is clean.

## Progress

- [x] Phase 1: security webhook (e3da6e0)
- [x] Phase 2: jobs hooks and poll (fd0c83e)
- [x] Phase 3: deploy exports (a5abb3f)

Evidence: `npx vitest run modules/jobs` 25 files, 374 tests green; `npx vitest run modules/security modules/alerts
tools/deploy` 80 files, 1468 tests green; typecheck, ESLint and the language gate run in the pre-commit hook.
Phase 2 found a real gap through its new test: `toErrorCode` let any text with a dot through (an email address), so
`last_error` now takes only the code shape (`src/server/error-code.ts`, shared with the sync ledger).
