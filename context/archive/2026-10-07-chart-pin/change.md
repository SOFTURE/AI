---
change_id: chart-pin
title: "Event pin"
status: archived
roadmap_item: CF-1
branch: claude/project-thread-qcl0sh
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

`ChartPin` in `@softure-ai/charts`: an event pin on a curve, a dashed vertical from the baseline up to a point and a
round dot on the point, placed in plot percentages in `ChartPlot`'s overlay and painted on the `--sft-chart-*`
tokens. FIRE_TRACKER can then drop its own `ChartPin` when it adopts the package.

A reviewer checks `foundation/charts/tests/primitives.test.tsx` (the pin's markup: position, line height, dot only,
series fill), the pin rules in `foundation/charts/styles.css`, the README row and the 0.1.1 bump.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CF-1, taken 2026-10-07).

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-07-2-roadmap.md) (charts-followups), item **CF-1**:

> - **Outcome:** `ChartPin` (or a `GuideLine` option) in `@softure-ai/charts`: a dashed vertical from the baseline to
>   a point and a dot on the point, positioned in plot percentages, on the `--sft-chart-*` tokens; tests and README.
> - **Unknowns:** whether the dot belongs in the SVG (stretched viewBox) or the HTML overlay (round at any aspect).
> - **Baseline:** FIRE `ChartPin` and its cases in `chart-primitives.test.tsx`.

## Constraints

- Owns `foundation/charts/src/svg/pin.tsx` (new); touches `foundation/charts/src/index.ts`, `styles.css`,
  `tests/primitives.test.tsx`, `README.md`, `package.json` (version) and the root lockfile (version).
- English-only code, comments and commits (AGENTS.md). FIRE_TRACKER is read only.
- Bumps `@softure-ai/charts` 0.1.0 → 0.1.1 (roadmap release order); no release, tag or publish by the agent.

## Process notes

- Research: skipped. The source is one FIRE component of 40 lines (`src/components/chart/chart-flag.tsx`, read in
  full) with one test case, and the roadmap's only unknown is answered by the package itself: `ChartCursor` already
  draws its dots in the HTML overlay (`sft-chart-cursor-dot`, `--sft-chart-dot-size`), round at any aspect, because
  the viewBox stretches (`preserveAspectRatio="none"`) and an SVG circle would become an ellipse. Decisions are in
  [`plan.md`](plan.md).
- Framing: skipped. The problem is a missing primitive named by CH-5's adoption mapping (FIRE keeps its own pin
  until the package has one); there is no competing explanation and the roadmap fixes the scope.
