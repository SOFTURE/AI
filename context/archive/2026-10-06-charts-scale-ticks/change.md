---
change_id: charts-scale-ticks
title: "Chart scales, ticks and nearest point"
status: archived
roadmap_item: CH-1
branch: claude/ch-1-scales-kjlyo6
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

A new package `@softure-ai/charts` (`foundation/charts/`) gives an app the arithmetic of a chart as pure functions,
with no DOM and no React: linear and time scales (with `invert` for a cursor), the peak of several series, nice value
ticks, year ticks and calendar date ticks (days, months, years) at midnight in the app's time zone with labels from
`Intl`, and the index of the point nearest to a cursor. Points use a generic `{ x: Date | number; y: number }`
instead of FIRE_TRACKER's `TimelinePoint`.

A reviewer checks `foundation/charts/src/scale/*.test.ts`: FIRE's tests of `chart-scale`, `chart-ticks` and
`nearest-point` ported to the generic API and green, plus the date tick cases across a DST change in
`Europe/Warsaw`.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CH-1, taken 2026-10-06).

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-07-roadmap.md) (charts), item **CH-1**:

> - **Outcome:** A new package `@softure-ai/charts` (`foundation/charts/`, copied from `templates/package/`) with
>   pure functions: linear and time scales; nice value ticks and date ticks (days, months, years) in the app's time
>   zone; nearest-point search for a cursor; a generic point type `{ x: Date | number; y: number }`.
> - **Unknowns:** Whether date ticks need locale-aware labels from `Intl` or from the app's formatter in
>   `@softure-ai/core`.
> - **Baseline:** FIRE `src/lib/{chart-scale,chart-ticks,nearest-point}.ts` and their tests. After: the same tests
>   green in the package with the generic point type.

CH-2 (SVG primitives) builds on this package; CH-3 (`ui-color-guards`) runs in parallel and touches only
`foundation/ui/`.

## Constraints

- Owns: `foundation/charts/` (scaffold and `src/scale/`), the CH-1 rows of the charts roadmap and its backlog README.
- The package stays `"private": true` at 0.1.0 until its first publish in CH-5 (precedent: `@softure-ai/testing`
  in DP-6).
- English-only code, comments and commits (AGENTS.md). No user-facing copy: labels come from `Intl` in the caller's
  locale.
- FIRE_TRACKER is read only: copy its code, never change it.
- No release, tag or publish.

## Process notes

- Research: short ([`research.md`](research.md)); the source is three FIRE files of ~300 lines and their tests.
- Framing: skipped. The roadmap item is an extraction with a fixed baseline (FIRE's code and tests), not a problem
  in doubt; the only open question (labels from `Intl` or from core) is a fact about core, settled in research.
