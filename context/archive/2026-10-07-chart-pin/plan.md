# Plan: chart-pin

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase).

## Goal

- `ChartPin({ xPercent, yPercent, line?, slot? })` exported from `@softure-ai/charts`: HTML for `ChartPlot`'s
  overlay, hidden from assistive technology (the data belongs in `ChartDataTable`).
- Markup: a zero-width column at `left: x%` spanning the plot's height, holding a dashed line from the bottom to
  `height: y%` (unless `line={false}`) and a dot at `bottom: y%`.
- Styles in `styles.css` on the tokens only: line in `--sft-chart-cursor` at `--sft-chart-grid-width` with the
  guide's dash; dot `--sft-chart-dot-size`, ring 2 px in `--sft-chart-axis`, fill `--sft-chart-flag` (the event's
  colour, as the chip over it) or the series colour with `slot`.
- Tests, README (primitives table, FIRE mapping row), `@softure-ai/charts` 0.1.0 → 0.1.1.

**Out of scope:** pins inside `LineChart` (its flags have no y; a `LineChartFlag.y` is a separate item if wanted),
FIRE's surfaces and size variants (an app overrides `--sft-chart-dot-size` and the tokens), any ui token.

## Approach

Port FIRE's `ChartPin` from Tailwind classes to `sft-chart-pin*` classes. FIRE's parent places a column; here the
pin takes `xPercent` itself, as `ChartFlag` does, so a flag and its pin share one number.

## Key decisions

- **Dot in HTML, not SVG** (roadmap unknown): the viewBox is stretched, so an SVG circle is an ellipse at most
  aspects. The cursor's dots are already HTML for the same reason.
- **Line in HTML too**, so one component draws the whole pin and the line ends exactly under the dot (two layers
  would need two calls with two coordinate systems). The dash is a `repeating-linear-gradient` from the bottom with
  the guide's lengths. The guide's `stroke-dasharray` is in screen pixels (`non-scaling-stroke`), so the lengths
  move to two custom properties (`--sft-chart-dash`, `--sft-chart-dash-gap`), defined in one rule on
  `.sft-chart-guide-dashed, .sft-chart-pin-line` (the two readers, so no ancestor is needed): the pattern still
  lives in one place.
- **Ring in `--sft-chart-axis`, not the background**: FIRE's RD-9 found a lime dot ringed in the card colour at
  ~1.2:1 on white, invisible; a ring in a text-level colour keeps 3:1 (WCAG 1.4.11) in both themes. Same ring as
  the cursor dot, so the chart has one dot.
- **`line={false}`** stays (FIRE RD-9: where a `GuideLine` already marks the event, a second dashed line overlaps).
- **`slot`** fills the dot with a series colour (a pin on a series line); FIRE's `gleboka` variant maps to it.

## Phase 1: ChartPin (TDD)

- `tests/primitives.test.tsx`, `describe("pins")`: exact markup for a pin at 40 % / 30 % (column, line height, dot
  bottom, `aria-hidden`); `line={false}` renders the dot only; `slot={2}` adds `sft-chart-series-2` to the dot;
  percentages rounded by `percent` (33.333 → 33.33 %); inside `ChartPlot`'s overlay it lands after the SVG.
- `src/svg/pin.tsx`, export in `src/index.ts`; `styles.css` pin rules and the shared dash properties.
- README: primitives row, FIRE mapping row ("Stays in FIRE" no longer lists `ChartPin`); version 0.1.1 in
  `package.json` and the lockfile.

Done when: the pin tests were seen red (no export), then green; `npm run typecheck|lint|test|build` green; the pin
seen in a browser on a stretched plot (round dot, dashed line ending under it, both themes), and a
`GuideLine` on master and on the branch screenshotted side by side (the dash in `px` matches the old unitless one).
Positions are not clamped (as `ChartFlag`): they come from `toPercent` on the drawing's scales.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: ChartPin

#### Automated
- [x] 1.1 Pin tests seen red, then green — c433732
- [x] 1.2 Styles, export, README and version 0.1.1 — c433732
- [x] 1.3 Gates green (typecheck, lint, test, build) — c433732

#### Manual
- [x] 1.4 Pin seen in a browser on a stretched plot, light and dark — c433732
