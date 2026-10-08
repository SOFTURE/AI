# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/charts`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`charts@x.y.z`).

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
