---
change_id: marketing-kit-footage-editing-898
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the #899 branch.

- Coverage of the issue's six points: sentences and retakes (1), quiet defaults (3), phrase captions (3), EDL v2
  with J/L-cuts, b-roll over speech, JSON Schema, `validateEdl`, `diffEdl` (2), `extractFrames` (4), safe zones and
  glyph check (4).
- Compatibility: v1 EDL files are upgraded on read; `findEdlProblems` stays; new `FootageFilm` fields are optional.
  The default look changes (hard cuts, phrase captions, no Ken Burns, no end-card whoosh): intended by the issue,
  called out in the CHANGELOG.
- Money: the video-music cache key ignores ids, so no paid result is bought again for an unchanged cut.
- Determinism: no model in the kit; retakes are suggestions with reasons.

Verdict: approved, no changes.
