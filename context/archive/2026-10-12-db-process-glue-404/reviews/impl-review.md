---
change_id: db-process-glue-404
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: db-process-glue-404

Checked the diff (`184ec03`, `5455585`, `7917506`) against change.md, plan.md and the plan review.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | An esbuild build failure (a missing entry, an unresolvable import) surfaced as esbuild's bare "Build failed" without naming the operation (AGENTS.md, Errors). | Fixed: wrapped as `findEntriesReachingDatabase: esbuild could not follow the entries' imports: …`, with a test. |
| 2 | Check | `closeProcessDatabases()` racing an `open()` in flight: the close awaits the pending open, then closes the handle it produced; `isOpen()` ends false. | No change. |
| 3 | Check | Plan review #2: a state enters the registry only on `open()` and leaves it on close or a failed open. | No change. |
| 4 | Check | `dist/testing.d.ts` and `dist/entry-guard.d.ts` reference no esbuild type, so an app without esbuild still typechecks. | No change. |
| 5 | Note | The default openers are patterns over the entry's source, so a commented-out `open()` counts as opening. Documented; the app's own check worked the same way. | No change. |

No Critical findings.
