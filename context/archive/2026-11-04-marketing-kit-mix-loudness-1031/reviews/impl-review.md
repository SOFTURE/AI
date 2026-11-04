---
change_id: marketing-kit-mix-loudness-1031
verdict: approved
---

# Implementation review: marketing-kit-mix-loudness-1031

- Ask 1: `finishFootage` measures the render (`measureLoudness`, `-vn`) when `mixLoudness` is not null and the render
  has sound, passes `getLoudnessFilter` to `buildFinishArgs`; the picture keeps its copy-or-encode rule, the sound is
  re-encoded once. Silent mix: logged and finished as before. Log line names measured and target loudness.
- Ask 2: `FootageMusic.attack` / `release` reach `duckingKeyframes` through `getDuckingOptions`; `marketing.json`
  takes `music.attack` / `music.release` (0-5 s) and `mixLoudness` (false or a target, default -14 / -1); the JSON
  schema is regenerated.
- Ask 3: `src/footage/finish.test.ts` finishes a 6 s fixture (a pausing tone over a noise bed, about -30 LUFS)
  through the real `finishFootage` and measures -14 ±1 LUFS, true peak ≤ -1 dBTP, h264 + aac; a silent fixture and
  `mixLoudness: null` are covered.
- Found on the way: digital silence prints `target_offset: inf`, which `readLoudnessMeasurement` read as NaN and so
  failed the measurement instead of answering silent (the speech track had the same gap). Fixed and tested.
- Gates: typecheck, ESLint, language gate (hooks), marketing-kit tests 736 passed, repo tests passed.
- Approved without changes.
