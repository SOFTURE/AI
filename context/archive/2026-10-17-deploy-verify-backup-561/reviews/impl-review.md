---
change_id: deploy-verify-backup-561
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: deploy-verify-backup-561

Checked the diff against change.md, plan.md and issue #561.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: a corrupted or cut dump fails `pg_restore --exit-on-error` (verified on Postgres 16) and maintain ends `result|failed|verify-backup|…`; tested with a failing restore. | No change. |
| 2 | Check | Acceptance 2: `verify-tables` leaves `excludeTableData` out; tested in compose-exec mode. | No change. |
| 3 | Check | The throwaway database is dropped on success, by the exit trap after a failure, and a leftover is dropped before `CREATE`. | No change. |
| 4 | Minor | The issue proposes the log line `backup-verify|ok|<file>`; every other line of deploy.sh is `step|<name>|ok|<detail>`. | Kept the existing format: `step|verify-backup|ok|<file>`. |
| 5 | Minor | A dump cut in its last bytes (after the final data block) still restores completely, so it passes; the data is all there. | No change; noted here. |
| 6 | Check | No bash 4 features, no GNU-only flags; `date +%u` is POSIX. | No change. |

No Critical findings.
