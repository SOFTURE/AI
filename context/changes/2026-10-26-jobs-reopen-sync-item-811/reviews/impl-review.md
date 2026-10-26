---
change_id: jobs-reopen-sync-item-811
reviewed: 2026-10-26
verdict: approved
---

# Implementation review: jobs-reopen-sync-item-811

Reviewed commit 75ec63e against plan.md and issue #811.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Minor | A run that settles the item between the conditional `UPDATE` (no row: still `pending`) and the read would make the call return a settled item without reopening it. | Fixed in this review: when the read finds the item settled, the `UPDATE` runs once more. |

- `reopenSyncItem` matches the issue's signature and result; settled items reopen as never tried (attempts, code,
  result reference, finish time cleared), a `pending` item is returned unchanged, invalid input is `not_found`.
- Tests cover done, skipped and failed (and that the next `processSyncItem` runs the callback once), the pending
  no-op, not-found inputs, and the commit and rollback together with an enqueue in the caller's transaction.
- README (server table, "Sync state for polling" with the transaction example) and CHANGELOG `Unreleased` with the
  migration for an app that writes the table itself. No version bump, no panel change (change.md Decisions).
- Gates: typecheck, ESLint, language gate green; jobs steering tests 12/12.

Verdict: approved.
