# Plan: pwa-keeps-no-pages

## Approach
Accept `maxPages: 0` in `resolveServiceWorkerConfig` and skip keeping and reading pages in the worker's navigation.

## Phases
### Phase 1: maxPages 0 (TDD)
- Tests first in `modules/pwa/tests/service-worker.test.ts`: with `maxPages: 0` a navigation answers from the network
  and keeps nothing; a failed network answers the offline page even after an earlier visit; a slow network is still
  waited for; a silent one gets the offline page at `navigationMaxWaitMs`; the shell's immutable files are still
  kept; a negative cap and `startPath` with no kept pages are refused.
- `source.ts` (`checkNonNegativeInteger`, the `startPath` check), `service-worker.ts` (`isKeepingPages`), README,
  changelog `## Unreleased`, then `release:version pwa minor`.
- Done when: the tests fail without the change and pass with it; typecheck, lint and the package's tests pass.

## Progress
- [x] Phase 1: maxPages 0 (without the source change 8 of 104 tests fail; with it the package's 328 tests pass:
  `npx vitest run modules/pwa`).

## Decisions (auto)
- See `change.md`.
