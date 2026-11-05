# Implementation review: marketing-kit-segment-captions-1077

Verdict: approved.

- Every ask of #1077 has code and a test: the field in `edlSchema`, `readEdl` and the JSON Schema (regenerated
  `schema/edl.schema.json`); `validateEdl` bounds (both edges, the frame less one card) through `readEdlFile`;
  `diffEdl` naming a move and a return to the film's box; the render's inline position and the draft's extra ASS
  style for a moved segment's chunks; the spanning-chunk rule in both; highlight and phrase styles alike.
- Byte-identity: chunks in the film's box emit exactly the previous markup and ASS lines (no extra style), pinned by
  tests comparing an EDL with empty `caption: {}` against one without; the existing compose and draft tests pass
  unchanged.
- `captionMaxLines`' fit script works per caption element, so a moved box keeps it; the glyph check depends on
  characters only.
- Backwards compatible: optional field, optional fourth argument of `validateEdl` and `readEdlFile`.
- Gates: typecheck, lint, the language gate and the marketing-kit suite (1064 tests) green.
