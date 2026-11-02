---
change_id: ui-app-components-960
title: "ui + theme-flat-paint: the app components pwa names (issue #960)"
status: archived
archived_at: 2026-11-02
roadmap_item: null
issue: [960]
branch: claude/project-thread-sy62rx
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #960](https://github.com/SOFTURE/AI/issues/960): `@softure-ai/pwa` names its UI as theme components
(`InstallBar`, `UpdatePrompt`, `LaunchScreen`, `TopLoadingBar`, `RouteLoading`, plus `MiniProgress`), and only
`@softure-ai/theme-notion` has them. An app on `@softure-ai/theme-flat-paint` has to write them itself. Give every
theme built on `@softure-ai/ui` these components, with the Flat Paint look as look maps, and show the Flat Paint
import in the pwa README next to the Notion one.

## Context

Labels: `enhancement`, `pkg: theme-flat-paint`, `pkg: pwa`, `pkg: ui` (added). Packages: `foundation/ui` 0.3.5,
`themes/theme-flat-paint` 0.2.0, `modules/pwa` 0.1.4 (docs only), `themes/theme-notion` 0.10.3 (read only).
Checked first that no other session shipped it: nothing on master (c9380e5) mentions #960, no branch or pull request
for it. #959 (pwa share target) runs in parallel and touches `modules/pwa`; this change edits only its README.
No version bump: the coordinator releases the batch.

## Constraints

- theme-notion's components and API stay as they are (no breaking change to an app on it).
- The ui components keep theme-notion's props one to one, so pwa's README examples work by swapping the import.
- The pwa launch counter (`buildLaunchProgressScript`) drives the new launch screen and top bar unchanged: same
  `data-slot`s (`launch-screen`, `top-loading-bar`, `progress`, `progress-indicator`, `<root>-percent`).
- ui's `styles.css` stays within its 20 kB gzip budget; colours from `--sft-*` tokens only, copy from props only.
- The adopting app is not changed here.

## Notes

- Framing: skipped. The issue names the problem, the two options and the acceptance.
