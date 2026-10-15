---
change_id: db-test-database-close-523
status: in_progress
---

# Plan: createTestDatabase's close() on an unqueried copy (issue #523)

Input: change.md, research.md. Complexity: small (one line, tests, changelog).

## Phase 1: wait for PGlite before returning a handle (TDD)

Files: `foundation/db/src/client.ts`, `foundation/db/tests/testing.test.ts`, `foundation/db/tests/client.test.ts`.

1. Tests first: `createTestDatabase` copy that is never queried closes (`close()` resolves); `createPgliteHandle`
   over a fresh `new PGlite()` closes without a query. Both red on master (timeout).
2. Implement: `await client.waitReady` in `createPgliteHandle` before returning the handle.

## Phase 2: docs

`foundation/db/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: wait for PGlite before returning a handle (`7c13d96` tests red on PGlite 0.5.10, the lockfile now
  resolves 0.5.10 within the existing `^0.5.8` range; fix in the next commit, both tests green)
- [x] Phase 1b: the migrator test driver waits for PGlite before dumping its empty data folder (hung on 0.5.10)
- [x] Phase 2: docs (CHANGELOG `## Unreleased`, the `createPgliteHandle` doc comment)
