---
change_id: jobs-queue-pacing-breaker-955
reviewed: 2026-11-02
verdict: approved
---

# Plan review: jobs-queue-pacing-breaker-955

Checked plan.md against change.md, research.md, issue #955 and `claim.ts`, `process.ts`, `run-job-worker.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | With concurrency, jobs already running when the breaker trips fail afterwards and would double the pause at once. | A failure while a pause is active only counts (Phase 2). Tested. |
| 2 | Major | The pacing must hold across processes; a check outside a lock lets two workers pass the same gap. | The paced claim locks the `queue_state` row `FOR UPDATE` in the claim's transaction (Phase 1); a test claims twice inside the gap. |
| 3 | Minor | `JobsPanelActions` gaining required members breaks an app that composes the panel itself. | `pauseQueue` / `resumeQueue` are optional; buttons show only when passed. |
| 4 | Minor | An app with its own full dictionary misses the new copy. | CHANGELOG lists the keys to add. |
| 5 | Minor | A queue without pacing must not wait on a row lock. | Only paced queues lock; others read the pause row without a lock. |

Verdict: approved.
