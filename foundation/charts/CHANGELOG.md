# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/charts`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`charts@x.y.z`).

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
