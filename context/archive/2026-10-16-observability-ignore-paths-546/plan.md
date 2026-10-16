---
change_id: observability-ignore-paths-546
status: archived
---

# Plan: ignore paths for server traces (issue #546)

Input: change.md, research.md. Complexity: small (one sampler, one option, tests, docs).

## Phase 1: sampler (TDD)

Files: `foundation/observability/src/node/ignore-paths-sampler.ts`, `tests/ignore-paths-sampler.test.ts`.

1. Tests first: an ignored path (also with a query string, also below it) is not exported and neither is its child;
   another path and a prefix that is not a whole segment are exported; a CLIENT span with an ignored path is kept;
   an entry without a leading `/` throws naming the option.
2. `createIgnorePathsSampler(paths)`.

## Phase 2: wiring

Files: `src/node/config.ts` (`traces.ignorePaths`), `src/node/start.ts`.

## Phase 3: docs

`README.md`, `CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: sampler
- [x] Phase 2: wiring
- [x] Phase 3: docs

The wiring tests were red before `start.ts` changed. Gates on the branch: typecheck, lint, build and `npm test`.
