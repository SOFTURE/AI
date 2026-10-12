---
change_id: charts-adoption-gaps-409
title: "charts: step series, distinct band colours, surface variants, event axis and stacked areas (issue #409)"
status: implementing
roadmap_item: null
issue: 409
branch: claude/project-thread-0vhmfz
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #409](https://github.com/SOFTURE/AI/issues/409) (labels `enhancement`, `pkg: charts`, `adoption`): five
generic pieces an adopting app still draws itself on top of charts 0.1.7.

1. `withStepAt(points, index)`: a vertical jump in a series at one point.
2. `distinctColors(keys, palette?)`: stable, distinct colours for an open set of bands or categories.
3. Surface variants: the same chart on the page theme, on a dark band and on a paper card, switched by one prop or
   wrapper instead of an app's surface-to-tone map.
4. `EventAxis`: a horizontal timeline of spans and milestones with pointer and keyboard readout.
5. Stacked areas: `stackSeries` stacks series into bands and `StackedAreas` draws them as `Area`s.

A reviewer checks `foundation/charts/tests/adoption-gaps-409.test.tsx`, the README and the CHANGELOG `Unreleased` entry.

## Context

charts is at 0.1.7 on master with an `## Unreleased` section (issue #378). Releases are batched by the coordinator, so
this change bumps no version.

## Constraints

- Additive only: no existing export changes its output.
- styles.css keeps reading only `@softure-ai/ui` tokens; components keep no raw colour and no inline copy.

## Process notes

- Framing: skipped. The issue names each gap and proposes its shape.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Surfaces map to the colour schemes @softure-ai/ui already scopes by attribute: `page` inherits, `dark` sets
  `data-theme="dark"`, `paper` sets `data-theme="light"` on the chart's root. The charts package keeps no colours of
  its own, and a per-surface class (`sft-chart-surface-<name>`) lets an app tune a surface's tokens. No React context:
  the primitives read custom properties, which already inherit from the wrapper.
- `EventAxis` is its own client component, not a `ChartCursor` mode: the cursor snaps to x positions and draws a
  guide and dots, while an event axis activates the item under the pointer. It shares the cursor's key handling
  (moved to a small module both use) and its readout styles.
- `distinctColors` hashes each key to a preferred colour and resolves collisions in sorted key order, so the result
  does not depend on input order and a key that holds its preferred colour keeps it when others join.
- Stacking stacks positive values up from zero and negative values down from zero, per index.
