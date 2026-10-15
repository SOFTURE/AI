# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/charts`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`charts@x.y.z`).

## 0.3.0

- `EventAxis` takes `layout="rail"` (issue #508): milestones on one line, each joined to the previous one by a segment
  with its own colour (`railSlot`, `railTone`, `railColor`, apart from the dot) and label (`segmentLabel`, hidden below
  `minLabelWidth`), and a `tick` under each dot. `layoutEventRail` is its server-safe layout; `EventAxisRailProps`
  and the `EventRail*` types are exported. The default layout and `EventAxisProps` are unchanged.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; `chartsMessages` is English only and `locale` is any BCP 47
  tag. An app that shows another language passes its own translation as `messages`; a key it leaves out reads English.
- `ChartCursor` and `EventAxis` take their built-in copy's locale from the prop, then from `UiLocaleProvider`, then
  `en` (#435). The `@softure-ai/ui` peer range starts at 0.1.7, the first version with `useUiLocale`.

## 0.1.9

- `withStepAt(points, index)`: a vertical jump in a series at one point (issue #409).
- `distinctColors(keys, palette?)`: a stable colour per key for an open set of bands, distinct while the palette
  lasts and independent of the keys' order.
- `stackSeries(series)` and `StackedAreas`: series stacked into bands (positive up, negative down) and drawn as
  `Area`s between their edges.
- Surfaces: `LineChart` takes `surface` (`page`, `dark`, `paper`); `ChartSurface` and `getChartSurfaceAttributes`
  put any chart parts on one, through @softure-ai/ui's `data-theme` scopes. `CHART_SURFACES`, `ChartSurfaceName`.
- `EventAxis` (client) and `layoutEventAxis`: a timeline of spans and milestones with a keyboard and pointer readout;
  `chartsMessages` gains `eventAxis.label`.
- The `@softure-ai/ui` peer range also accepts 0.2.0.

## 0.1.8

- `BarList` and `renderBarListHtml` take `layout` (`inline` or `stacked`: label and value over a full-width bar), and
  items take `missing` (an empty track outlined dashed in the row's colour, left out of the default `max`) and
  `description` (a line under the bar) (issue #378). `BarListRow` gains `missing` and `description`.
- `Sankey` takes `labels="none"` (the plot without label columns), `leaders` (lines from spread labels to their nodes)
  and `aspect="fixed"` (the plot at the viewBox's ratio, HTML labels following it); its `layout` takes `width` and
  `height`. `layoutSankey` nodes gain `centreY` and `isLabelSpread`.
- Ribbons and tinted nodes read `--sft-chart-sankey-link-opacity` and `--sft-chart-sankey-node-opacity`, each falling
  back to `--sft-chart-tint-opacity`.
- Without the new options, markup is unchanged.

## 0.1.7

- `LegendSwatch` and `SeriesLine` take `tone` and `color` (an app colour, set as `--sft-chart-series`) next to `slot`,
  which turns optional on `SeriesLine`; `SeriesLine` takes `pattern` (`solid`, `dashed`, `dotted`). `LegendSwatch`
  takes `faded`, `className`, `style` and `data-*`; `LegendItem` takes `as` (`li`, `div`, `span`), `faded` and
  `className` (issue #321).
- `Area`: the filled `areaPath`, tinted in a slot, tone or colour.
- `CHART_TONES` and `ChartToneName`, an alias of `ChartTone` that does not collide with an app's own type.
- `layoutSankey` and `Sankey`: a two-sided flow (inputs → hub → outputs) with gaps, spread labels and `solid`, `tint`
  and `hatch` fills.
- `BarList`, `getBarListRows` and `renderBarListHtml`: labelled horizontal bars with values, in React or as an HTML
  string.
- Without the new options, markup is unchanged; a `SeriesLine` with no slot, tone or colour draws in series 1.

## 0.1.6

- `ChartCursor` takes `renderReadout(point, index)` (the readout's content, still announced by the package's live
  region), `onActiveChange(index | null)` (once per change of the active stop), `frame` (`false` puts the children and
  the cursor layer in one positioned box instead of the frame grid) and `readoutClassName` (issue #301).
- `CursorValue.slot` is optional; `tone` (a `ChartTone`) colours the dot and its readout swatch when there is no slot,
  and `className` is added to both.
- Without the new options, markup is unchanged.

## 0.1.5

- `smoothLinePath(points)`: a smooth curve through every point (monotone cubic), without overshoot between points.
- `areaPath(points, { baseline, curve })`: a line closed to a baseline y or back along a lower edge (stacked bands),
  linear or smooth.
- `SeriesLine` takes `curve` (`linear` by default, markup unchanged; `smooth` draws `smoothLinePath`).

## 0.1.4

- `ChartFlag` without `xPercent` no longer inherits `top: 0`: a parent that places it with `position: absolute` and
  `bottom` no longer stretches it over the plot (issue #221).
- `ValueAxis` takes `narrow` (`alternate`, the default, or `all`, which keeps every label on narrow screens).
- `ChartPin` takes `classNames: { line, dot }`. The dash variables (`--sft-chart-dash`, `--sft-chart-dash-gap`) are
  declared on the pin's column and inherit to the line; the line reads `--sft-chart-pin-line` before
  `--sft-chart-cursor`.
- README: `opacity` on the lines is `stroke-opacity`.
- Without the new options, markup is unchanged.

## 0.1.3

- Lines (`GridLines`, `Baseline`, `GuideLine`, `SeriesLine`) take `tone` (a `ChartTone` read from the tokens), `slot`,
  `strokeWidth`, `opacity`, `className`, `style` and `data-*` attributes; `GuideLine` adds the `solid` pattern.
- `ChartFlag` takes `variant` (`flag`, `ink`, `outline`), `size` (`sm`, `md`), `className`, `style` and `data-*`;
  `ChartPin` takes `variant` (`flag`, `ink`), `size` (`sm`, `md`, `lg`), `ring` (`axis`, `surface`), `className`,
  `style` and `data-*`. On both `xPercent` is optional: without it the parent places the marker.
- `numberAxisTicks` labels a numeric horizontal axis (a month index) with the edge rules of `timeAxisTicks`; both take
  `sublabel` (a second label row, rendered by `TimeAxis`) and `narrow` (`edges`, `alternate`, `all`).
- Without the new options, markup is unchanged.

## 0.1.2

- Described in the GitHub Release `charts@0.1.2`.
