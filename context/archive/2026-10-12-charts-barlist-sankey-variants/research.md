# Research: charts-barlist-sankey-variants

Input: change.md, issue #378. Depth: quick (one package, two components, prior change #321 archived).
Snapshot: dea65f2 on claude/project-thread-wno2hf, 2026-10-12 09:05 Europe/Warsaw.

## Summary

`BarList` and `Sankey` arrived in 0.1.7 (#321) with one look each. `BarList` rows come from one pure function
(`getBarListRows`) shared by the React component and `renderBarListHtml`, which a test pins to identical markup, so
every new row option must go through the rows and both renderers. `Sankey` is a three-column grid (labels | plot |
labels) whose plot stretches to `--sft-chart-plot-height`; labels are HTML at percentages of the viewBox height, so
they stay aligned at any box size. Ribbons and tinted nodes share one rule reading `--sft-chart-tint-opacity`. The
layout already knows each node's centre and its spread label centre, which is all a leader line needs. New custom
properties must be listed in `tests/architecture.test.ts` `LOCAL_PROPERTIES`.

## Current state

- `foundation/charts/src/svg/bar-list.tsx:41` `getBarListRows(items, { max })`: width = value / max, clamped; `max`
  defaults to the largest value. `BarList` (`:62`) renders `ul > li` of label, hidden track with a bar, value.
- `foundation/charts/src/svg/bar-list-html.ts:15` writes the same markup as a string, escaping text and attributes.
- `foundation/charts/styles.css:466-501`: the list is a three-column grid (label | track | value); rows are subgrids.
- `foundation/charts/src/svg/sankey-layout.ts:72` `layoutSankey`: nodes at `x = 0` and `x = width - nodeWidth`, label
  centres spread by `spreadLabels` (`:113`); a node exposes `y`, `height` and `labelY`.
- `foundation/charts/src/svg/sankey.tsx:37` `Sankey`: `SankeyLabels` | plot (`preserveAspectRatio="none"`) |
  `SankeyLabels`; `layout` prop omits `width` and `height`, so the viewBox is always 1000 × 400.
- `foundation/charts/styles.css:413-463`: grid columns, label positioning, `.sft-chart-sankey-link,
  .sft-chart-sankey-tint { fill-opacity: var(--sft-chart-tint-opacity, 0.24) }`.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| BarList | `src/svg/bar-list.tsx`, `src/svg/bar-list-html.ts` | layout, missing row, description |
| Sankey | `src/svg/sankey-layout.ts`, `src/svg/sankey.tsx` | node centre and spread flag, label variants, leaders, aspect |
| Styles | `styles.css` | new modifiers, two opacities, leader strip |
| Guards | `tests/architecture.test.ts` | new local custom properties |
| Docs | `README.md`, `CHANGELOG.md` | `Unreleased` section (no version bump) |
| Tests | `tests/adoption-gaps-378.test.tsx` (new) | hand-written oracles |

## Data

None.

## Tests

`tests/adoption-gaps-321.test.tsx` pins the default markup of both components and the layout numbers (projections, so
new node fields do not break it). `tests/architecture.test.ts` guards colours, inline copy and custom properties.
`tests/repo/packages.test.ts:80` requires the CHANGELOG's newest section to be `Unreleased` or the current version.
Run: `npx vitest run foundation/charts`.

## Patterns to follow

- Opt-in modifiers as extra classes on the root (`sft-chart-faded`, `LegendItem as`), defaults unchanged.
- Local custom properties with fallbacks (`--sft-chart-sankey-label-width`, `--sft-chart-tint-opacity`).
- Colour through `seriesColourClass` / `seriesColourStyle` (`src/svg/class-names.ts:51`).
- Plot SVGs hidden from assistive technology, strokes `vector-effect: non-scaling-stroke` (`styles.css:462`).

## Prior work

- `context/archive/2026-10-09-charts-tone-area-sankey/`: introduced both components; decided HTML labels, one hub,
  string labels for `BarList` (shared with the HTML renderer).

## SOFTURE modules

Not applicable: the change is inside `@softure-ai/charts`.

## Risks

- Default markup drifting (low): the #321 oracles stay untouched and must pass.
- A stretched leader strip distorting lines (low): a non-scaling stroke keeps the line width; its ends stay on the
  label and node heights because both are in viewBox units of the same height.
- SVG text scaling with the drawing (high if chosen): text in a fixed-ratio SVG shrinks with the box; see decisions.

## Relevant lessons

L-001 (tsc builds): no bundler-only syntax; nothing else applies.

## Answers to unknowns

- Can a fixed aspect ratio keep HTML labels aligned? Yes: labels sit at percentages of the plot height, so a plot
  sized by `aspect-ratio` and label columns stretched to the grid row keep them on their nodes.
- Where can a leader line live with HTML labels? In a strip between the label column and the plot, an SVG in the
  same viewBox height, stretched like the plot.

## Open questions

- SVG labels vs a fixed aspect ratio: decided (auto), fixed aspect ratio with HTML labels (below).

## Decisions (auto)

- Issue point Sankey 4 offers "SVG labels, or a fixed aspect ratio": take the fixed aspect ratio. SVG text inside a
  scaled drawing changes size with the box (unreadable on a phone at the default viewBox) and breaks the package rule
  that labels are HTML; a fixed ratio removes the stretching, which is the problem the issue names.
