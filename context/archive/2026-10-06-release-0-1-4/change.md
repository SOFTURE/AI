---
change_id: release-0-1-4
title: "DP-8 code part: deploy and testing leave private, and every package moves to 0.1.4"
status: archived
roadmap_item: DP-8
branch: claude/project-thread-wa8tm8
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`@softure-ai/deploy` and `@softure-ai/testing` drop `"private": true`, so `auto-release` of `all` releases them
at 0.1.0 (their first npm publish, staged with `NPM_TOKEN`). The 16 packages already on npm go to 0.1.4: 0.1.3
failed every stage with E401 and its tags stay without a release.

## Context

The owner asked for DP-8 to be prepared together with the next release and will add `NPM_TOKEN` for the two new
packages (2026-10-06). The 0.1.3 stage failed with E401 for all 16 packages; the owner is correcting the case of the
trusted publisher fields and asked not to debug further. Both packages pack cleanly in a dry run
(`release:pack --package deploy|testing --dry-run`).

## Constraints

- Owns: `private` in `tools/deploy/package.json` and `foundation/testing/package.json`, the version fields of the
  16 released packages, both lockfiles, README status lines, the runbook, DP-8 and the owner check in
  `roadmap-later.md`.
- The owner's steps stay with the owner: approving the staged versions, the trusted publishers of the two new
  packages, and the `deploy-workflows-v1` tag (sessions cannot push tags).

## Notes

- Placement: the code part of DP-8 (`roadmap-later.md`); DP-8 itself (`deploy-release`, in the backlog) stays `blocked` on the owner's steps.
- Research and framing skipped: the item's outcome is spelled out in the roadmap and the packages already pack.
