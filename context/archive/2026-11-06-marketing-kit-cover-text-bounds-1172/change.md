---
change_id: marketing-kit-cover-text-bounds-1172
title: "marketing-kit: renderPhotoCover answers its text box and focus point (#1172)"
status: archived
roadmap_item: null
branch: claude/project-thread-ytgvyb
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent
An adopting app wants to warn the caller when a cover's text lands on the photo's subject (the focus point). The kit
already measures the drawn text (`findDrawnBox`) and computes the crop (`getCoverCrop`), but `PhotoCover` answers only
`jpeg`, `width`, `height` and `bytes`. Answer the geometry, so apps do not re-derive the kit's private layout rules.

## Scope
- `PhotoCover.textBox`: the box the fit check measured, `{ left, top, right, bottom }` (right/bottom excluded); null for
  layout `photo`.
- `PhotoCover.focusPoint`: the focus point on the cover after the crop, in pixels.
- `isPointUnderCoverText(cover, point, marginPx)`: the one overlap test every app uses.
- README, CHANGELOG (`## Unreleased`); the release ships together with #1170.

## Decisions (auto)
- `focusPoint` is not rounded: it is the exact image of the focus under the crop's translate and scale.
- `isPointUnderCoverText` grows the box by `marginPx` on every side (0 by default); a cover without text never
  covers a point. A negative or non-finite margin is a bug in the caller and throws a `RangeError`.

## Notes
- research kept short: the two inputs (`findDrawnBox`, `getCoverCrop`) already exist; no new dependency.

## Done
`PhotoCover.textBox`, `PhotoCover.focusPoint` and `isPointUnderCoverText` in the package (CHANGELOG `## Unreleased`),
shipping in the next marketing-kit release together with #1170.
