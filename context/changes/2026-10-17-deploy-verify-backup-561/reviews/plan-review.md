---
change_id: deploy-verify-backup-561
reviewed: 2026-10-17
verdict: approved
---

# Plan review: deploy-verify-backup-561

Checked plan.md against change.md, research.md, issue #561 and `deploy.sh.tmpl`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A failing verify that exits before `DROP DATABASE` leaves a database the size of production. | Drop from the exit trap as well, and `DROP … IF EXISTS` before `CREATE`, so a killed run is cleaned up by the next. |
| 2 | Minor | The existing maintain test would flip with the weekday. | A stub `date` in the stub folder for every test, a fixed weekday unless a test sets one. |
| 3 | Minor | A table both counted and excluded would restore empty and fail. | `verify-tables` leaves excluded tables out (acceptance point 2). |
| 4 | Check | `pg_restore` runs as the superuser, so ownership and grants to the app roles are restored and a missing role fails. | No change. |
| 5 | Minor | The restore doubles the database's disk use for its duration. | Say so in the README next to `verifyBackup`. |

No Critical findings.
