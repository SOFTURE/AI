---
change_id: theme-notion-mini-progress-871
title: "theme-notion: MiniProgress, a compact bar with its value inside (issue #871)"
status: planned
roadmap_item: null
issue: 871
branch: claude/project-thread-wztaky
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Close [issue #871](https://github.com/SOFTURE/AI/issues/871): apps show a share next to its figure in table cells and
tiles (a figure in a fixed-width span, then `Progress`), and in a narrow column the two collide. The theme gets a
`MiniProgress` composition: a 20 px bar that carries its label inside, readable at any fill and truncated with an
ellipsis when the cell is narrower than the text.

## Context

Labels: `enhancement`, `pkg: theme-notion`. No release in this change: the coordinator releases in the next combined
release. No other change in flight.

## Constraints

- Nothing existing changes: `Progress` and every other part render the same pixels (no baseline moves).
- The label passes AA (4.5:1) on the track and on the fill, in both schemes, for the default fill and every tone.
- The NOTION · Design System artifact mirrors the change.

## Notes

- Framing: skipped. The issue names the problem, the API and the implementation.
