# Implementation review: marketing-kit-caption-ranges

- No drift from the plan. `getCaptionPlaceAt` is the one place a chunk's box is chosen; the render and the draft both
  reach it through `getCaptionChunkLayouts`.
- Suggestion (accepted, no change): `findShotBreak` ignores range edges; an overlay running across one is kept clear
  of both boxes by the band union instead of being stopped, which the tests cover.
- Checked: an EDL without `captionRanges` is untouched (existing draft/compose "same file" tests green).

Verdict: approve.
