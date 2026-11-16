---
change_id: quality-review-guards-1285
status: in_progress
---

# Plan: "use server" export guard and an unused peer (issues #1285, #1287)

Input: change.md. Complexity: small.

## Phase 1: the guard over every package, and the jobs fix (TDD)

Files: `tests/repo/server-actions.test.ts`, `modules/jobs/src/next/actions.ts`, `modules/jobs/src/next/panel-pause.ts`,
`modules/jobs/src/next/index.ts`, `modules/jobs/CHANGELOG.md`.

- Test first: the repository test reads every `src/**/*.{ts,tsx}` of each workspace package (`foundation`, `modules`,
  `themes`, `tools`) and expects `findNonAsyncServerExports` to return `[]`. It fails on master with the jobs line.
- Move the constant to `panel-pause.ts`, import it in `actions.ts`, re-export it from `next/index.ts`.

## Phase 2: theme-flat-paint peer

Files: `themes/theme-flat-paint/package.json`, `package-lock.json`, `themes/theme-flat-paint/CHANGELOG.md`.

- Drop `react` from `peerDependencies`; refresh the lockfile entry.

## Decisions (auto)

- Only the export rule runs over the packages: the other server-action rules assume an app's layout
  (implementation files, a database handle) and do not apply to a package's own sources.
- Both fixes in one pull request: two small findings of the same review.

## Progress
