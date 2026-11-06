---
change_id: marketing-kit-mix-before-frames-1124
status: archived
---

# Plan: the footage mix before the frames, in at most two encodes (issue #1124)

Input: change.md, research.md. Complexity: medium (the mix stage, its config, the render's order).

## Phase 1: the mix stage (`loudness.ts`)

- The chain: `volume`, 4x `alimiter` at the ceiling, back to 48 kHz, `lowpass=f=16000`; the encode adds
  `-cutoff 16000` (`MIX_LOWPASS_HZ`).
- The ceiling: `truePeak - MIX_ENCODE_HEADROOM` (1 dB) at first; a retry lowers it only by the measured true-peak
  excess plus `MIX_RETRY_MARGIN` (0.3 dB), never under the floor. The gain never moves it.
- The gain: solved at the ceiling on uncompressed passes (`solveMixGain`, a pure step function
  `getNextGainProbe(probes, aim)` plus an ffmpeg measure): the aim from `getMixAim(integrated, target)` (default mode:
  the target; keep speech: none while inside the window shrunk by `MIX_RETRY_EDGE_MARGIN`, else that margin inside
  the edge), secant steps, a flat or falling slope steps by the miss, at most `MIX_GAIN_PROBES` (6), the best probe
  kept. A retry shifts the aim by the codec's measured loudness drift (encode minus probe).
- Remove the limiter slope model (`getLimiterSlope`, `getNextMixAttempt`'s drive model, `MIX_LIMITER_*`) it replaces.
- `MixLoudnessTarget.attempts` (1-6, default `MIX_ATTEMPTS` 4) and `warnTolerance` (≥ tolerance, ≤ 3).
  `getLoudnessVerdict(measured, target)`: `pass`, `warn` (inside `target ± warnTolerance`, true peak under the
  limit; a sentence with both values) or `fail` (the problems).

## Phase 2: before the frames (`pipeline.ts`, `compose.ts`, new `film-mix.ts`)

- `getFootageSfxCues(film, edl, sfx)` from `compose.ts` (the composition uses it too).
- `buildFilmMixArgs`: speech, music, sfx cues mixed as hyperframes plays them, 48 kHz stereo float WAV, film length.
- `mixFootage(film, { mixSource, seconds }, options)`: measure, silent → null, else the mix stage to `mix.m4a`;
  fails with the stage's sentence. `runRenderFootage` builds and mixes after the asset tracks, before hyperframes;
  a failure returns before any frame. `finishFootage` takes `mix` (a prepared mix, or null to keep the render's
  sound); without it, it mixes the render as today. `buildFinishArgs` maps a given audio file even when the render
  has no audio stream.
- The finished file's gate uses the verdict: `FinishedFootage.loudness.warning` (null when it passes).

## Phase 3: schema, docs, tests

- Schema: `attempts`, `warnTolerance` (refined ≥ tolerance), the description says the mix is measured before the
  frames. Generated JSON schema if the package has one.
- Unit tests: the probe step, the aim, the retry ceiling, the verdict, the sfx cues, the mix args, the schema.
- ffmpeg tests: the issue's lavfi and flite-free fixtures with keep speech finish at -14 ± 1 and ≤ -1 dBTP in at
  most 2 encodes; a near miss finishes with a warning; `attempts: 1` is honoured; a failing mix fails before
  hyperframes (renderFootage stops before the render; tested through `mixFootage`).
- CHANGELOG `## Unreleased`, README's mix section.

## Acceptance

- The issue's fixtures fail or need 3-4 encodes on today's stage and finish in ≤ 2 with the change (test before and
  after).
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- A 16 kHz low-pass on the finished mix: it bounds the codec's overshoot (research §2) and costs nothing audible on
  phone speech and stock music for short videos. Not an option: fewer knobs.
- The gain is found by measuring the uncompressed chain (cheap) rather than modelled; non-monotone material is
  handled by keeping the best probe.
- `attempts` default stays 4 ("as today"); the new stage usually needs 1.
- The limiter's slope model and `getLimiterSlope` are removed from the exports (0.x minor; noted in the CHANGELOG).
- The hyperframes render still carries its own sound; it is ignored for the finished mix when the mix stage ran.

## Progress

- [x] Phase 1: fixed ceiling (`getFirstMixCeiling`, `getNextMixCeiling`), the gain solved on uncompressed probes
  (`getMixAim`, `getNextGainProbe`, `getBestGainProbe`, `solveMixGain`), 16 kHz low-pass and `-cutoff 16000`,
  `attempts`, `warnTolerance`, `getLoudnessVerdict`; the slope model removed. `loudness.test.ts`: 35 pass.
- [x] Phase 2: `getFootageSfxCues`, `buildFilmMixArgs` (`film-mix.ts`), `mixFootage`; `runRenderFootage` builds and
  gates the mix as an asset track before hyperframes; `finishFootage` takes the prepared mix; `buildFinishArgs` maps
  a given audio file first. `film-mix.test.ts` (args, cues, an ffmpeg run checking length and cue timing).
- [x] Phase 3: schema (`attempts` int 1-6, `warnTolerance` refined ≥ tolerance), `marketing.schema.json` regenerated,
  CHANGELOG `## Unreleased`, README. ffmpeg tests: the comment's lavfi fixtures (clicks 0.6, 0.75, 1.0) with keep
  speech and `attempts: 2` pass; on master (860e3e2) the same fixtures took 2 and 4 encodes and failed after 4
  (`+1.0 dBTP`). Near-miss warning and its failure without the band, `mixFootage` failing before a render.
  `MARKETING_KIT_RENDER=1` fixture footage film and the jobs-worker film render end to end.
- Decision during implementation: keep speech's "no gain" band is the window shrunk by 0.1 LU through the limiter
  (0.3 broke #1085's "same gain whatever the music volume" test: the limiter's cost pushed a -14.65 mix out); a miss
  aims 0.45 LU inside the edge.
