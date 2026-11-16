---
change_id: quality-review-guards-1285
status: archived
---

# Plan: "use server" export guard and an unused peer (issues #1285, #1287)

Input: change.md. Complexity: small.

## Phase 1: the guard over every package, and the jobs fix (TDD)

Files: `tests/repo/server-actions.test.ts`, `modules/jobs/src/next/actions.ts`, `modules/jobs/src/next/panel-pause.ts`,
`modules/jobs/src/next/index.ts`, `modules/jobs/CHANGELOG.md`.

- Test first: the repository test reads every `src/**/*.{ts,tsx}` of each workspace package (`foundation`, `modules`,
  `themes`, `tools`) and expects `findNonAsyncServerExports` to return `[]`. It fails on master with the jobs line.
- Move the constant to `panel-pause.ts`, import it in `actions.ts`, re-export it from `next/index.ts`.

## Phase 2: accept the theme's react peer

Files: `quality-review.ignore`.

- Dropping the peer fails `tests/repo/themes.test.ts`: the theme package contract (theme-kit README, item 3) has every
  theme take `react` as a peer. The finding is a false positive; the root ignore file accepts it with the reason.

## Decisions (auto)

- Only the export rule runs over the packages: the other server-action rules assume an app's layout
  (implementation files, a database handle) and do not apply to a package's own sources.
- #1287 is closed by the ignore entry, not a manifest change: the contract wins over a generic rule.
- Both fixes in one pull request: two small findings of the same review.

## Progress

- [x] Phase 1: 0f18d55 (`npx vitest run tests/repo/server-actions.test.ts modules/jobs`: 356 passed; the new test failed on master with the jobs line)
- [x] Phase 2: 013ff1f (dropping the peer failed `tests/repo/themes.test.ts`, the contract test; reverted, the finding accepted instead; `npx vitest run tests/repo modules/jobs`: 1303 passed)
