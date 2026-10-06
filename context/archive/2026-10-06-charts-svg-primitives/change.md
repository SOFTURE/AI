---
change_id: charts-svg-primitives
title: "SVG chart primitives"
status: archived
roadmap_item: CH-2
branch: claude/ch-2-svg-sguj5t
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

`@softure-ai/charts` gets React components on top of CH-1's arithmetic, so an app draws an accessible line chart
from data without writing SVG:

- server-renderable primitives: a plot surface (SVG stretched to the card, hairline strokes), grid, baseline,
  series lines, guide lines, a value axis and a time axis (HTML labels, so letters do not stretch), a legend and
  flags (annotations);
- a client cursor that snaps to the nearest point under a pointer (mouse, pen or a finger dragging sideways) and
  steps through points with the arrow keys, with a visible readout in a live region;
- a visually hidden data table behind every chart;
- `LineChart`, the composition of all of them for time series;
- colours and sizes from new `--sft-chart-*` tokens in `@softure-ai/ui`, accessible names from the package's
  `en`/`pl` messages;
- a chart page in the example app with an e2e.

A reviewer checks `foundation/charts/tests/*.test.tsx` (FIRE's `chart-primitives.test.tsx` cases ported to the
generic API, the cursor's keyboard and pointer behaviour, and an architecture test with no raw colours and no
inline copy) and `examples/next-app/e2e/chart.spec.ts`.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CH-2, taken 2026-10-06).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (charts), item **CH-2**:

> - **Outcome:** React components in `@softure-ai/charts`: server-renderable SVG (chart surface, time axis, value
>   axis, lines, legend, flags); a client cursor that snaps to the nearest point, with keyboard support and a live
>   region; a visually hidden data table for screen readers; colours and sizes from `--sft-chart-*` tokens added to
>   `@softure-ai/ui`; `aria-label` text through messages; a chart page in the example app with an e2e.
> - **Unknowns:** Whether the cursor needs pointer events only or also touch drag on mobile.
> - **Baseline:** FIRE `src/components/chart/*` and `chart-primitives.test.tsx`. After: the same tests green in the
>   package; no raw colours (architecture test).

CH-1 (on master, PR #144) gave the scales, ticks and `nearestPointIndex`. CH-3 (`ui-color-guards`) runs in parallel
in `foundation/ui/src/testing/`; CH-4 (series palette and its guard) comes after both and owns the palette's values.

## Constraints

- Owns: `foundation/charts/` (except `src/scale/`, which is only read), the `chart-*` tokens in
  `foundation/ui/src/theme/tokens.ts`, the example app's chart page and e2e, the CH-2 rows of the charts roadmap.
- English-only code, comments and commits. User-facing copy only in the `en`/`pl` dictionaries.
- FIRE_TRACKER is read only: copy its code, never change it. FIRE's domain parts (PLN labels, age rows, unlock
  steps, the landing's surfaces) stay in FIRE.
- The package stays `"private": true` at 0.1.0 (first publish in CH-5); `@softure-ai/ui` gets a minor bump.
- No release, tag or publish.

## Process notes

- Research: short ([`research.md`](research.md)); the source is seven FIRE files of ~1000 lines and the CH-1 API.
- Framing: skipped. The item is an extraction with a fixed baseline (FIRE's components and tests); the one unknown
  (touch drag) is a fact about Pointer Events, settled in research §4, not a problem in doubt.
