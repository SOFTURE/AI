---
change_id: deploy-release
title: "Deploy and testing release"
status: archived
roadmap_item: DP-8
branch: null
created: 2026-10-04
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published; the deploy workflows tagged for callers.

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **DP-8** (carried over on 2026-10-06
from roadmap `deploy`, archived in [`2026-10-06-roadmap.md`](../../foundation/archive/2026-10-06-roadmap.md),
to the queued roadmap `later`):

> ### DP-8: Deploy and testing release
> - **Change ID:** `deploy-release`
> - **Status:** blocked (carried over from deploy: the owner's first npm publish and the workflow tag at the keyboard)
> - **Outcome:** `@softure-ai/deploy` and `@softure-ai/testing` 0.1.0 published through the FD-2 pipeline (the owner approves each first, staged publish and adds its trusted publisher); the workflow tag for callers (DP-2) set by the owner; READMEs with an adoption guide for FIRE_TRACKER.
> - **Prerequisites:** DP-1…DP-7 (done).
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, FR-26, G-4.

Reference material: [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: package READMEs, `docs/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

## Outcome (2026-10-06)

`release-0-1-4` dropped `"private": true` and staged both packages at 0.1.0; `release-0-1-5` published 0.1.1 of both
directly, live on npm with their trusted publishers. The owner marked the item done; the `deploy-workflows-v1` tag
stays the owner's call. Archived without a plan: the code part lives in `release-0-1-4`.
