---
change_id: marketing-kit-cover-accent-1188
status: done
---

# Plan: accent on the photo cover (issue #1188)

Input: change.md, research.md. Complexity: small.

## Phase 1: code

- `photo-cover.ts`: schema `accent: z.boolean().optional()`; `PhotoCoverInput.accent`; `MIN_ACCENT_CONTRAST = 3`;
  `getContrast(a, b)` from `getLuminance`; `resolveCoverText` refuses `accent` outside `kicker-title` and `pill`;
  `getCoverInk` gains `kicker` (the kicker colour) and `pill: { box, text, alpha }`; with the accent the kicker is
  `colors.accent` and the pill box the opaque accent with the label in the better reading of foreground and
  background; an error names the colours and the ratio when it is under 3:1.

## Phase 2: tests (written first, failing without the change)

- kicker drawn in the accent over a black photo (the kicker's rows are lime, the title's are the light colour);
- pill box in the accent, the label dark (`#0c0c0d` reads better on lime);
- without `accent` the cover is byte-for-byte the same as with `accent: false`;
- refusals: `accent` on `title-bottom`; a kicker accent under 3:1 against the scrim; a pill accent no text colour
  reads on.

## Phase 3: docs

- README (the photo cover section), CHANGELOG `## Unreleased`.

## Acceptance

- The new tests pass, the existing photo-cover tests unchanged.
- Gates: typecheck, lint, tests.

## Decisions (auto)

- One boolean `accent` instead of per-layout options: each layout has one place the accent goes.
- The accent pill is opaque so the contrast check matches what is drawn.
- The pill's label colour in accent mode ignores `tone`: the better contrast of foreground and background wins.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
