---
change_id: config-lefthook-override-518
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: config-lefthook-override-518

Reviewed: the branch diff against plan.md, change.md and issue #518.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The preset's jobs and order are unchanged (only the header comment changed); the existing preset tests pass as before. | No change. |
| 2 | Check | The README's mechanism is the one the new test runs: `extends: [preset, lefthook.app.yml]` gives the app's `run`, the preset's other jobs, the preset's order and `piped`. | No change. |
| 3 | Check | The README warns that a job redefined in the app's `lefthook.yml` keeps the preset's `run`, and a test pins that behaviour. | No change. |
| 4 | Check | The Next.js typecheck (`next typegen && tsc --noEmit`) is shown for both `pre-commit` and `pre-push`, the two jobs that run `tsc`. | No change. |
| 5 | Check | The skip example moved to the second file and points to the #517 quote marker for verbatim quotes. | No change. |
| 6 | Check | CHANGELOG `## Unreleased`, no version bump (batched release). | No change. |

Gates: see plan.md Progress.
