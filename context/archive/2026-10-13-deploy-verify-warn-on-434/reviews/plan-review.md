---
change_id: deploy-verify-warn-on-434
reviewed: 2026-10-13
verdict: approved
---

# Plan review: deploy-verify-warn-on-434

Checked plan.md against change.md, research.md, issue #434 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `RouteReport.severity` is per row; a `forEach` route with `warnOn` must set the warn severity on the entry's row only, not on the route. | Taken into Phase 1: the warn row is built per target. |
| 2 | Warning | The CLI exit code reads `isFailure`; a test through `verify-cli` would prove a warned key directory does not fail the run. | Taken into Phase 1: one CLI test. |
| 3 | Check | `getDeployJsonSchema` uses `io: "input"`, so `warnOn` appears as optional in the JSON schema once regenerated. | No change. |
| 4 | Check | No change to `report.ts`: WARN rendering and the `N warned` summary already follow row severity. | No change. |

No Critical findings.
