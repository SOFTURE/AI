# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.3.0

- **`WorldMap` `isFitted`:** the map fills a box of a given height instead of setting its own, centred and as large as
  the whole 2:1 map fits (never below the 720 px phone minimum, past which it scrolls), for a map that is the whole
  screen.
- **`MapLegendTooltip`:** the legend folded into one small button over the map; hover or focus shows the key and an
  optional note (the map's source) as a tooltip above it.

## 0.2.0

- **`MapControls`:** the map's zoom controls (plus, minus, an optional reset to the first view) as one flat bar
  on the raised surface, vertical or horizontal, every name from props; the limits disable their buttons.

## 0.1.1

- **French Guiana is its own shape (#1153):** `WORLD_COUNTRY_SHAPES` no longer draws it as part of France (`250`);
  it is `254`, so a visited France leaves it unpainted. The first release through the npm trusted publisher.

## 0.1.0

- First version (#1135): the Flat Atlas design system as a theme package on `@softure-ai/theme-kit`. Tokens (passport
  paper light scheme first, passport cover dark scheme, stamp ink, passport blue and marigold, the map roles),
  `page.css`, and the components `Button`, `IconButton`, `SiteHeader`, `Wordmark`, `CountryCounter`, `CountryChip`,
  `MapPin`, `MapPopover`, `MapLegend`, `Card`, `Postcard`, `PostcardStamp`, `Photo`, the travel icons
  (`ATLAS_ICONS`), and `WorldMap` with Natural Earth 1:110m countries projected at build time
  (`@softure-ai/theme-flat-atlas/world-map`).
