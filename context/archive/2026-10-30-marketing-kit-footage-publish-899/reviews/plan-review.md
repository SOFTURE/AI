---
change_id: marketing-kit-footage-publish-899
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (01cf45f).

- Coverage of the issue: loudness measured and normalized two-pass before the music (1), final pass with stated
  codecs and `+faststart`, stream copy where possible, checked with ffprobe (2), cover at a given time or the first
  talking segment (2), `RenderedFootage` facts read from the written file (2).
- Compatibility: new `FootageFilm` fields are optional; `RenderedFootage` only gains fields.
- Testability: the builders and parsers are pure and unit-tested; the real run is asserted in the fixture renders,
  which CI runs both on the runner and in the worker image.
- Risk: the hyperframes output may already match, so the pass is a stream copy; when it does not, re-encoding the
  video costs time. Acceptable: the check makes the result certain.

Verdict: approved, no changes.
