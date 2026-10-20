---
change_id: deploy-script-handoff-621
reviewed: 2026-10-20
verdict: approved
---

# Plan review: deploy-script-handoff-621

Checked plan.md against change.md, research.md, issue #621 and the template.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The child reopening `.deploy.lock` would block on the parent's lock until the 10-minute wait fails. | Planned: a handed-off child keeps the inherited fd 9; `flock` on the same open file description succeeds at once. |
| 2 | Major | The registry token is moved out of the release folder before the pull; a hand-off after that would give the child an archive check, but its own unpack restores the token from the archive. | Hand off before the token step anyway, so the parent never touches it. |
| 3 | Minor | `finish` of the parent would print a second `result|` line. | `reports_result=""` before the child runs. |
| 4 | Minor | A changed script also changes the hand-off itself; a loop would rerun the release. | The child is never handed off again (the variable is set), and it compares equal to itself. |
| 5 | Check | `exec 9>` is inherited by a child bash (no close-on-exec below fd 10). | No change. |
| 6 | Minor | The release that installs the fixed script is still run by the old one. | CHANGELOG says so and keeps the issue's workaround. |

No Critical findings.
