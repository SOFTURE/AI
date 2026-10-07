---
change_id: chart-pin
title: "Event pin"
status: backlog
roadmap_item: CF-1
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

`ChartPin` in `@softure-ai/charts`: an event pin (a dashed vertical from the baseline to a point and a dot on the
point), so FIRE_TRACKER does not keep its own when it adopts the package.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (charts-followups), item **CF-1** (main roadmap since 2026-10-07):

> - **Source:** CH-5 (`charts-release`), mapping FIRE_TRACKER for the adoption guide: CH-2's research marked FIRE's
>   `ChartPin` (`src/components/chart/chart-flag.tsx`) as generic, but CH-2 shipped only `ChartFlag`, so FIRE keeps
>   its own pin when it moves to the package.
> - **Outcome:** `ChartPin` (or a `GuideLine` option) in `@softure-ai/charts`, positioned in plot percentages, on the
>   `--sft-chart-*` tokens; tests and README.
> - **Unknowns:** whether the dot belongs in the SVG (stretched viewBox) or the HTML overlay (round at any aspect).
> - **Risk:** low.

FIRE_TRACKER is read only: copy its code, never change it.

## Constraints

- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- A change to the published package bumps `@softure-ai/charts`.

## Notes
