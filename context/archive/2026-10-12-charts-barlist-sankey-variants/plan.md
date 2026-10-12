# Plan: charts-barlist-sankey-variants

Input: change.md, research.md. Complexity: medium (one package, three phases).

## Goal

`BarList` gains a stacked layout, missing rows and a description line; `Sankey` gains an unlabelled variant, separate
ribbon and node opacities, leader lines and a fixed aspect ratio. Default markup stays that of 0.1.7.

**Out of scope:** SVG text labels (research, Decisions), node-to-node Sankey links, new design tokens, a version bump.

## Key decisions

- **D1 BarList layout.** `BarListOptions.layout?: "inline" | "stacked"` (default `inline`), shared by both renderers.
  `stacked` adds `sft-chart-bar-list-stacked` to the `ul`; CSS turns the list into two columns (label | value) with
  the track on a second row across both. DOM order stays label, track, value, so the inline markup is unchanged.
- **D2 Missing row.** `BarListItem.missing?: boolean`. The row's track gets `sft-chart-bar-track-missing` plus the
  row's colour class and inline colour, and no bar; its value does not count toward the default `max`. CSS: no fill,
  a dashed outline `var(--sft-chart-grid-width)` in `var(--sft-chart-series, var(--sft-chart-axis))`.
  `BarListRow` gains `missing: boolean` and `description: string | undefined`.
- **D3 Description.** `BarListItem.description?: string` (a string, so the HTML renderer can write it), rendered as
  `<span class="sft-chart-bar-description">` after the value; inline it sits under the bar and value
  (`grid-column: 2 / -1`), stacked under the track (`1 / -1`). It is read by screen readers as part of the row.
- **D4 Sankey labels.** `labels?: "beside" | "none"` (default `beside`). `none` renders only the plot, root class
  `sft-chart-sankey-unlabelled` (one column).
- **D5 Opacities.** `.sft-chart-sankey-link` reads `--sft-chart-sankey-link-opacity`, `.sft-chart-sankey-tint` reads
  `--sft-chart-sankey-node-opacity`, each falling back to `--sft-chart-tint-opacity, 0.24`. CSS only, like the label
  width; both added to `LOCAL_PROPERTIES`.
- **D6 Leaders.** `layoutSankey` nodes gain `centreY` (the node's middle) and `isLabelSpread` (`labelY` at least one
  viewBox unit from `centreY`). `leaders?: boolean` (default false, only with `labels="beside"`) adds root class
  `sft-chart-sankey-leaders` and a strip between each label column and the plot: a `div.sft-chart-sankey-leader-strip` holding a hidden SVG (absolutely filling it, plan review W1) in viewBox
  `0 0 1 <height>`, `preserveAspectRatio="none"`, one `<path class="sft-chart-sankey-leader">` per spread node from
  the label's height at the label edge to the node's centre at the plot edge, non-scaling stroke in
  `--sft-chart-axis`. Strip width `--sft-chart-sankey-leader-width` (default `var(--sft-space-4)`).
- **D7 Aspect.** `aspect?: "stretch" | "fixed"` (default `stretch`). `fixed` adds root class `sft-chart-sankey-fixed`
  and an inline `aspect-ratio: <width> / <height>` on the plot; CSS sets the plot, label columns and leader strips to
  `height: auto` so the columns stretch to the plot's row. `SankeyProps.layout` takes `width` and `height` too
  (widening the type), so an app picks the ratio.

## Phase 1: BarList stacked, missing, description (TDD)

**Files:** `src/svg/bar-list.tsx`, `src/svg/bar-list-html.ts`, `styles.css`, `tests/adoption-gaps-378.test.tsx`.
Tests first: rows (missing ignored by the default max, description passed), stacked class, missing track markup,
description markup, HTML renderer identical for every new option and escaping the description.

## Phase 2: Sankey variants (TDD)

**Files:** `src/svg/sankey-layout.ts`, `src/svg/sankey.tsx`, `styles.css`, `tests/architecture.test.ts`
(`LOCAL_PROPERTIES`), the test file. Tests first: `centreY` and `isLabelSpread`, unlabelled markup, leader paths only
for spread nodes on both sides, fixed aspect class and inline ratio, custom viewBox, the two opacity rules in CSS.

## Phase 3: docs

**Files:** `README.md` (Sankey and Bar list sections), `CHANGELOG.md` (`## Unreleased`).

Done when: the new tests were seen red, then green; the #321 tests unchanged and green; gates green (typecheck, lint,
test, build).

## Risks and rollback

- Default markup unchanged is pinned by `tests/adoption-gaps-321.test.tsx`.
- Rollback: revert the commits; no data, no migration.

## Progress

- [x] Phase 1: BarList stacked, missing, description (TDD) (1ad7777)
- [x] Phase 2: Sankey variants (TDD) (6a47bb7)
- [x] Phase 3: docs (14fd05a)
