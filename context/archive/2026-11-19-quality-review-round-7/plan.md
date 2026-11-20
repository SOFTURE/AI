# Plan: quality-review-round-7

## Phases

### Phase 1: leased runDueJobs and webhook event time (TDD)

- Tests first: runDueJobs aborts a handler on a cancel seen by a heartbeat and on a lease taken by another claim;
  handleWebhook skips an event older than `retentionDays`, runs one at the boundary, treats an invalid date as old.
- Done when: typecheck, ESLint and `npx vitest run modules/jobs modules/security` pass.

## Progress

- [x] Phase 1: leased runDueJobs and webhook event time (see commit)

Evidence: `npx vitest run modules/jobs` 383 passed, `npx vitest run modules/security` 426 passed.
