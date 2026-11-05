---
change_id: marketing-kit-mix-true-peak-1079
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a7f5069).

- Acceptance of #1079: the limit measured on the encoded file with bounded retries (phase 1, 2), a 4x oversampled
  limiter as the last audio step that also works as gain plus limiter (phase 1), the gate returning `err` with both
  measurements (phase 2), the measurement in the result and the log (phase 2), tests with loud percussive music and a
  forced failure (phase 2).
- Risk: `alimiter` delays the sound by its lookahead; `latency=true` compensates, so the muxed track keeps sync. The
  test checks the finished duration as before.
- Risk: two inputs in the final pass; `-map 0:v:0 -map 1:a:0` with `-c:a copy`, the picture still copied.
- Risk: `alimiter`'s `limit` floor is 0.0625 (-24 dB); the retry clamps there and the gate fails cleanly beyond it.
- `mixLoudness: null` and a silent mix keep their behaviour; the speech pass is untouched.

Verdict: approved, no changes.
