# Plan: quality-review-round-6

## Phases

### Phase 1: signatures and exports (test-after)

- `runTick` takes `{ options, logger, controller, env, waitUntil }`; the 25 internal names lose `export`.
- Done when: typecheck, ESLint and `npx vitest run modules/jobs tools/deploy` pass.

## Progress

- [x] Phase 1: signatures and exports (see commit)

Evidence: a repository-wide search for each name before the change; typecheck, ESLint and the jobs and deploy tests
green.
