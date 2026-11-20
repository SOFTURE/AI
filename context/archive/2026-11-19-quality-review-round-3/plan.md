# Plan: quality-review-round-3

## Phases

### Phase 1: jobs (TDD)

- Tests: a worker whose heartbeats fail keeps the handler running until the lease ended, then aborts it with a
  `warn`; a worker whose claim token changed aborts with `job lease lost`; a handler's longer `pauseQueueLater` keeps
  an operator's timed pause.
- Done when: `npx vitest run modules/jobs` passes; both fixed tests fail without the source change.

### Phase 2: deploy backup (TDD)

- Tests: `pg_dump` gets `--lock-wait-timeout=30000`; `PGCONNECT_TIMEOUT` is 10 unless the URL sets it; a `pg_dump`
  past `timeoutMs` is stopped, reported and leaves no file.
- Done when: `npx vitest run tools/deploy` passes for the backup tests.

### Phase 3: deploy integration (TDD)

- Tests: a remote that goes away after the push ends `wait-unreachable` with git's reason and logs each failed fetch;
  a lost race is retried and recorded; five lost races give up with the last reason; the existing timeout (75) holds.
- Done when: `npx vitest run tools/deploy` passes.

## Progress

- [x] Phase 1: jobs (see commit)
- [x] Phase 2: deploy backup (see commit)
- [x] Phase 3: deploy integration (see commit)

Evidence: `npx vitest run modules/jobs tools/deploy` green; the lease and pause tests fail on the old source (checked
with the source stashed), as does the wait-unreachable test; typecheck and ESLint clean.
