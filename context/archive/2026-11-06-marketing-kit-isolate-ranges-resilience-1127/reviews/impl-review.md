# Implementation review: marketing-kit-isolate-ranges-resilience-1127

Verdict: approved.

- Retries: `isolateWithRetries` asks up to `attempts` times, waits `delaysMs` (the last repeats) through an
  injectable `wait`; the default wait is `node:timers/promises` with the signal and rethrows the signal's reason.
- Partial result: a refusal on every attempt sets `outcome: failed` with the last error and attempts, writes no cache
  file and is left out of the lay; the call answers `ok`. The broken-cache error (`err`) stays, as planned.
- Crossfade: `getSpeechRangeFades` shares one interval per switch, so the two gains sum to one; edge fades lie inside
  the range. The base uses `aeval` with the same piecewise linear gains, windows `afade` (linear) and `adelay` in
  samples. The ffmpeg test on PCM: max step under 0.01 with the fade, above 0.3 without.
- `chargeItem` and `rangeCache` default to the previous behaviour; the charge shape is unchanged.
- Evidence: `npx vitest run tools/marketing-kit/src/footage/` 32 files, 481 tests passed; `npm run typecheck`,
  ESLint on the changed files and `npm run lint:language` clean.
