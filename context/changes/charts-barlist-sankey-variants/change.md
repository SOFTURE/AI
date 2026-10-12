---
change_id: charts-barlist-sankey-variants
title: "charts: BarList stacked, missing and described rows; Sankey label variants (issue #378)"
status: implemented
roadmap_item: null
issue: 378
branch: claude/project-thread-wno2hf
created: 2026-10-12
updated: 2026-10-12
archived_at: null
---

## Intent

An adopting app draws its bar lists and its Sankey with `@softure-ai/charts` without changing how they look:

- `BarList` has a stacked layout (label and value on one row, the track full width under them), a "missing" row (an
  empty track with a dashed outline in the row's colour) and a line of description per row, in React and in
  `renderBarListHtml` alike.
- `Sankey` can be drawn without label columns (the app lists the labels outside), takes separate opacities for
  ribbons and for tinted nodes, draws leader lines from a node to a label that was spread away from it, and can draw
  its labels as SVG text in a plot with a fixed aspect ratio.

Without the new options, every component renders the markup of 0.1.7. A reviewer checks
`foundation/charts/tests/adoption-gaps-378.test.tsx`, `styles.css`, the README and the CHANGELOG `Unreleased` section.

## Context

Issue [#378](https://github.com/SOFTURE/AI/issues/378) (labels `enhancement`, `pkg: charts`, `adoption`), a follow-up
to #321 (`context/archive/2026-10-09-charts-tone-area-sankey/`):

> An adopting app can't use BarList or Sankey from 0.1.7 without changing how its charts look.
>
> BarList:
> 1. A stacked layout, with label and value on one row and the track full-width under them.
> 2. A "missing" row: an empty track with a dashed outline in a tone.
> 3. Extra content per row, like a line of description under the bar.
>
> Sankey:
> 1. A variant without label columns (compact phone drawing, with labels listed outside).
> 2. Separate opacities for ribbons and for tinted nodes (one `--sft-chart-tint-opacity` covers both today).
> 3. Leader lines from a node to a label that was spread away from it.
> 4. SVG labels, or a fixed aspect ratio, as an alternative to HTML labels beside a stretched plot.

## Constraints

- Only `foundation/charts` and this folder.
- Backwards compatible: every new prop optional, default markup unchanged (the #321 tests stay as they are).
- Colours and sizes stay tokens (`tests/architecture.test.ts`); new custom properties are local, with fallbacks.
- No version bump: the CHANGELOG gets an `Unreleased` section; the coordinator releases the batch.
- English only.

## Notes

- Placement: unlinked (`roadmap_item: null`, `issue: 378`); one GitHub issue is one change.
- Framing: skipped; the issue states the gaps and the expected outcome.
