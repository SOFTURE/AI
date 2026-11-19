# Plan: jobs expected failures

## Approach

An optional flag from `failJob` to the end line, nothing else changes.

## Phases

### Phase 1 (test-first)

- `modules/jobs/tests/run-log.test.ts`: an expected `failJob` logs `warn` with `expected: true` and the job is
  `failed`; `failJob` with `{ expected: false }` or no options logs `error`; a retried failure carrying the mark stays
  `error`.
- `contract.ts`, `handlers.ts`, `index.ts`, `server/process.ts`, `server/claim.ts`, `server/run-log.ts`.
- Done when: `npx vitest run modules/jobs` green; `tsc -p modules/jobs` and ESLint clean.

### Phase 2: docs and version

- README, CHANGELOG; `npm run release:version -- jobs patch` (0.1.12) on master after the merge, released through
  `auto-release.yml`.

## Progress

- [x] Phase 1 (`npx vitest run modules/jobs`: 25 files, 368 tests green; typecheck and ESLint clean)
- [x] Phase 2 (README and CHANGELOG; the version follows on master)
