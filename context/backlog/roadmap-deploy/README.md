# Backlog: roadmap-deploy (one-VPS deploy as a package, reusable workflows and test tools)

Roadmap of this group: [`foundation/roadmap.md`](../../foundation/roadmap.md) (the main roadmap since 2026-10-05).
That file holds the order, lanes, owner decisions and the status of each item.

This folder holds the **entries** (`<change-id>/change.md`, `status: backlog`). An entry is in exactly
one place: here, in `context/changes/` or in `context/archive/`.

## Taking an entry

When an item becomes active work, move its entry and let `softure-new` write the real `change.md`:

```bash
git mv context/backlog/roadmap-deploy/<id>/change.md context/changes/<id>/backlog-input.md
```

Then remove the empty folder here. Relative links in the moved file lose one `../`. The roadmap row goes
to `in_progress` (WORKFLOW §5.1).

## When it can start

The owner promoted the roadmap on 2026-10-05. The order comes from dependencies; DP-1…DP-7 run on 2026-10-05 and
DP-8 waits for the owner at the keyboard on 2026-10-06:

| ID | Entry | Title | Condition | Kind |
| --- | --- | --- | --- | --- |
| DP-1 | [`deploy-cli-env-notes`](../../archive/2026-10-05-deploy-cli-env-notes/change.md) (done 2026-10-05) | Deploy CLI: env rendering and release notes | roadmap promoted | start |
| DP-2 | [`deploy-reusable-workflows`](deploy-reusable-workflows/change.md) | Reusable deploy workflows | DP-1 on master | dependency |
| DP-3 | [`deploy-db-guard`](../../changes/deploy-db-guard/change.md) (taken 2026-10-05) | Backup and schema guard before a deploy | DP-1 on master | dependency |
| DP-4 | [`deploy-verify-production`](deploy-verify-production/change.md) | Production verify from config | DP-1 on master | dependency |
| DP-5 | [`deploy-init-template`](deploy-init-template/change.md) | Deploy files generated once | DP-2, DP-3 and DP-4 on master | dependency |
| DP-6 | [`testing-clock-shift`](testing-clock-shift/change.md) | Test clock shift | roadmap promoted | start |
| DP-7 | [`testing-playwright-helpers`](testing-playwright-helpers/change.md) | Playwright helpers | DP-6 on master | dependency |
| DP-8 | [`deploy-release`](deploy-release/change.md) | Deploy and testing release | DP-1…DP-7 on master **and** the owner at the keyboard (2026-10-06) | dependency + owner |

Kind: `start` (can be taken as soon as the roadmap is promoted), `dependency` (waits for the listed items on the
main branch), `owner` (needs an owner decision or the owner at the keyboard).

When the last entry is taken, delete this folder.
