# Backlog: roadmap-deploy-followups (gaps found while delivering the deploy roadmap)

Roadmap of this group: [`roadmap-deploy-followups.md`](../../foundation/roadmaps/roadmap-deploy-followups.md)
(queued). That file holds the order, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`. Taking an entry works as in
[`roadmap-deploy/`](../roadmap-deploy/README.md).

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DF-1 | [`deploy-fire-parity`](deploy-fire-parity/change.md) | Parity of the deploy CLI with FIRE_TRACKER | a session that can read FIRE_TRACKER | start |
| DF-2 | [`deploy-workflow-verify-config`](deploy-workflow-verify-config/change.md) | The deploy workflow verifies with `softure-deploy verify` | DP-4 on master | dependency |
| DF-3 | [`deploy-workflow-e2e`](deploy-workflow-e2e/change.md) | The deploy workflow runs end to end in CI | DP-5 and DP-8 | dependency |
| DF-4 | [`auth-testing-account-factory`](auth-testing-account-factory/change.md) | An account factory in @softure-ai/auth/testing | — | start |
| DF-5 | [`deploy-row-count-config`](deploy-row-count-config/change.md) | Row-count tables from deploy.json | DP-4 on master | dependency |
| DF-6 | [`deploy-verify-cert-expiry`](deploy-verify-cert-expiry/change.md) | Certificate expiry in verify | the roadmap promoted | start |
