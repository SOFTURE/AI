---
change_id: jobs-reopen-sync-item-811
reviewed: 2026-10-26
verdict: approved
---

# Plan review: jobs-reopen-sync-item-811

Checked plan.md against change.md, research.md, issue #811 and `sync-items.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Reopening while `processSyncItem` handles the item could race. | The conditional `UPDATE` waits for the row lock and re-checks status (research); no extra lock needed. |
| 2 | Minor | A repeated call on a `pending` item that is mid-retry (attempts > 0) must not reset its attempts. | Plan returns a `pending` item unchanged; a test pins it. |
| 3 | Minor | The issue asks for atomicity with the caller's enqueue. | Plan tests a rollback inside `ctx.db.transaction`. |

Verdict: approved.
