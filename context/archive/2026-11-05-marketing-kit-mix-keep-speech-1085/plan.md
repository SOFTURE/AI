---
change_id: marketing-kit-mix-keep-speech-1085
status: archived
---

# Plan: a mixLoudness mode that keeps the speech level (issue #1085)

Input: change.md, research.md. Complexity: small to medium (two helpers, the final pass's log and result, config).

## Phase 1: the window gain (TDD)

Files: `tools/marketing-kit/src/footage/loudness.ts`, `loudness.test.ts`.

- `MixLoudnessTarget = LoudnessTarget & { tolerance?: number; keep?: "loudness" | "speech" }`.
- `getMixTolerance(target)` (`tolerance ?? MIX_LOUDNESS_TOLERANCE`); `getMixWindowGain(integrated, target)`: 0 inside
  `target ± tolerance`, else the gain to the nearest edge moved inward by `min(0.2, tolerance / 2)`.
- `getFirstMixAttempt` / `getNextMixAttempt`: with `keep: "speech"` the gain comes from the window; otherwise as
  today. `findLoudnessProblems` uses the target's tolerance.
- Tests: inside, below, above the window; retry inside the window keeps the gain; the tolerance in the gate's text.

## Phase 2: finishFootage, film and config

Files: `pipeline.ts`, `film.ts`, `config/schema.ts`, `index.ts`, `finish.test.ts`, a config test.

- `FootageFilm.mixLoudness?: MixLoudnessTarget | null`. `FinishedFootage.mix`: `{ measured: MixLoudness; gainDb;
  ceilingDbtp; keep } | null` (the render's mix and the stage applied; null when no stage ran).
- The log line names the mode: `gain +0.0 dB (speech kept: -14.0 ± 1 LUFS)`.
- `marketing.json`: `mixLoudness.tolerance` (0.5-3) and `mixLoudness.keep` (`"loudness"` | `"speech"`), both optional.
- Tests (real ffmpeg): speech normalized to -14 under constant music at two volumes, `keep: "speech"`: equal gain
  (within 0.1 dB), quiet-moment step within ±0.5 dB of `20·log10(v2/v1)`; a talk with long pauses and quiet music
  ends inside `-14 ± 1`.

## Phase 3: docs

CHANGELOG `## Unreleased`, README "Publishable output".

## Decisions (auto)

- The option shape follows the issue: `{ target, truePeak, tolerance, keep: "speech" }`; `keep: "loudness"` names
  today's behaviour and is the default.
- `tolerance` also sets the gate's window in the default mode (default 1, as today).
- The edge gain aims `min(0.2, tolerance / 2)` LU inside the window to avoid a retry from encode drift.
- `FinishedFootage.mix` is additive; `loudness` stays the finished file's measurement.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: the window gain
- [x] Phase 2: finishFootage, film and config
- [x] Phase 3: CHANGELOG and README
- [x] Implementation review: approved
