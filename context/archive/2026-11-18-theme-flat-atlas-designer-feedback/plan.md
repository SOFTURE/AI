# Plan: theme-flat-atlas-designer-feedback

## Goal
A white map with clear land, Open Sans, a flag in `CountryChip`, the country's name on hover over `WorldMap`.

## Phase 1
`tokens.ts` and the token fixture (map, font), `CountryChip.tsx` (`flag`), `WorldMap.tsx` (`countryLabels`, hover
state, tag, `pointer-events-none` overlay). Tests in `components.test.tsx`, `tokens.test.ts`,
`world-map-hover.test.tsx`; README, CHANGELOG and version 0.4.0.

**Done when:** theme tests, typecheck and lint green; the adopting app (Playwright, desktop and iPhone) shows the white
map, flags in the chips and the country name on hover.

## Progress
- [x] Phase 1 — theme tests 88/88, typecheck, lint (code + language) green; Playwright screenshots in the adopting app
  checked (desktop, hover "Francja", phone).
