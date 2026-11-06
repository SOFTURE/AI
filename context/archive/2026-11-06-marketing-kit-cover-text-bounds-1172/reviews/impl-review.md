# Implementation review

Verdict: approved.

- `findDrawnBox` now returns right/bottom excluded; the fit check compares with `<=` and the scrim gets the last drawn
  row (`bottom - 1`), so the drawn cover is unchanged (the existing scrim and layout tests pass untouched).
- `focusPoint` is computed from the same `crop` that draws the photo, so it cannot drift from the render.
- `textBox` is a copy, not the internal object. The helper is pure and throws only on a caller bug (bad margin).
- Each acceptance line of #1172 has a test: lit pixels inside `textBox` and untouched rows above the scrim; `focusPoint`
  for a landscape, a portrait, an EXIF-rotated photo and a focus near an edge; null for `photo`.
