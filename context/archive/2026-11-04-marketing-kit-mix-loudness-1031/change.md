---
change_id: marketing-kit-mix-loudness-1031
title: "marketing-kit: the footage film's final mix at a loudness target, and the music's ducking attack/release (issue #1031)"
status: archived
roadmap_item: null
issue: 1031
branch: claude/project-thread-wg8mj2
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1031](https://github.com/SOFTURE/AI/issues/1031). A footage film rendered with the defaults measured
-25 LUFS integrated, because `film.loudness` normalizes only the speech track before the music goes under it and
nothing measures the final mix. After this change:

1. `FootageFilm.mixLoudness?: LoudnessTarget | null` (default -14 LUFS, -1 dBTP; null: today's behaviour) makes
   `finishFootage` measure hyperframes' mix and normalize it in two passes of `loudnorm` (linear gain), the video
   stream still copied and only the audio re-encoded; a silent mix is left as it is; the log names measured and
   target loudness;
2. `FootageMusic` gains optional `attack` and `release` (seconds) passed to `duckingKeyframes`; `marketing.json` takes
   them too;
3. a test finishes a short fixture film with speech-like sound and a music bed and measures it at target ±1 LU and
   true peak at most the target.

## Context

Labels: none on the issue (type `enhancement`, package marketing-kit). Files: `tools/marketing-kit/src/footage/film.ts`,
`loudness.ts`, `publish.ts`, `pipeline.ts`, `src/config/schema.ts`, `config.ts`, `schema/marketing.schema.json`,
README, CHANGELOG. Issue #1030 and the merge of #1025 run in parallel in marketing-kit; master is merged in before
the pull request.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the measured gap, its cause in the code and concrete asks.
