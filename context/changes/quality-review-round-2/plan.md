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

- [ ] Phase 1: jobs cancel time limit
- [ ] Phase 2: deploy database
- [ ] Phase 3: deploy git
