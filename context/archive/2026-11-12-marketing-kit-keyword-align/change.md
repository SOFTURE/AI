---
change_id: marketing-kit-keyword-align
title: "marketing-kit: a keyword's card on the left, in the middle or on the right"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-keyword-align
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app's owner wants the keyword card placed left, centre or right, set per preset and per overlay. Today a
keyword always stands on the right unless `style.side` says left, and `style.align` exists only for the two title
cards (it aligns their lines).

## Context

A keyword is placed in `overlays.ts` (`placeSideText`), its card fitted to its text by `getDrawnOverlayCard`, drawn by
the render (`overlay-html.ts`, `addSideText`) and the draft (`draft-overlays.ts`, `getSideTextEvents`). A list
already centres itself with `isCentred` (0.33.0).

## Constraints

- A keyword without `align` draws as before (on its side, the right by default); titles keep `center`/`left` only.
- The drawn card matches `getDrawnOverlayCard` within 2 % of the frame (libass frames).
- No paid call; fixtures only. Minor bump (new knob value and exports): 0.34.0.

## Notes

- Research is short (`research.md`): the files are the three renderers above and the schema.
- Frame skipped: the adopting app's roadmap item states the outcome.
