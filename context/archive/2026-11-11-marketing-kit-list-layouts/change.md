---
change_id: marketing-kit-list-layouts
title: "marketing-kit: a list card that grows with its points, centred, or as chips"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-list-layouts
created: 2026-11-11
updated: 2026-11-11
---

## Intent

An adopting app's owner found the list card stiff: its points sit on one side in a box sized for the whole list from
the first moment, and the box shows empty before its first point. The kit should centre a list, grow its card point
by point as each comes in (eased, never past its size), bring the first point in with the card, and offer short
points as separate small cards ("chips") side by side in one centred row, entering in turn.

## Context

A list is placed in `overlays.ts` (`placeSideText`), drawn by the render (`overlay-html.ts`, GSAP) and the draft
(`draft-overlays.ts`, ASS). `getDrawnOverlayCard` is the box an app reports (does it cover a face?). Points come in
on `itemStarts` (0.31.0: `stagger`, `item_words`, `item_at`).

## Constraints

- Nothing overshoots: every growth eases out (`power3.out`), sizes only grow.
- A list with `style.side` keeps its side and bullets; no other kind changes.
- The drawn boxes an app reads (`getDrawnOverlayCard`) match what is drawn within 2 % of the frame.
- No paid call; tests on fixtures; libass frames where ffmpeg has it.
- Minor bump (new knob and exports): 0.33.0.

## Notes

- Research is short (`research.md`): the files are the three renderers above and their tests.
- Frame skipped: the adopting app's roadmap item states the outcome and the owner's words.
