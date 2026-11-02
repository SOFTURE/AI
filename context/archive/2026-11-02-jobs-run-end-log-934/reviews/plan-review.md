---
change_id: jobs-run-end-log-934
reviewed: 2026-11-02
verdict: approved
---

# Plan review: jobs-run-end-log-934

Checked plan.md against change.md, research.md, issue #934 and `process.ts`, `claim.ts`, `logger.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Logging before the fenced write would report attempts a stale worker never recorded. | Plan logs only after `completeJob` returns true; a test pins no line for a stale write. |
| 2 | Minor | Exact-line assertions in `process.test.ts` break once every attempt logs. | Plan updates them to the new full sequence. |
| 3 | Minor | A logger that serialises `Date` differently would print `runAt` inconsistently. | ISO string (change.md Decisions). |
| 4 | Minor | The default `"all"` adds an info line per success; frequent queues may be noisy. | `logRuns` option, documented in README and CHANGELOG. |

Verdict: approved.
