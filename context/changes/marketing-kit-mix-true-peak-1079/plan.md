---
change_id: marketing-kit-mix-true-peak-1079
status: in_progress
---

# Plan: the finished MP4 holds the true peak (issue #1079)

Input: change.md, research.md. Complexity: medium (loudness module, final pass, result type, docs).

## Phase 1: the mix stage (TDD)

Files: `tools/marketing-kit/src/footage/loudness.ts`, `publish.ts`, tests.

- `loudness.ts`: `getMixFilter({ gainDb, ceilingDbtp })` (`volume`, `aresample=192000`, `alimiter` with `level=false`,
  `latency=true`, `aresample=48000`); `buildMixArgs({ input, filter, output })` (sound only, AAC 192k 48 kHz stereo);
  `findLoudnessProblems(measured, target)` (true peak over the limit, integrated outside +/- 1 LU; sentences with both
  values); `getNextMixAttempt(attempt, measured, target)` (ceiling lowered by the overshoot + 0.3 dB when over,
  clamped to -24 dB; gain corrected by the integrated miss). Constants: first ceiling `truePeak - 1 dB`, 4 attempts.
- `publish.ts`: `buildFinishArgs` takes `audioFile` (a second input muxed with `-c:a copy`) in place of `audioFilter`.
- Tests: the pure helpers; args shape.

## Phase 2: finishFootage

Files: `pipeline.ts`, `finish.test.ts`, `index.ts`.

- `finishMix`: encode, measure, retry; gives the `.m4a` or an error naming the last measurement. The final pass
  muxes it; the finished MP4's sound is measured and gated (`err` naming both values); `FinishedFootage.loudness`;
  the log states measured values. `mixLoudness: null`: the finished file is still measured and reported, not gated.
- Tests (real ffmpeg): loud percussive music fixtures (the issue's) end <= -1 dBTP and -14 +/- 1; a target the limiter
  cannot reach (`truePeak: -30`) fails the render with both measurements; existing tests updated to the new log.

## Phase 3: docs

CHANGELOG `## Unreleased`, README "Publishable output".

## Decisions (auto)

- Gain plus limiter replaces `loudnorm` in the mix stage (research): deterministic gain, no dynamic fallback.
- The gate uses `loudnorm`'s measurement (true peak via 192 kHz) through the existing `measureLoudness`.
- The forced bad measurement is an unreachable target, not a test-only hook in the public options.
- `loudness` in the result is null for a film without sound or a silent mix.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: the mix stage
- [ ] Phase 2: finishFootage
- [ ] Phase 3: CHANGELOG and README
- [ ] Implementation review
