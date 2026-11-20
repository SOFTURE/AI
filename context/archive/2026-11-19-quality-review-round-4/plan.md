# Plan: quality-review-round-4

## Phases

### Phase 1: jobs hanging heartbeat (TDD)

- Test: while every top-level `update` waits unanswered, the handler is not aborted before its lease end and is
  aborted after it, with the `warn` line.
- Done when: `npx vitest run modules/jobs` passes; the test fails on the old source.

### Phase 2: deploy lookup and unexpected errors (TDD)

- Tests: `lookup` with an unreachable remote and a local note prints the stderr line; with nothing local it exits 1;
  `release-notes` with an unwritable `--out` and outside a repository ends with one line and exit 1.
- Done when: `npx vitest run tools/deploy` passes; the CLI tests fail on the old source.

## Progress

- [x] Phase 1: jobs hanging heartbeat (see commit)
- [x] Phase 2: deploy lookup and unexpected errors (see commit)

Evidence: `npx vitest run modules/jobs tools/deploy` green; the new jobs and CLI tests fail with the source stashed;
typecheck and ESLint clean.
