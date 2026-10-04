---
change_id: charts-scale-ticks
title: "Chart scales, ticks and nearest point"
status: backlog
roadmap_item: CH-1
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`@softure-ai/charts`: linear and time scales, nice ticks (dates in the app's time zone), nearest-point search.

## Context

From [`roadmap-charts.md`](../../../foundation/roadmaps/roadmap-charts.md), item **CH-1** (queued roadmap `charts`):

> ### CH-1: Chart scales, ticks and nearest point
> - **Change ID:** `charts-scale-ticks`
> - **Status:** ready
> - **Outcome:** A new package `@softure-ai/charts` (`foundation/charts/`, copied from `templates/package/`) with pure functions:
>   - linear and time scales;
>   - nice value ticks and date ticks (days, months, years) in the app's time zone;
>   - nearest-point search for a cursor;
>   - a generic point type `{ x: Date | number; y: number }` instead of FIRE's `TimelinePoint`.
> - **Prerequisites:** none (roadmap trigger).
> - **Unknowns:** Whether date ticks need locale-aware labels from `Intl` or from the app's formatter in `@softure-ai/core`.
> - **Risk:** low.
> - **Baseline:** FIRE `src/lib/{chart-scale,chart-ticks,nearest-point}.ts` and their tests. After: the same tests green in the package with the generic point type.
> - **PRD refs:** FR-31.
> - **Source (FIRE_TRACKER, read only):** `src/lib/chart-scale.ts`, `src/lib/chart-ticks.ts`, `src/lib/nearest-point.ts`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/charts/` scaffold, `src/scale/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
