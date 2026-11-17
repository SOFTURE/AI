---
change_id: marketing-kit-draft-animation-timing
title: "marketing-kit: the footage draft runs every animation at the render's pace"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-draft-animation-timing
created: 2026-11-17
updated: 2026-11-17
---

## Intent

An adopting app compared a footage draft (540x960, libass) with the paid render (1080x1920, Chromium and GSAP) of
the same cut at the same seconds: a counter showed 2734 in the draft and 2797 in the render, and a typed note strip
showed one letter less in the draft. The draft is meant to be the render at half resolution, so at any second every
animation must stand where the render's stands, within one render frame.

## Context

- The render's timeline is GSAP; the draft approximates it in ASS steps (`draft-overlays.ts`) from the curves in
  `overlay-motion.ts` (`OVERLAY_EASES`).
- Follows `marketing-kit-draft-text-size` (0.42.0), which made the draft's text the render's size.

## Constraints

- No change to the render's look; where a value must be shared it moves to one function both paths call.
- Fixtures only (the kit's own fonts); no external service.
- Card shapes and heights are another change of the same adopting roadmap (draft card shapes); this change touches
  only times and eases.

## Notes
