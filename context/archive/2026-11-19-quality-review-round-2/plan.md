# Plan: quality-review-round-2

## Phases

### Phase 1: jobs cancel time limit (TDD)

- Test: a DELETE that never answers resolves `{ ok: false, error: "network" }` after the time limit.
- Done when: `npx vitest run modules/jobs/tests/use-job-status.test.tsx` passes.

### Phase 2: deploy database (TDD)

- Tests: `countRows` throws on `users"; drop table x; --` before any query; the client gets the three time limits.
- Done when: `npx vitest run tools/deploy` passes for the db tests.

### Phase 3: deploy git (TDD)

- Tests: a push to a remote that refuses carries the reason; a non-fast-forward is retried, another refusal is not;
  a git that hangs past the limit counts as unreachable; `findPreviousTag` throws on a broken repository and returns
  null with no matching tag.
- Done when: `npx vitest run tools/deploy` passes.

## Progress

- [x] Phase 1: jobs cancel time limit (68bfb64)
- [x] Phase 2: deploy database (df06aab)
- [x] Phase 3: deploy git (df06aab)

Evidence: `npx vitest run modules/jobs/tests/use-job-status.test.tsx` green; `npx vitest run tools/deploy
modules/backup` 62 files, 1016 tests green; typecheck, ESLint and the language gate in the pre-commit hook.
