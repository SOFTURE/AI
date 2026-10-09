# Plan: charts-tone-area-sankey

Input: change.md (research and framing skipped, reasons under Notes). Complexity: medium (one package, three phases).

## Goal

Swatches and series lines coloured by meaning, an `Area` primitive, a tone alias, and two new components (`Sankey`,
`BarList`) with their geometry or rows as plain functions.

**Out of scope:** node-to-node Sankey links, new design tokens, changes to `LineChart` and the cursor.

## Findings (the reading behind the plan)

- `src/svg/legend.tsx`: `LegendSwatch({ slot, shape })` adds `seriesClass(slot)`; swatches read `--sft-chart-series`.
  `LegendItem` is always an `<li>`.
- `src/svg/lines.tsx`: `getLineLook` handles `tone`/`slot`/`strokeWidth`/`opacity`/`className`/`style`; `SeriesLine`
  bypasses tone and requires `slot`.
- `styles.css`: `.sft-chart-fill-tone` (0.1.6) maps `--sft-chart-tone` onto `--sft-chart-series`, so any part reading
  the series property can take a tone class plus this class.
- `tests/architecture.test.ts`: no raw colours or inline copy in `src/svg` and `src/cursor`; custom properties the
  stylesheet reads must be tokens of `@softure-ai/ui` or listed in `LOCAL_PROPERTIES`.
- There is no opacity token; local properties with a fallback (`--sft-chart-dash`, `--sft-chart-pin-line`) are the
  precedent.

## Key decisions

- **D1 colour.** One helper `seriesColourClass({ slot, tone })`: the slot class, else the tone class plus
  `sft-chart-fill-tone`. `color` becomes inline `--sft-chart-series`. Used by `LegendSwatch`, `SeriesLine`, `Area`,
  `Sankey` and `BarList`. `SeriesLine` with a slot keeps its exact markup.
- **D2 faded.** `.sft-chart-faded { opacity: var(--sft-chart-faded-opacity, 0.45) }` on a swatch or an item.
- **D3 LegendItem.** `as?: "li" | "div" | "span"`, default `li`.
- **D4 Area.** `<path class="sft-chart-area …" d={areaPath(points, { baseline, curve })}>`; fill reads
  `--sft-chart-series` (falling back to series 1) at `--sft-chart-tint-opacity` (0.24 by default); `opacity` prop sets
  `fill-opacity` inline.
- **D5 tones.** `CHART_TONES` as a const tuple, `ChartTone` derived from it, `ChartToneName` its alias.
- **D6 layoutSankey.** Values below zero count as zero. `total = max(sum in, sum out)`; one scale for both sides,
  `(height − gap × (n − 1)) / total` with n the larger side's count (the gap shrinks when it would eat more than half
  the height). Each side and the hub are centred vertically. Ribbons are closed cubic bands from a node's inner edge to
  its stacked slice of the hub. Label centres are spread to `labelSpacing` within the height (forward then backward
  pass; the spacing shrinks when the labels cannot fit).
- **D7 Sankey.** A grid of label column | plot | label column; labels HTML at percentages, plot an SVG in the layout's
  viewBox, hidden from assistive technology. Fills: `solid` (node in full colour), `tint` (tinted node), `hatch` (tinted
  node plus a hatch pattern in the node's colour). Ribbons are tinted.
- **D8 BarList.** `getBarListRows(items, { max })` (width = value / max in %, clamped to 0–100, `max` defaulting to the
  largest value) feeds both `BarList` and `renderBarListHtml`, which escapes text and attributes; the test pins that
  both produce the same markup.

## Phase 1: tone, colour, faded, Area, tone alias (TDD)

**Files:** `src/svg/class-names.ts`, `src/svg/legend.tsx`, `src/svg/lines.tsx`, `src/svg/area.tsx`, `src/index.ts`,
`styles.css`, `tests/architecture.test.ts` (local properties), `tests/adoption-gaps-321.test.tsx`.

## Phase 2: Sankey (TDD)

**Files:** `src/svg/sankey-layout.ts`, `src/svg/sankey.tsx`, `src/index.ts`, `styles.css`, the test file.

## Phase 3: BarList, docs, version (TDD)

**Files:** `src/svg/bar-list.tsx`, `src/svg/bar-list-html.ts`, `src/index.ts`, `styles.css`, the test file,
`README.md`, `CHANGELOG.md`, `package.json`, root `package-lock.json`.

Done when: the new tests were seen red, then green; existing tests unchanged and green; gates green (typecheck, lint,
test, build).

## Risks and rollback

- A `SeriesLine` without `slot` now type-checks; with no slot, tone or colour it draws in series 1 (fallback), not
  unstyled.
- Rollback: revert the commit; no data, no migration.

## Progress

- [x] Phase 1: tone, colour, faded, Area, tone alias (TDD)
- [x] Phase 2: Sankey (TDD)
- [x] Phase 3: BarList, docs, version (TDD)
