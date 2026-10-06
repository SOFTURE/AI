# Backlog: roadmap-deploy-followups (gaps found while delivering the deploy roadmap)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-06).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`. Taking an entry works as in
[`roadmap-later/`](../roadmap-later/README.md) ("Taking an entry").

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DF-1 | [`deploy-fire-parity`](../../archive/2026-10-06-deploy-fire-parity/change.md) (done 2026-10-06) | Parity of the deploy CLI with FIRE_TRACKER | read access to FIRE_TRACKER (granted 2026-10-06) | owner |
| DF-2 | [`deploy-workflow-verify-config`](../../archive/2026-10-06-deploy-workflow-verify-config/change.md) (done 2026-10-06) | The deploy workflow verifies with `softure-deploy verify` | roadmap promoted (DP-4 is on master) | start |
| DF-3 | [`deploy-workflow-e2e`](../../archive/2026-10-06-deploy-workflow-e2e/change.md) (done 2026-10-06) | The deploy workflow runs end to end in CI | DF-7 on master (the CLI runs from the checkout while DP-8 waits) | dependency |
| DF-4 | [`auth-testing-account-factory`](../../archive/2026-10-06-auth-testing-account-factory/change.md) (done 2026-10-06) | An account factory in @softure-ai/auth/testing | taken | start |
| DF-5 | [`deploy-row-count-config`](../../archive/2026-10-06-deploy-row-count-config/change.md) (done 2026-10-06) | Row-count tables from deploy.json | roadmap promoted (DP-4 is on master) | start |
| DF-6 | [`deploy-verify-cert-expiry`](../../archive/2026-10-06-deploy-verify-cert-expiry/change.md) (done 2026-10-06) | Certificate expiry in verify | roadmap promoted | start |
| DF-7 | [`deploy-server-files`](../../archive/2026-10-06-deploy-server-files/change.md) (done 2026-10-06) | Server files shipped with each release | DF-2 on master (DP-5 is) | dependency |
| DF-8 | [`deploy-row-count-server-list`](../../archive/2026-10-06-deploy-row-count-server-list/change.md) (done 2026-10-06) | The server counts the tables of deploy.json | DF-7 on master (DF-5 is) | dependency |
| DF-9 | [`deploy-server-safety`](../../archive/2026-10-06-deploy-server-safety/change.md) (done 2026-10-06) | The server deploy script matches FIRE's safety steps | DF-7 on master | dependency |
| DF-10 | [`deploy-release-report`](deploy-release-report/change.md) | The release body carries pipeline status and deployment history | DF-9 on master | dependency |
| DF-11 | [`deploy-workflow-release-guards`](../../archive/2026-10-06-deploy-workflow-release-guards/change.md) (done 2026-10-06) | The deploy workflow refuses a stray tag and carries build values | DF-7 on master | dependency |
| DF-12 | [`deploy-cut-release`](../../archive/2026-10-06-deploy-cut-release/change.md) (done 2026-10-06) | A reusable workflow cuts a release from a dispatch | DF-11 on master | dependency |
| DF-13 | [`deploy-verify-origin-firewall`](deploy-verify-origin-firewall/change.md) | verify checks that the origin refuses direct traffic | roadmap promoted | start |
| DF-14 | [`deploy-row-count-new-table`](../../archive/2026-10-06-deploy-row-count-new-table/change.md) (done 2026-10-06) | A new table can join the row-count list with its release | DF-8 on master | dependency |
| DF-15 | [`deploy-workflow-e2e-server`](../../archive/2026-10-06-deploy-workflow-e2e-server/change.md) (done 2026-10-06) | The end-to-end test runs the server side and verify | DF-3 on master | dependency |
| DF-16 | [`deploy-init-release-caller`](deploy-init-release-caller/change.md) | init writes the release caller | DF-12 on master | dependency |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).
