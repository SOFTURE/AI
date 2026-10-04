---
change_id: charts-release
title: "Charts release"
status: backlog
roadmap_item: CH-5
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/charts` 0.1.0 and the next `@softure-ai/ui` published through the release pipeline; README complete.

## Context

From [`roadmap-charts.md`](../../../foundation/roadmaps/roadmap-charts.md), item **CH-5** (queued roadmap `charts`):

> ### CH-5: Charts release
> - **Change ID:** `charts-release`
> - **Status:** blocked (waits for CH-1…CH-4 and the owner's first npm publish at the keyboard)
> - **Outcome:** `@softure-ai/charts` 0.1.0 (the owner approves the first, staged publish and adds its trusted publisher) and the next `@softure-ai/ui` with the testing helpers; README with an adoption guide for FIRE_TRACKER's charts.
> - **Prerequisites:** CH-1…CH-4.
> - **Unknowns:** none beyond the owner's npm steps.
> - **Risk:** low.
> - **Baseline:** package absent from npm. After: installable from npm and from GitHub Releases.
> - **PRD refs:** FR-2, FR-26, G-4.

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: package READMEs, `docs/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
