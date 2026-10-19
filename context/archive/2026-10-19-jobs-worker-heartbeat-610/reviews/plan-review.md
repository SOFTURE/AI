---
change_id: jobs-worker-heartbeat-610
reviewed: 2026-10-19
verdict: approved
---

# Plan review: jobs-worker-heartbeat-610

Checked plan.md against change.md, research.md, issue #610, `run-job-worker.ts`, `process.ts`, the deploy templates and
`app-facts.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `--health` on a jobs version without it starts a second worker inside the health check. | Covered: init gates on the installed version; the jobs README tells an app to upgrade before switching the check. |
| 2 | Major | `--health` must exit even when the config or handlers module keeps a handle open. | `runJobWorkerProcess` only sets `process.exitCode`; the template's `await` returns and node exits when idle. Note in the README that a module with open handles at import needs `process.exit`. |
| 3 | Minor | The clock passed to the loop can be a test clock; the check compares the file's real mtime with `Date.now()`. | The check takes `now` (default `Date.now()`); the loop never reads the clock for the file. |
| 4 | Minor | Plain Docker does not restart unhealthy containers. | README says what the check gives and that `restart:` does not act on it. |
| 5 | Check | PR #611 changes the same compose block. | Fresh master merged in before this one; phase 2 starts from #611's check. |

No Critical findings.
