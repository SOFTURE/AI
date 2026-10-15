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

- [ ] Phase 1: wait for PGlite before returning a handle
- [ ] Phase 2: docs
