# Research: theme-flat-atlas-1135

## Sources read

- Design system artifact "FLAT ATLAS" (`project/README.md`, `project/tokens.json`, `project/components/*`,
  `bundle.css`): roles, palette, type scale, spacing, radii, sizes, motion, component anatomy and states.
- `themes/theme-kit/README.md` (the theme package contract), `themes/theme-flat-paint` (the sibling: tokens with shadcn
  aliases, `page.css`, tests), `themes/theme-notion` (a theme that ships its own components as Tailwind class strings,
  `sources` in `softureTheme`).
- `tests/repo/themes.test.ts`, `tests/repo/packages.test.ts`: the contract every new `themes/theme-*` package meets
  by existing (manifest shape, exports, client directives, `theme` and `cn` exports).
- `scripts/release/README.md`, `.github/workflows/release.yml`: every package already publishes through trusted
  publishing (OIDC) bound to `release.yml`; a new package's first publish needs `NPM_TOKEN`, then the owner adds the
  trusted publisher on npmjs.com ("First release of a new package").

## Findings

1. The kit's `ThemeDefinition` covers colours (light/dark or alias), fonts, text styles (size, line height, weight,
   tracking; no family), radii and sizes. Headings need `font-display` next to their text style.
2. The kit's generated CSS switches to dark by the system setting unless the page says `data-theme="light"`. Flat
   Atlas is light-first and no view uses dark, so the README tells the app to set `data-theme="light"` on `<html>`.
3. Components written as Tailwind classes need their folder as a `softureTheme` source, so the app's Tailwind
   generates them from `node_modules` (theme-notion does this).
4. A static world map: `world-atlas` (Natural Earth 1:110m TopoJSON), `topojson-client` and `d3-geo` give country
   paths; Natural Earth II is a closed polynomial (d3-geo-projection's `geoNaturalEarth2Raw`), so the package can
   implement the raw projection once, feed it to `geoProjection` in a generator script, and reuse it at runtime to
   place pins without d3 in the browser bundle.
5. The design system's icons follow the `@softure-ai/ui` frame (24 grid, stroke 2, round caps), the same as lucide;
   theme-notion already depends on `lucide-react`.
6. Every GitHub Actions job of this repository runs on GitHub-hosted runners; the release machinery needs no new
   workflow for a new package.
