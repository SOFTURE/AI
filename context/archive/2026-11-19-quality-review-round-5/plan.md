# Plan: quality-review-round-5

## Phases

### Phase 1: jobs cap tests and deploy first fetch (TDD)

- Tests: `retryJobLater` and `pauseQueueLater` with 30 days end at now + 604 800 s; `integration run` with a remote
  whose first fetch fails exits 1, names git's reason and pushes no ref.
- Done when: `npx vitest run modules/jobs tools/deploy` passes; the deploy test fails on the old source.

## Progress

- [x] Phase 1: jobs cap tests and deploy first fetch (see commit)

Evidence: `npx vitest run modules/jobs tools/deploy` green; the new deploy test fails with the source stashed.
