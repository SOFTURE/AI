---
change_id: charts-palette-guard
title: "Series palette guard"
status: archived
roadmap_item: CH-4
branch: claude/ch-4-palette-um4tkb
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

The series colours of `@softure-ai/charts` become a real palette instead of CH-2's provisional three: an ordered
list of `--sft-chart-series-N` tokens in `@softure-ai/ui` whose colours stay apart for readers with protan, deutan
or tritan vision and keep 3:1 against every ground a chart sits on, in the light and the dark scheme. A test in
`@softure-ai/charts` holds that, and `@softure-ai/charts/testing` exports the same check, so an app that overrides
the series colours runs it on its own theme.

A reviewer checks `foundation/charts/tests/palette.test.ts` (the default palette passes; CH-2's amber third colour,
a pale colour and a missing token are each caught), the token values and their documented order in
`foundation/ui/src/theme/tokens.ts`, and the `./testing` export of charts.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item CH-4, taken 2026-10-06).

## Context

From [`roadmap.md`](../../foundation/archive/2026-10-07-roadmap.md) (charts), item **CH-4**:

> - **Outcome:** a series palette in chart tokens with a documented order; a test that every pair stays
>   distinguishable under the three simulations and every colour passes contrast on the chart surface in both
>   themes; an exported helper so an app checks its own palette the same way.
> - **Unknowns:** How many series colours the palette can hold before the distance check fails.
> - **Baseline:** FIRE `src/lib/{band-colors,position-colors}.ts` tests (only the generic checks).

CH-2 left three provisional series tokens (`chart-series-1..3`) and `SERIES_SLOTS = 3`; CH-3 shipped the helpers
(`checkThemeContrast`, `findColorCollisions`) in `@softure-ai/ui/testing`. `@softure-ai/ui` 0.1.6 is not
published yet (npm has 0.1.5), so the new tokens ride 0.1.6 without another bump.

## Constraints

- Exclusively owns `foundation/charts/src/palette/` and the chart series tokens; also touches
  `foundation/charts/{styles.css,package.json,README.md,src/svg/class-names.ts,src/index.ts}`, a new
  `foundation/charts/src/testing/`, `foundation/ui/{src/theme/tokens.ts,README.md}` and the root lockfile.
- English-only code, comments and commits (AGENTS.md). FIRE_TRACKER is read only (its colours are FIRE's).
- No release, tag or publish by the agent; the owner tags releases.

## Process notes

- Research: short ([`research.md`](research.md)). The helpers exist; the open question is the palette itself (how
  many colours, which ones), answered by measurement.
- Framing: skipped. The roadmap names the outcome and the check; the problem is measured, not assumed (CH-2's
  provisional palette already collides: green and amber at 4.4 ΔE00 in protan, research §1), and the only open
  choices are values the research measures.
