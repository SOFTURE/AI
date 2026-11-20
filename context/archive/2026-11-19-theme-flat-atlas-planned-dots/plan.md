# Plan: theme-flat-atlas-planned-dots

## Goal
Planned countries dotted instead of dashed (map and legend); the counter's unit flush with the number on a phone.

## Phase 1
`WorldMap.tsx` (pattern, fill attribute, `stroke-map-edge`), `MapLegend.tsx` (dotted swatch), `CountryCounter.tsx`
(`md:pb-2.5`). Tests in `components.test.tsx` and `theme-css.test.ts`; README, CHANGELOG, version 0.5.0.

**Done when:** theme tests, typecheck and lint green; the adopting app (Playwright, desktop and iPhone) shows dotted
planned countries, a dotted legend swatch and the counter flush on the phone.

## Progress
- [x] Phase 1 — theme tests 90/90, typecheck, lint green; Playwright screenshots of the adopting app with a packed
  0.5.0 checked (desktop map and zoomed South-East Asia, legend, iPhone 13).
