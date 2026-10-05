# Backlog: roadmap-deploy-followups (gaps found while delivering the deploy roadmap)

Roadmap of this group: [`roadmap-deploy-followups.md`](../../foundation/roadmaps/roadmap-deploy-followups.md)
(queued). That file holds the order, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`. Taking an entry works as in
[`roadmap-deploy/`](../roadmap-deploy/README.md).

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DF-1 | [`deploy-fire-parity`](deploy-fire-parity/change.md) | Parity of the deploy CLI with FIRE_TRACKER | a session that can read FIRE_TRACKER | start |
| DF-2 | [`deploy-workflow-fire-parity`](deploy-workflow-fire-parity/change.md) | Parity of the deploy workflow with FIRE_TRACKER's release | a session that can read FIRE_TRACKER | start |
| DF-3 | [`deploy-workflow-verify-config`](deploy-workflow-verify-config/change.md) | The deploy workflow verifies with `softure-deploy verify` | DP-4 on master | dependency |
| DF-4 | [`deploy-workflow-e2e`](deploy-workflow-e2e/change.md) | The deploy workflow runs end to end in CI | DP-5 and DP-8 | dependency |
