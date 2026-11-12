# Implementation review: marketing-kit-segment-camera

- Drift: none.
- Correctness: the draft's punch-in path keeps its old expression for every case without a camera; a still framing
  is a crop (no `zoompan`), a moving one `zoompan` about its anchor.
- Tests: 23 new (helpers, schema bounds, validation, diff, draft filters, composition markup and tweens, picture
  tails, overlay guards, a real ffmpeg draft).
- Verdict: approve.
