# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.1

- No code change: the first release through the npm trusted publisher (OIDC, no token).

## 0.1.0

- First version (#1135): the Flat Atlas design system as a theme package on `@softure-ai/theme-kit`. Tokens (passport
  paper light scheme first, passport cover dark scheme, stamp ink, passport blue and marigold, the map roles),
  `page.css`, and the components `Button`, `IconButton`, `SiteHeader`, `Wordmark`, `CountryCounter`, `CountryChip`,
  `MapPin`, `MapPopover`, `MapLegend`, `Card`, `Postcard`, `PostcardStamp`, `Photo`, the travel icons
  (`ATLAS_ICONS`), and `WorldMap` with Natural Earth 1:110m countries projected at build time
  (`@softure-ai/theme-flat-atlas/world-map`).
