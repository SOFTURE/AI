# Plan: theme-flat-atlas-planned-pins-cover

## Goal
Planned pins and clusters as visible as visited ones; a fitted map that can cover its box.

## Phase 1
`MapPin.tsx`: planned dot `border-planned bg-planned`; `MapPinCluster` `status`. `WorldMap.tsx`: `fit` prop with the
`cover` width. Tests in `components.test.tsx`; CHANGELOG and version 0.3.2.

**Done when:** gates green; the adopting app on a phone (Playwright, iPhone 13) shows blue planned dots and a map that
fills the screen under the header with the intro folded.

## Progress
- [x] Phase 1 — theme tests 80/80, typecheck, lint green; Playwright screenshots in the adopting app checked.
