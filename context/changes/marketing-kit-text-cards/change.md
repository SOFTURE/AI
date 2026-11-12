---
change_id: marketing-kit-text-cards
title: "marketing-kit: text devices of hand-edited reels (highlight typing, note card, falling letters, end word)"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-text-cards
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app studies reference reels edited by hand and wants their text devices in the overlay catalogue, drawn
in both paths (the HTML render and the ASS draft): a hook typed into a highlight box that grows with the letters, a
handwritten paper note whose words appear as they are spoken, a torn paper strip that grows in with typed capitals
and a drawn tick, a title whose letters fall into place one by one, and a big closing word.

## Context

Overlays live in `src/footage/overlay-schema.ts` (shape), `overlays.ts` (time and place), `overlay-html.ts` (render)
and `draft-overlays.ts` (draft); motion in `overlay-motion.ts`. The draft ships one font (`fonts/`, DejaVu); the
render copies the brand fonts into `assets/fonts/`.

## Constraints

- Natural look: every curve eases out, nothing passes its rest (no bounce, no overshoot); a falling letter never
  goes below its line.
- Existing EDLs draw exactly as before: every new knob is optional and off without it.
- Fonts and textures are open-licence or made in code: the handwriting is Caveat (SIL OFL 1.1), subset to Latin; the
  paper and its torn edge are drawn procedurally.
- No paid call; tests use fixtures only. Minor bump.

## Notes

- Research is short (`research.md`). Frame skipped: the adopting app's roadmap item (with its reference study) states
  the outcome.
- Ribbon captions and a three-band split screen from the same study are left to separate changes (the adopting app
  split them into their own items).
