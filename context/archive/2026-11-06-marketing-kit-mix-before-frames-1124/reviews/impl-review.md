---
change_id: marketing-kit-mix-before-frames-1124
verdict: approved
---

# Implementation review (auto)

- Scope: the four asks of #1124 are implemented (≤ 2 encodes on the issue's fixtures, `attempts`, `warnTolerance`
  with `loudness.warning`, the mix built and gated before the frames). No manifest or lockfile change.
- Evidence: the new ffmpeg tests fail-or-slow on master (2 / 4 encodes / failure after 4 for clicks 0.6 / 0.75 / 1.0)
  and pass with `attempts: 2` on the branch; the older #1031, #1079, #1085 and #1095 tests pass unchanged in intent
  (expectations updated for the new log line, `warning`, `encodes`). Both footage film renders pass end to end.
- Correctness: the true peak gate is never relaxed (`getLoudnessVerdict` warns only under the limit); a silent mix
  and `mixLoudness: false` keep the render's sound as before; `finishFootage` without a prepared mix still mixes
  the render (its tests). The finished file's sound is the prepared AAC stream copied, so the final gate measures what
  the stage measured.
- Conventions: pure step functions are tested on their own; errors name the step and the values; English only.
- Follow-up risk: the ffmpeg mix may differ from hyperframes' own audio by small timing (mp3 decoder delay); both
  start at 0 and the fixture film's render test passes. The draft still mixes its own way (unchanged).
- Approved.
