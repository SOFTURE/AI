# Plan: theme-flat-atlas-fitted-map-legend-tooltip

## Phases

1. `WorldMap` `isFitted`: the box `grid h-full [container-type:size]`, the map `m-auto w-[min(100cqw,200cqh)]` next to
   `min-w-map-min`; `data-fitted` on the box.
2. `MapLegendTooltip`: a small secondary `Button` described by a `role="tooltip"` panel on the raised surface, shown on
   `group-hover` and `group-focus-within`; the legend in a column and an optional note in mono.
3. Tests, README, CHANGELOG, version 0.3.0.

## Progress

- [x] 1. Fitted map.
- [x] 2. Legend tooltip.
- [x] 3. Tests (`npx vitest run themes/theme-flat-atlas`: 76 passed), docs and version.
