# Plan: theme-flat-atlas-1135

## Phases

1. Package skeleton `themes/theme-flat-atlas` (from theme-flat-paint's manifest and tsconfigs), `CHANGELOG.md`
   (`## Unreleased`), version 0.1.0, `softureTheme` with sources `./atlas` and stylesheet `page.css`.
2. Tokens `src/tokens.ts`: `FLAT_ATLAS_THEME` with the artifact's palette and roles (light, dark), shadcn aliases,
   fonts (`sans` Raleway, `display` Calistoga, `mono` DM Mono), text styles with 0.02em tracking (`hero` 0), radii,
   sizes. A fixture `tests/fixtures/flat-atlas-tokens.json` (the artifact's `tokens.json`) and a test that keeps the
   colours, type and sizes equal to it; contrast test for the pairs the system names.
3. `src/page.css`: scheme, motion tokens (160/220/320 ms, two easings), body tracking and lining numerals, `num`,
   `wordmark`, reduced motion, the hover scale of a pin only.
4. Map data: `scripts/build-world-map.mjs` (d3-geo + topojson-client + world-atlas, devDependencies) writes
   `src/map/world-110m.ts` (country `id` ISO numeric, `name`, `d`; graticule; viewBox; projection constants);
   `src/map/projection.ts` with the raw Natural Earth II and `projectToMap(lon, lat)`; a test that the runtime
   projection equals d3's for sample cities and that Antarctica is absent.
5. Components in `src/atlas/` (Tailwind classes on theme tokens, props for every text): `Button` + `getButtonLook`,
   `IconButton`, `SiteHeader`, `Wordmark`, `CountryCounter`, `CountryChip`, `MapPin`, `MapPopover`, `MapLegend`,
   `WorldMap` (countries by status, places as pins in the given order, horizontal scroll on phones; with the map data and projection from the subpath `./world-map` only, so the root stays light), `Card`,
   `Postcard`, `PostcardStamp`, `Photo`; `ATLAS_ICONS`; `formatCoordinates`. Render tests with
   `react-dom/server` and a Tailwind CLI test that every class compiles.
6. README (install with Vite, fonts, light scheme, rules, components, release steps for the first publish), lockfile,
   gates (typecheck, lint, tests for the package and `tests/repo`), build of the package.

## Acceptance

- `tests/repo/themes.test.ts` and `tests/repo/packages.test.ts` pass for the new package (evidence: vitest run).
- Package tests pass; `npm run typecheck`, `npm run lint` green; `npm run build` builds `dist/` with `theme.css`.
- `npm run release:pack -- --package theme-flat-atlas --dry-run` packs it.

## Decisions (auto)

- Lives in this repository as `themes/theme-flat-atlas` (`@softure-ai/theme-flat-atlas`): the theme-kit contract,
  tests and the trusted-publishing release already exist here; a separate repository would duplicate them.
- Ships its own components (no `@softure-ai/ui` dependency): the travel components have no ui counterpart and the
  first consumer is a Vite site without ui. Shadcn aliases are still defined, as the contract requires.
- The logo stays with the project (the artifact says so): `Wordmark` takes the mark as a node.
- Icons come from lucide-react under travel names (`ATLAS_ICONS`), not redrawn: same frame and stroke.
- `WorldMap` takes countries by ISO 3166-1 numeric id, as world-atlas keys them; no alpha-2 table in this change.
- The count-up and paint-in animations are decorations the system allows but does not need; the first frame is the
  final state, so they are left out of 0.1.0.

## Progress

- [x] p1 skeleton: manifest, tsconfigs, CHANGELOG `## Unreleased`, devDependencies for the map generator
- [x] p2 tokens: `tests/tokens.test.ts` and `tests/contrast.test.ts` green against the design system snapshot
- [x] p3 page.css: compiled by the Tailwind CLI in `tests/theme-css.test.ts`
- [x] p4 map: `scripts/build-world-map.ts` (tsx, typed) writes 176 countries; `tests/world-map-data.test.ts` checks
  d3 parity of the stored paths and the runtime projection, Antarctica absent
- [x] p5 components: `tests/components.test.tsx`; every component class compiles in the app's Tailwind (73 classes,
  no shadow utility generated after rewording comments the Tailwind scanner read as a `shadow` class)
- [x] p6 README (package and the root layout line); `npx vitest run themes/theme-flat-atlas` 5 files, 68 tests;
  `tests/repo` themes, packages, readme-layout, links, language, build-order 334 passed; typecheck clean; ESLint on
  the package clean; language gate clean; `npm run build` writes `dist/theme.css`; `release:pack --dry-run` packs
  `softure-ai-theme-flat-atlas-0.1.0.tgz`
