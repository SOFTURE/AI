---
change_id: jobs-admin-page-654
reviewed: 2026-10-22
verdict: approved
---

# Plan review: jobs-admin-page-654

Checked plan.md against change.md, research.md, issue #654, `admin.ts`, `sync-items.ts`, `schedules.ts` and the
feature-switches and connections pages.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Critical | Importing `@softure-ai/auth/next` from jobs makes a package and module cycle (research). | Injected `panelGuard` (change.md Decisions); closed when missing. |
| 2 | Major | `retrySyncItem` without resetting attempts is a no-op: the next run fails the item at once. | Plan phase 1 resets attempts and tests the next `processSyncItem`. |
| 3 | Major | A row mapping that spreads `Job` would ship the payload to the browser. | Rows are built field by field; a test asserts no payload key. |
| 4 | Minor | "Run now" through `enqueueScheduledRun` would take the period's slot and skip the regular run. | `runScheduleNow` calls `enqueueJob` directly with the dedup key. |
| 5 | Minor | `next` and `react` become peers of a package that workers use without Next. | Optional peers, imported only from `/next` and `/ui`. |
| 6 | Check | The ledger filter in the URL is a page concern, the panel stays composable. | `JobsPanel` takes `syncFilter` + links prepared by the page. |

No open Critical findings.
