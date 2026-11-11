---
change_id: marketing-kit-overlay-entrances-exits
title: "marketing-kit: overlay entrances, exits and per-kind motion"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-overlay-entrances-exits
created: 2026-11-11
updated: 2026-11-11
---

## Intent

An adopting app's owner found the overlays flat: only fade, slide, type and none exist, a card's parts all come in
at once, and every overlay leaves the same way. The kit should offer a few natural entrances with some life (`pop`,
`rise`, `blur`, `wipe`), an exit and a curve per overlay, and per-kind touches: a list's points one by one (on their
words), a place card's pin and delayed subtitle, a keyword's underline drawn in. Nothing may bounce or overshoot.

## Context

The motion lives in two renderers: the render's GSAP tweens (`overlay-html.ts`) and the draft's ASS events
(`draft-overlays.ts`). The soft pill (a keyword, a lower third or a list without an entrance) eased with
`back.out(1.7)`, which passes 100 % scale. The counter already counts on `power2.out` in both.

## Constraints

- A stored EDL without the new knobs places and draws as before (no new resolved field, the same exits).
- One motion model both renderers read; every curve monotone, no element past 100 % scale.
- No paid call; tests on fixtures; draft frames checked with libass where ffmpeg has it.
- Minor bump (new knobs and exports): 0.31.0 (0.30.0 is reserved by a parallel change).

## Notes

- research skipped: the two renderers and the schema were read in full while planning (`overlay-schema.ts`,
  `overlays.ts`, `overlay-html.ts`, `draft-overlays.ts`, `draft-boxes.ts`); nothing outside them draws overlays.
- frame skipped: the request names the outcome and its bounds (no bounce) precisely.

## Done

New entrances, exits, easings and per-kind knobs in the schema, the resolver, the render and the draft, from one
motion model; frames of the render (Chromium + GSAP) and the draft (libass) looked at; 0.31.0.
