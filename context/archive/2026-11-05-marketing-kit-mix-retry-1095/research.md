---
change_id: marketing-kit-mix-retry-1095
---

# Research: the mix stage's retries with keep speech (issue #1095)

## Where

- `tools/marketing-kit/src/footage/loudness.ts`: `getMixGain`, `getFirstMixAttempt`, `getNextMixAttempt`,
  `MIX_EDGE_MARGIN` (0.2 LU), `MIX_RETRY_MARGIN` (0.3 dB on the ceiling), `MIX_ATTEMPTS` (4).
- `tools/marketing-kit/src/footage/pipeline.ts` `finishMix`: encode, measure, `getNextMixAttempt(attempt, measured,
  target)`, at most four times.
- Tests: `loudness.test.ts` (pure), `finish.test.ts` (ffmpeg fixtures from #1079 and #1085).

## Reproduction (ffmpeg 6.1.1, the issue's 8 s fixture, pink noise seeds varied)

A scratch script ran `finishMix`'s loop with the kit's exported functions over eight speech/music fixtures (0.3/0.6,
0.3/0.9, 0.9/0.9, 0.6/0.95, 0.05/0.95, 0.3/0.75, 0.5/0.9, 0.2/0.9) and five noise seeds: with `keep: "speech"`
**10 of 40 fail** on 0.12.0; the plain target fails none. The 6 s fixture of `finish.test.ts` happens to pass.

## Why it fails

1. A retry with keep speech corrects the gain only by what the mix missed the window by (aimed 0.2 LU inside), and
   not at all when the mix is inside the window but the true peak missed.
2. The same retry lowers the limiter's ceiling. On loud percussive music the limiter's loudness cost grows with how
   hard it is driven (gain minus ceiling): from the measured tries the cost rises about 0.55-0.6 LU per dB of drive,
   linear to within about 0.1 LU across the four tries. So a gain step of g dB raises the loudness by only about
   0.4 g, and a ceiling step down of c dB lowers it by about 0.6 c.
3. The plain target hides this because it aims at the window's centre: a 1 LU slack absorbs the limiter's cost.

## Options tried in the simulation (keep speech, failures)

| retry rule | fails |
| --- | --- |
| 0.12.0 (edge with 0.2 LU margin) | 10 of 40 |
| aim 0.2 / 0.3 / 0.4 / 0.5 LU inside the edge, also when only the ceiling moves | 4 / 3 / 3 / 3 of 40 |
| aim 0.5 inside plus a gain secant when the ceiling did not move | 2 of 32 |
| **limiter model** (below), 0.3 LU inside | **1 of 40** (seeds 1-7) and **0 of 40** (seeds 8-12); plain 0 of 40 |

Limiter model: every encode so far gives a point (drive `gain - ceiling`, cost `inputI + gain - integrated`). The cost
grows linearly with the drive at a slope fitted from the tries (least squares when their drives spread, else 0.5,
clamped to 0..0.7). The next gain is solved so the predicted loudness at the new ceiling meets the aim: the target
(plain) or, with keep speech, the gain stays when the predicted loudness stays inside the window minus 0.3 LU and
otherwise aims 0.3 LU inside the edge it would miss. With the model the fixtures finish in 1-3 encodes.
