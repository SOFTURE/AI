---
change_id: charts-palette-guard
title: "Series palette guard"
status: backlog
roadmap_item: CH-4
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

Series palette from tokens, distinguishable under colour-vision deficiency and legible on the surface in both themes.

## Context

From [`roadmap-charts.md`](../../../foundation/roadmaps/roadmap-charts.md), item **CH-4** (queued roadmap `charts`):

> ### CH-4: Series palette guard
> - **Change ID:** `charts-palette-guard`
> - **Status:** ready
> - **Outcome:**
>   - a series palette in chart tokens with a documented order;
>   - a test that every pair stays distinguishable under the three simulations and every colour passes contrast on the chart surface in both themes;
>   - an exported helper so an app checks its own palette the same way.
> - **Prerequisites:** CH-2, CH-3.
> - **Unknowns:** How many series colours the palette can hold before the distance check fails.
> - **Risk:** low.
> - **Baseline:** FIRE `src/lib/{band-colors,position-colors}.ts` tests (only the generic checks). After: the palette test green in charts.
> - **PRD refs:** FR-32.
> - **Source (FIRE_TRACKER, read only):** `src/lib/band-colors.ts`, `src/lib/position-colors.ts` (checks only; the colours are FIRE's)

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `foundation/charts/src/palette/`, chart palette tokens.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
