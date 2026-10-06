# Backlog: roadmap-deploy-followups (gaps found while delivering the deploy roadmap)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-06).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`. Taking an entry works as in
[`roadmap-later/`](../roadmap-later/README.md) ("Taking an entry").

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DF-1 | [`deploy-fire-parity`](deploy-fire-parity/change.md) | Parity of the deploy CLI with FIRE_TRACKER | a session that can read FIRE_TRACKER (the owner grants access) | owner |
| DF-2 | [`deploy-workflow-verify-config`](deploy-workflow-verify-config/change.md) | The deploy workflow verifies with `softure-deploy verify` | roadmap promoted (DP-4 is on master) | start |
| DF-3 | [`deploy-workflow-e2e`](deploy-workflow-e2e/change.md) | The deploy workflow runs end to end in CI | DF-7 on master (the CLI runs from the checkout while DP-8 waits) | dependency |
| DF-4 | [`auth-testing-account-factory`](auth-testing-account-factory/change.md) | An account factory in @softure-ai/auth/testing | roadmap promoted | start |
| DF-5 | [`deploy-row-count-config`](../../archive/2026-10-06-deploy-row-count-config/change.md) (done 2026-10-06) | Row-count tables from deploy.json | roadmap promoted (DP-4 is on master) | start |
| DF-6 | [`deploy-verify-cert-expiry`](deploy-verify-cert-expiry/change.md) | Certificate expiry in verify | roadmap promoted | start |
| DF-7 | [`deploy-server-files`](deploy-server-files/change.md) | Server files shipped with each release | DF-2 on master (DP-5 is) | dependency |
| DF-8 | [`deploy-row-count-server-list`](deploy-row-count-server-list/change.md) | The server counts the tables of deploy.json | DF-7 on master (DF-5 is) | dependency |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).
