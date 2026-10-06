# Backlog: roadmap-deploy-followups (gaps found while delivering the deploy roadmap)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-06).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly one place:
here, in `context/changes/` or in `context/archive/`. Taking an entry works as in
[`roadmap-later/`](../roadmap-later/README.md) ("Taking an entry").

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DF-1 | [`deploy-fire-parity`](../../changes/deploy-fire-parity/change.md) (taken 2026-10-06) | Parity of the deploy CLI with FIRE_TRACKER | taken | owner |
| DF-2 | [`deploy-workflow-verify-config`](../../archive/2026-10-06-deploy-workflow-verify-config/change.md) (done 2026-10-06) | The deploy workflow verifies with `softure-deploy verify` | roadmap promoted (DP-4 is on master) | start |
| DF-3 | [`deploy-workflow-e2e`](deploy-workflow-e2e/change.md) | The deploy workflow runs end to end in CI | DF-7 on master (the CLI runs from the checkout while DP-8 waits) | dependency |
| DF-4 | [`auth-testing-account-factory`](../../archive/2026-10-06-auth-testing-account-factory/change.md) (done 2026-10-06) | An account factory in @softure-ai/auth/testing | taken | start |
| DF-5 | [`deploy-row-count-config`](deploy-row-count-config/change.md) | Row-count tables from deploy.json | roadmap promoted (DP-4 is on master) | start |
| DF-6 | [`deploy-verify-cert-expiry`](../../archive/2026-10-06-deploy-verify-cert-expiry/change.md) (done 2026-10-06) | Certificate expiry in verify | roadmap promoted | start |
| DF-7 | [`deploy-server-files`](deploy-server-files/change.md) | Server files shipped with each release | DF-2 on master (DP-5 is) | dependency |
| DF-9 | [`deploy-server-safety`](deploy-server-safety/change.md) | The server deploy script matches FIRE's safety steps | DF-7 on master | dependency |
| DF-10 | [`deploy-release-report`](deploy-release-report/change.md) | The release body carries pipeline status and deployment history | DF-9 on master | dependency |
| DF-11 | [`deploy-workflow-release-guards`](deploy-workflow-release-guards/change.md) | The deploy workflow refuses a stray tag and carries build values | DF-7 on master | dependency |
| DF-12 | [`deploy-cut-release`](deploy-cut-release/change.md) | A reusable workflow cuts a release from a dispatch | DF-11 on master | dependency |
| DF-13 | [`deploy-verify-origin-firewall`](deploy-verify-origin-firewall/change.md) | verify checks that the origin refuses direct traffic | roadmap promoted | start |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).
