---
change_id: marketing-kit-mix-retry-1095
status: archived
---

# Plan: the mix stage's retries model the limiter (issue #1095)

Input: change.md, research.md. Complexity: small (one pure function and its caller).

## Phase 1: the retry

Files: `tools/marketing-kit/src/footage/loudness.ts`, `loudness.test.ts`, `pipeline.ts`, `src/index.ts`.

- `MixTry { attempt, measured }`. `getNextMixAttempt(tries, inputI, target)`: the ceiling as before (lowered by the
  overshoot plus `MIX_RETRY_MARGIN` when the true peak is over, never under the floor); the gain from the limiter
  model in research.md (`getLimiterSlope(tries, inputI)`, default `MIX_LIMITER_SLOPE` 0.5, at most
  `MIX_LIMITER_SLOPE_MAX` 0.7, fitted when the tries' drives spread by `MIX_SLOPE_SPREAD`); with keep speech the aim
  is the window shrunk by `MIX_RETRY_EDGE_MARGIN` 0.3 LU (at most half the tolerance), and the gain stays where it
  was when the predicted mix is inside it. Throws on an empty `tries` (a bug).
- `finishMix` keeps every try and passes them with the render's measured loudness.
- Pure tests: the issue's measured sequences (0.3/0.6 and 0.3/0.9 rows) give a gain that the model predicts inside
  the window; a ceiling-only retry inside the shrunk window keeps the gain; the plain target aims at the target;
  the slope is fitted and clamped; an empty list throws.

## Phase 2: the ffmpeg test and docs

- `finish.test.ts`: the issue's fixtures (8 s, speech/music 0.3/0.6, 0.3/0.9, 0.9/0.9) with keep speech finish at most
  -1 dBTP and inside -14 ± 1 LUFS in at most `MIX_ATTEMPTS` encodes, over several noise seeds.
- CHANGELOG `## Unreleased`, README's mix section if it describes the retry.

## Acceptance

- The new ffmpeg test fails on 0.12.0's retry for at least one fixture and passes with the fix (evidence: test run
  before and after).
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- The model applies to both modes: the plain target's retries pass through the same code, the simulation shows no
  regression (0 of 40 fail, fewer encodes), and one retry rule is simpler than two.
- `getNextMixAttempt`'s signature changes (exported since 0.11.0): it needs the earlier tries and the render's
  loudness to fit the limiter. Noted in the CHANGELOG; the kit is 0.x and released as a minor.

## Progress

- [x] Phase 1: `getNextMixAttempt(tries, inputI, target)` with `getLimiterSlope`; `finishMix` passes every try. Unit tests in `loudness.test.ts` (26 pass).
- [x] Phase 2: ffmpeg test (issue fixtures, 8 seeds in all) failed on 0.12.0 (seed 1 of 0.3/0.6 and seed 5 of 0.3/0.9 after 4 encodes) and passes with the fix; `src/footage/` 454 tests pass; CHANGELOG and README updated.
