---
change_id: marketing-kit-isolate-speech-ranges-1087
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and master (a5deade).

- Plan coverage: `speech-ranges.ts` (planning, windows, cache key, ffmpeg arguments), `isolate-ranges.ts` (the
  block), `estimateFootageFilm` `isolate: "segments"` and `estimateSpeechRanges`, `FootageCharge.range`,
  `FootageEstimateItem.range`, exports, README, CHANGELOG.
- Tests: pure tests pin the ranges (margin, clamp, borrowed and own spans, b-roll skipped, contained ranges dropped),
  the windows switching at the middle of an overlap, the cache key's parts and both ffmpeg argument lists. ffmpeg
  tests run the block on a generated clip: cleaned windows are silent and the rest keeps the tone, the file keeps the
  clip's length and two channels from a mono answer, a second run pays nothing, a moved segment pays one range, no
  `isCommit` lays only cached ranges, a provider failure names the range and writes nothing, a broken cached file is
  named, the estimates price uncached ranges and need the cut.
- Conventions: errors are values naming the range or file; aborts propagate as in the pipeline; English only.
- Gates: typecheck, ESLint and the language gate clean; the footage tests pass. One run of the whole footage folder
  saw a loudness timing test in `finish.test.ts` fail under load; it passes alone and this change does not touch it.
- The render path, `buildSpeechArgs` and whole-clip isolation are unchanged, so PR #1088 (declick) does not overlap.

Verdict: approved.
