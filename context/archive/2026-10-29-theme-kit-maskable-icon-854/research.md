---
change_id: theme-kit-maskable-icon-854
---

# Research: maskable app icons (issue #854)

## What exists

- `themes/theme-kit/src/next/draw-app-icon.tsx` (#839): `buildAppIconElement` draws a flex box in the tone's
  background, radius 22 % of the side for `rounded` and 0 for `square`, and the glyph as an `<img>` data URL at
  `GLYPH_RATIO` 0.625 of the side. `renderIconSvg(icon, color)` draws `IconNode` data with lucide's defaults, the
  stroke width fixed at `2`; `{ svg }` markup is used as given, so a stroke width cannot be applied to it.
- W3C Web App Manifest, icon `purpose: "maskable"`: the safe zone is a circle centred in the icon with a radius of
  40 % of its side (diameter 80 %). The launcher may crop anything outside it; the background must fill the whole
  image (no transparency, no corner radius).
- A square glyph box of side `s` (share of the icon side) stays inside that circle when its half-diagonal fits:
  `s · √2 / 2 ≤ 0.4`, so `s ≤ 0.8 / √2 ≈ 0.566`. The adopting app's 50 % sits inside it.
- The adopting app draws `rounded` / `square` at 68 % and `maskable` at 50 %, and a heavier stroke at tab size
  (`ICON_STROKE_WIDTH + 0.5` from theme-notion). The kit's 62.5 % stays the default for those shapes (no visual change
  for apps already on 0.1.5); the app passes its 68 % as `glyphScale`.
- Manifest icons are not Next metadata files: `app/manifest.ts` lists their URLs, and a route handler serves the
  PNG. `ImageResponse` is a `Response`, so `drawAppIcon` can be returned from `GET` as is.

## Options

1. A `maskable` shape with a default scale of 0.5, plus `glyphScale` and `strokeWidth` options. Chosen: it is the
   issue's proposal and keeps the existing defaults.
2. A separate `drawMaskableIcon` function: a second entry point for one radius and one scale. Rejected.
