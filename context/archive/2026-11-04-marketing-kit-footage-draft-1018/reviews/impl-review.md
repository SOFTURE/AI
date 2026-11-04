---
change_id: marketing-kit-footage-draft-1018
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and the issue's asks.

- Ask 1 (draft builder): `buildFootageDraftArgs` seeks each segment in its own input, crops zoom cuts at
  `getSegmentScales` around the render's zoom origin (50 % / 42 %), zooms Ken Burns with `zoompan` over the segment's
  own length, joins fades with `xfade` at the segment's film start (the outgoing segment runs on, held with `tpad`
  when its clip ends) and other cuts with `concat`, burns in `ass` captions and writes H.264 yuv420p, AAC, fast start,
  `-t` the cut's length. `renderFootageDraft` runs it in `<buildDir>/draft/` with the speech track from
  `buildSpeechArgs`, the ASS file and the shipped font. A real run (4 segments, fade, zoom, Ken Burns, Polish
  captions, 1080x1920 sources) took 1.4 s and the frames show every element.
- Ask 2: `checkFootageTools({ needsDraft: true })` checks `ass`, `xfade`, `zoompan`.
- Ask 3: tests pin caption timing (`getCaptionSpans`, the ASS dialogue lines), zoom crops, the `zoompan` expression,
  the `xfade` offset and duration, the output length and codecs; a real-ffmpeg test runs when the filters exist.
- Found and fixed during implementation: `concat` changes the time base, which `xfade` refuses; every stream is now
  set to 1/30.
- Shared helpers keep the render and draft in step; `composeFootage`'s caption spans are unchanged (its tests pass).
- No version bump (batched release). Language gate, typecheck, lint, tests: see the PR.

Verdict: approved.
