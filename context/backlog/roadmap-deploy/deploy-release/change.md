---
change_id: deploy-release
title: "Deploy and testing release"
status: backlog
roadmap_item: DP-8
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published; the deploy workflows tagged for callers.

## Context

From [`roadmap-deploy.md`](../../../foundation/roadmaps/roadmap-deploy.md), item **DP-8** (queued roadmap `deploy`):

> ### DP-8: Deploy and testing release
> - **Change ID:** `deploy-release`
> - **Status:** blocked (waits for DP-1…DP-7 and the owner's first npm publish at the keyboard)
> - **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2) set by the owner; READMEs with an adoption guide for FIRE_TRACKER.
> - **Prerequisites:** DP-1…DP-7.
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, FR-26, G-4.

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: package READMEs, `docs/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
