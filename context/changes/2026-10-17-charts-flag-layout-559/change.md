---
change_id: charts-flag-layout-559
title: "charts: layoutFlags stacks timeline flags into rows so their labels do not collide (issue #559)"
status: in_progress
roadmap_item: null
issue: 559
branch: claude/project-thread-hx6b0t
created: 2026-10-17
updated: 2026-10-17
---

## Intent

Close [issue #559](https://github.com/SOFTURE/AI/issues/559): an adopting app draws flags (labelled chips) above a
time axis and keeps its own stacking code so close labels do not overlap. Charts should own that layout: a pure,
deterministic helper that gives each flag a row, never lets two flags in one row overlap (with a gap), and reports
the flags that do not fit in `maxRows` instead of overlapping them. `LineChart` uses it when asked to stack.

## Context

Labels: `enhancement`, `pkg: charts`, `adoption`. charts 0.3.0 is the latest on npm and on master. Releases are
batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- Server-safe: no DOM, no measuring. Widths come from the caller, in the same unit as `x`.
- Additive: `ChartFlag` and `LineChart` render exactly as today when the new props are not given.
- The adopting app is not changed by this work; the migration is described in the CHANGELOG and on the issue.

## Notes

- Framing: skipped. The issue names the problem, the helper's shape and the acceptance criteria.
