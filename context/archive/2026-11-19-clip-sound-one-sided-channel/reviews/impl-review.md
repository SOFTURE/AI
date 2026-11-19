# Implementation review: clip-sound-one-sided-channel

Verdict: approve.

- Matches the plan: the measure runs for every clip with sound, the fold reaches the loudness measure and the
  extraction, balanced clips keep their exact arguments (asserted by a test).
- Edge cases covered by tests: digital silence on both channels (`-inf`, balanced, not folded), mono, more than two
  channels, the exact threshold bounds, a failing measuring pass.
- Cost: one extra audio-only decode per clip; no cache key changes (the speech WAV is re-extracted on every run).
- Isolation results cached before this change were cleaned from the left-only sound; the provider answers mono,
  which already plays on both channels, so nothing needs re-buying.
- No finding left open.
