# Research: charts-svg-primitives

Date: 2026-10-06. Sources: FIRE_TRACKER `ed8d285` (read only), SOFTURE/AI `f33d26a` (CH-1 merged).

## 1. What FIRE has (`src/components/chart/`)

| File | What | Generic? |
| --- | --- | --- |
| `chart-surface.ts` | three surfaces (`rola`, `czern`, `papier`) as Tailwind class maps; tones (`accessible`, `locked`, `debt`…) as `var(--…)`; `percent()` (two decimals); `flagAnchorClass` (18/82 edge rule) | `percent`, the edge rule; surfaces and tones are FIRE's palette |
| `time-axis.tsx` | HTML row of labels under the canvas, edge labels aligned to the edges, middle ones hidden on phones and dropped within an edge margin; `yearAxisTicks` with an age row | the row and the edge rule; years-from-month-index and the age row are FIRE's |
| `value-axis.tsx` | HTML labels at `bottom: n%`; `amountTicks` adds a zero tick and the PLN suffix; on phones every other label hidden, **counted from the top** (RD-12) | everything but the PLN copy (the currency suffix) |
| `chart-lines.tsx` | `GridLines`, `Baseline`, `GuideLine` (dash patterns `4 3` and `2 4`), all `vector-effect: non-scaling-stroke` | yes |
| `chart-legend.tsx` | `LegendSwatch` (box, dot, line, dashed, dotted), `LegendItem` | yes, minus FIRE's colour-from-database outline |
| `chart-flag.tsx` | `ChartFlag` (lime chip, dark text 700, both themes), `ChartPin` (dashed pin and dot) | yes |
| `unlock-step.ts` | a vertical step in a FIRE series | no (FIRE domain) |
| `chart-primitives.test.tsx` | 17 markup cases + an architecture guard ("no local copies of axes") | 10 generic cases port; the PLN, age-row and FIRE-path guards stay |

The cursor lives outside `chart/`: `capital-chart-readout.tsx` (client): a focusable `role="application"` wrapper,
`onMouseMove`/`onTouchStart`/`onTouchMove` → `nearestPointIndex` on pixel geometry, ArrowLeft/Right step,
Escape clears, a readout bubble (no live region; the bubble is not announced). The data table does not exist in FIRE.

Rules worth keeping (FIRE lessons cited in the code):

- **HTML labels, not SVG `<text>`** (WY-2): the canvas uses `preserveAspectRatio="none"` to fill the card, which
  would stretch letters. Labels are HTML at percentages of the plot box.
- **Hairline strokes** (`non-scaling-stroke`): the stretched canvas must not thicken lines.
- **Thinning counted from the top**, so the highest label always stays on a phone (RD-12, F3).
- **Positioning comes from the parent**, not baked into the axis (impl-review RD-5, F1: `.relative` beat the
  parent's `.absolute`).
- **One scale for the drawing and the cursor** (L-031): CH-1 settles it with `scale.invert`.
- **Flags at the edges align to the edge** (18/82), or the chip leaves the card.

## 2. What SOFTURE/AI gives

- `@softure-ai/charts` (CH-1): `linearScale`, `timeScale` (with `invert`), `peakOf`, `valueTicks`, `dateTicks`,
  `formatDateTick`, `nearestPointIndex`. No React, no dependencies.
- `@softure-ai/ui` token contract (`src/theme/tokens.ts`): `SCHEME_TOKENS` (colours, shadows) and `SHARED_TOKENS`
  (type, shape, space, motion); `buildThemeCss` writes them; `buildTailwindTheme` maps the families
  `color-`, `font-`, `text-`, `radius-`, `space-`, `shadow-`, `ease-` and skips the rest (`duration-`). The test
  `styles.test.ts` "maps every … token" excludes only `duration-`, so a `chart-` family needs the same exclusion.
  `tokens.test.ts` checks names are kebab-case and that the defaults cover every token.
- Package CSS without Tailwind: `@softure-ai/blog/styles.css` (plain CSS in `@layer softure`, on `--sft-*` only,
  `./styles.css` export, listed in `files`). The example app imports it after ui's CSS. NFR-7 (≤ 20 kB gzip) and
  "no runtime CSS-in-JS" hold for a plain stylesheet.
- Copy: `@softure-ai/core` `formatMessage`, `mergeMessages`, `Dictionaries`, `DeepPartial`, `Locale`; ui's
  pattern is `locale` + `messages` props per component (`getCopy`). Architecture tests (`ui/tests/architecture.test.ts`)
  find raw colours and inline copy with the TypeScript AST; the charts test can reuse the same approach.
- Example app: installs foundation packages packed (`install-links`), so a new stylesheet must be in `files`; a
  `file:` dependency plus the lockfile is all the wiring (no list of packages elsewhere). Pages are public unless the
  proxy protects them (`/account` only). Copy in `messages/{en,pl}.ts`.
- `@softure-ai/ui` is published (0.1.5); a change to it is a patch bump (`0.1.6`): a minor bump would leave the
  `^0.1.x` ranges of its dependents (release README: `release:version` refuses that).

## 3. Coordinates

FIRE draws in a viewBox sized per chart (720 × 200) and lays HTML labels by percent. The generic version fixes one
viewBox (`1000 × 400`) and gives every overlay its position as a percentage of it: `x / 1000 × 100`. Scales from
CH-1 map data to viewBox units; the server computes every position once, so the client cursor gets only
percentages and never repeats the scale (L-031 by construction).

## 4. Unknown: pointer events only, or touch drag too?

Pointer Events cover mouse, pen and touch with one set of handlers (`pointermove`, `pointerdown`), all browsers
supported by Next 16. A finger dragging sideways keeps firing `pointermove` only if the browser does not take the
gesture for scrolling: `touch-action: pan-y` on the cursor area leaves vertical scrolling to the page and gives
horizontal drags to the cursor (FIRE does the same with `touch-pan-y` and separate touch handlers). So: pointer
events only, with `touch-action: pan-y`; no separate touch handlers. `pointerleave` fires when a finger lifts, so the
readout clears as FIRE's `onTouchEnd` did.

## 5. Accessibility decisions

- The SVG is decoration for assistive technology (`aria-hidden`); the data is in a visually hidden `<table>`
  (caption = the chart's title, a header row, one row per point), so a screen reader gets every value, not a
  picture.
- The cursor is a focusable `role="group"` with an accessible name from messages (title + how to use the keys);
  ARIA forbids a name on a generic `div`. Keys: ←/→ step, Home/End jump, Escape clears; the first → lands on the
  first point and the first ← on the last (FIRE started both at 0).
- The readout is `role="status"` (`aria-live="polite"`, atomic): what the cursor shows is announced, and it is the
  same text a sighted user reads.
- The cursor line and the dots' ring need ≥ 3:1 against the surface (WCAG 1.4.11); grid lines are decoration.
