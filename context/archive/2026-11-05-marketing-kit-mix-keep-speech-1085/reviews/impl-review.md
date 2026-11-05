---
change_id: marketing-kit-mix-keep-speech-1085
verdict: approved
---

# Implementation review

Reviewed the branch against plan.md and change.md.

- `getMixGain` decides the gain in one place: the target in the default mode; with `keep: "speech"` 0 inside
  `target ± tolerance`, else the nearest edge aimed `min(0.2, tolerance / 2)` LU inside. `getFirstMixAttempt` and
  `getNextMixAttempt` use it, so a retry inside the window only lowers the ceiling (tested).
- `findLoudnessProblems` reads the target's tolerance; without it the gate and its text are as before (the #1079
  tests are unchanged and green).
- `finishFootage` returns `mix` (the render's measurement, gain, ceiling, mode), null with `mixLoudness: null` or
  no stage (tested); the log names the window in keep mode.
- Fixture tests (real ffmpeg): two music volumes under speech normalized to -14 LUFS give the same gain and a
  quiet-moment step within ±0.5 dB of `20·log10(v2/v1)`; with the default mode the same fixtures drift by 0.40 and
  0.58 dB and fail the check, so the test guards the behaviour. A talk with long pauses (-16.8 LUFS) ends at about
  -14.8 LUFS, inside the window and not at the target.
- Config: `keep` and `tolerance` optional and validated (0.2-3 LU); the default config is unchanged.
- Language gate clean; typecheck and ESLint on the changed files clean.

Verdict: approved.
