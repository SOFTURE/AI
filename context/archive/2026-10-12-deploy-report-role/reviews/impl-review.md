---
change_id: deploy-report-role
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: deploy-report-role

Reviewed: the branch diff against plan.md, change.md and issue #383.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: none. One optional answer, one flag, the role pattern shared through `POSTGRES_ROLE`. | No change. |
| 2 | Check | Plan review finding 2: `getReportRole` is not exported from `src/init/index.ts`, so its new signature changes no public API. | No change. |
| 3 | Check | Without `--report-role` `deploy.sh` is byte-identical to master's output; only the unreadable-role warning gains the flag hint (tested). | No change. |
| 4 | Info | The `deploy.sh` template comment above `REPORT_ROLE` still says the role comes from the compose file. Changing it would change every app's rendered `deploy.sh` and trip their drift guards for a comment. | Left as is. |
| 5 | Check | Invalid values (`ledger-app;id`) are refused before anything is written, with the field named (tested). | No change. |

Gates: see plan.md Progress.
