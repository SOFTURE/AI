# Research: pwa-manifest-icon-origin-920

## Findings
- `buildManifest` writes `id: startUrl` and has no `dir`. The W3C manifest's `id` is resolved against `start_url`'s
  origin; Chromium treats a changed `id` as another app, so an app must be able to pin it.
- `createIconRoute` forwards `theme`, `icon`, `tone`, `strokeWidth` and the registry's `shape` to `drawAppIcon`.
  The kit's `glyphScale` defaults to 0.625 (0.5 for `maskable`) and refuses a maskable scale outside the safe zone, so
  a single app-wide scale must not reach the maskable icon unless named for it.
- The worker picks the first extra origin whose origin matches and serves it cache first by request URL, storing
  every `ok` answer (`fromExtraOrigin`, bounded by `assetTimeoutMs` since #924).
- A map host typically serves tiles, the style, TileJSON, sprites and glyphs from one origin, so one origin needs
  different strategies per path: the entry needs a path filter, first match wins.
- A page that downloads an area writes into `caches.open("<app>-<cache>")` itself; it has to compute the same key the
  worker looks up, so the key rule must be exported for the page as well as applied inside the worker.

## Sources
- `modules/pwa/src/**`, `modules/pwa/tests/**`, `themes/theme-kit/src/next/draw-app-icon.tsx`.
- Issue #920.
