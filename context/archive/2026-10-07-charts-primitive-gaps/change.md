---
change_id: charts-primitive-gaps
title: "charts: gaps in the SVG primitives (issue #221)"
status: archived
roadmap_item: null
issue: 221
branch: claude/project-thread-are0sa
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close the three gaps issue [#221](https://github.com/SOFTURE/AI/issues/221) lists for `@softure-ai/charts` 0.1.3,
found while an adopting app moved its own chart primitives onto the package, so that the app can drop its local
workarounds and keep pixel-identical charts:

- **G1 (bug):** a `ChartFlag` without `xPercent` (`sft-chart-flag-free`) inherits `top: 0`, so a parent that places
  it with `position: absolute` plus `bottom` stretches it over the whole plot.
- **G2:** `ValueAxis` always hides every other label on narrow screens from four labels; there is no way to keep them.
- **G3:** `ChartPin`'s line and dot take no classes of their own, and the dash variables are declared on the line,
  so they cannot be set from the column; the line colour can only be changed by overriding `--sft-chart-cursor`.
- **Noted:** `opacity` on the lines is `stroke-opacity`; document it.

A reviewer checks `foundation/charts/tests/primitives.test.tsx`, `styles.css`, the README and the CHANGELOG entry
for 0.1.4.

## Context

Sources: `foundation/charts/src/svg/{flag,value-axis,pin,lines}.tsx`, `foundation/charts/styles.css`. No roadmap:
issues are the tracker.

## Constraints

- Backward compatible: every new prop is optional; without it the markup is unchanged.
- English-only code; neutral wording on GitHub and in the repo.
- Only `@softure-ai/charts` changes (0.1.3 → 0.1.4); `@softure-ai/ui` is untouched, so the parallel ui work is not
  affected. The thread releases charts 0.1.4 after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names every class and prop involved and the four source files
  were read in full; the findings fit in `plan.md` § Findings.
- Framing: skipped. Each point is a concrete missing option or a CSS bug with a measured effect and a suggested fix;
  there is no competing explanation to test.
