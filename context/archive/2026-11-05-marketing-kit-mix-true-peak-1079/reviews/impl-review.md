---
change_id: marketing-kit-mix-true-peak-1079
verdict: approved
---

# Implementation review

Reviewed the branch diff against plan.md and issue #1079.

- Ask 1 (limit on the encoded file): `finishMix` encodes the gain + limiter mix to AAC on its own, measures it with
  `loudnorm`'s true peak (192 kHz), retries with the ceiling lowered by the overshoot + 0.3 dB and the gain corrected,
  at most `MIX_ATTEMPTS` (4); the final pass muxes it with `-c:a copy` (`buildFinishArgs` `audioFile`).
- Ask 2 (limiter as the last step, 4x oversampled, works as gain plus limiter): `getMixFilter` is `volume`,
  `aresample=192000`, `alimiter` (`level=false`, `latency=true`), `aresample=48000`; no `loudnorm` in the mix stage, so
  an already normalized speech track only gets gain and limiting.
- Ask 3 (gate): the encode loop returns `err` naming both values and the misses; the finished MP4 is measured again
  and gated the same way.
- Ask 4 (measurement in the result): `FinishedFootage.loudness`, spread into `renderFootage`'s rendered result; the log
  states measured values.
- Ask 5 (tests): three loud percussive fixtures (the issue's generator) at <= -1 dBTP and -14 +/- 1 LUFS with the
  duration kept; an unreachable target (-5 LUFS at -9 dBTP, inside the schema's range) fails with both values; pure
  helpers and args unit-tested.
- Gates: typecheck, ESLint on the changed files, language gate, marketing-kit suite (1041 passed) green locally.
- `mix.m4a` is removed on success and on failure; the render file is kept on failure, as before.

Verdict: approved.
