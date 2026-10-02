# Implementation review: example-app

Scope: full · Date: 2026-10-02 · Commits: e4d07f0..b3cba4f · Gates: typecheck ✓ lint ✓ test ✓ (651 tests) · e2e ✓ (6 Playwright tests, locally on compose Postgres and in the `e2e` workflow on PR #9)

## Verdict
Ready. The app installs packed copies of core, db and ui, migrates the guestbook module, and the six
e2e tests pass locally and in CI. An independent reviewer pass (read-only subagent) found no blocker,
two warnings and six suggestions; all warnings and suggestions that change code are fixed in b3cba4f.
The plan review's W1 check (break a package on purpose) found a real gap: the build resolved packages
from the repository's `node_modules` past the packed copy; fixed with `turbopack.root` (430f8c4).

## Dimensions
| Dimension | Verdict | Findings |
|---|---|---|
| Plan adherence | PASS | F2 |
| Scope | PASS | only `examples/`, `e2e.yml` and the root wiring the roadmap names |
| Progress honesty | PASS | 2.2 ticked only after the workflow ran green |
| Correctness | PASS | F1 (fixed), F7 (fixed) |
| Tests | PASS | F6 (fixed), W1 mutation check |
| Data and migrations | PASS | one forward migration with a Rollback comment; tests delete their rows |
| Security | PASS | F3 (documented: a fixture, no users, never deployed) |
| Architecture and patterns | PASS | F4, F5 (fixed) |
| Lessons | PASS | L-001: `"use client"` survives in the packed `dist/` (the client components hydrate) |

## Findings
- **F1 WARNING (fixed b3cba4f).** The saved-entry test waited for the dialog to close before reading
  the 3-second toast; a slow runner could miss it. The toast is now asserted first.
- **F2 WARNING (resolved).** Progress 2.2 needed a green `e2e` run on the PR: run 37013256961 passed.
- **F3 SUGGESTION (fixed b3cba4f).** The server action now says why it has neither authorization
  nor a rate limit (AGENTS.md Security).
- **F4 SUGGESTION (fixed b3cba4f).** The page width is a named custom property, not a magic size.
- **F5 SUGGESTION (fixed b3cba4f).** The 200-character limit lives in `modules/guestbook/limits.ts`
  and is filled into the copy with `formatMessage`; the SQL CHECK keeps the literal (the applied
  migration is not edited).
- **F6 SUGGESTION (fixed b3cba4f).** The theme test asserts the exact backgrounds from `DEFAULT_THEME`.
- **F7 SUGGESTION (fixed b3cba4f).** Playwright reused any server on the port outside CI, so a stale
  `next start` could be tested; reuse is now opt-in (`E2E_REUSE_SERVER=1`).
- **F8 SUGGESTION (documented).** Root lint covers the app whenever it is installed; a stale install
  can fail it. README says `npm run e2e` reinstalls.
- **W1 check (fixed 430f8c4).** With `dist` removed from ui's `files`, `next build` still passed:
  Turbopack and TypeScript walked up to the repository's workspace links. `turbopack.root` confines
  the bundle (the same break now fails with "Can't resolve '@softure-ai/ui'"); TypeScript's walk-up
  remains, documented in the app README.

## Plan coverage
| Phase | Commit | Delivered | Notes |
|---|---|---|---|
| 1 App on packed packages | 430f8c4 | yes | added `turbopack.root` (key decision recorded) |
| 2 E2e harness and CI | a7059ca | yes | review fixes in b3cba4f |

## Deferred
- Turbopack and the documented migrations URL: `context/backlog/next-integration.md` (core contract, FD-8 or identity ID-1).
