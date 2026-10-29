---
change_id: marketing-kit-footage-films-886
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (911b0d1).

- Coverage of the issue: probe (1), normalize with rotation, HDR and fit (1), STT with word times and a fake (2),
  voice isolation (2), EDL with fillers, pauses, padding, max length and a hand-editable file (3), captions remapped
  through the EDL (3, 4), transitions and Ken Burns (4), music from a file, a prompt or the cut, ducked (2, 3, 4),
  render and posts (4, 5), library entry without `marketing.json` (4), CLI with separate steps (5), `--placeholder`
  (2, 4), fixture, unit tests and the CI render (6).
- Paid steps: every provider call sits behind `isCommit`, with an estimate first; caching is content-keyed.
- Compatibility: the screen film's config and composition are untouched; the shared HTML helpers move without
  changing output (the existing composition tests pin it).
- Departures from the issue's wording (a top-level `footage` array, ducking applied by ffmpeg, `--step=`) are
  recorded with reasons and keep the issue's intent.
- Risk: hyperframes seeking many `<video>` clips; mitigated by short keyframe intervals in the normalized clips and
  the CI render of the fixture film.

Verdict: approved, no changes.
