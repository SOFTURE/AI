---
change_id: jobs-admin-page-654
reviewed: 2026-10-22
verdict: approved
---

# Implementation review: jobs-admin-page-654

Checked the diff against change.md (acceptance 1-5), plan.md and issue #654.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every action calls the guard's `authorizeRole(panelRole)` before reading its form; a missing guard refuses with `auth.forbidden`; the page calls `notFound()` without a guard. | Tests cover the refusal, the role name passed and that nothing changed. |
| 2 | Check | Rows are built field by field; the page test renders a job whose payload holds an e-mail address and asserts it is absent. | As planned (plan review #3). |
| 3 | Minor | A job put back by **Retry** keeps its `last_error`, so until it runs it is listed as retrying with **Cancel**. | Kept: it is waiting to run again, and the code tells the operator why it was retried. |
| 4 | Minor | A schedule no worker has seen shows as `late`, as `getQueueStats` reports it, with the line "No worker has run this schedule yet". | Kept: that is the signal the operator needs. |
| 5 | Check | `runScheduleNow` does not take the period's slot (test: `enqueueDueSchedules` still enqueues, joining the pending run). | As planned (plan review #4). |
| 6 | Check | `retrySyncItem` resets attempts; the next `processSyncItem` with `maxAttempts: 1` runs the callback. | As planned (plan review #2). |
| 7 | Check | Section headings are `h3` under the `Card`'s `h2`; markup guards pass (no raw colour, no inline copy, ui classes only). | — |

No Critical or Major findings.
