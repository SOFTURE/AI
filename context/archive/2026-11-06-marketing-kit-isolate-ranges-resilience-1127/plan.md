---
change_id: marketing-kit-isolate-ranges-resilience-1127
status: archived
---

# Plan: isolateSpeechRanges keeps going past a refused range (issue #1127)

Input: change.md, research.md. Complexity: medium (two modules, their tests, docs).

## Phase 1: crossfaded joins (pure)

Files: `src/footage/speech-ranges.ts`, `src/footage/speech-ranges.test.ts`.

- `DEFAULT_SPEECH_RANGE_FADE_MS = 15`. `getSpeechRangeFades(windows, fadeMs)`: per window the fade-in and fade-out
  intervals in clip milliseconds. A switch with a neighbour fades over `[switch - h, switch + h]`, `h = min(fade / 2,
  half the overlap)`, the same interval for both windows; an edge at the range's own edge fades inside the range over
  `min(fade, half the window)`.
- `buildRangeLayArgs(base, laid, output, { fadeMs? })`: each window trimmed to its fade bounds, `afade` in and out,
  delayed in samples; the base multiplied by `1 - sum(gains)` in `aeval`. `fadeMs: 0` keeps the hard switch.
- Test through ffmpeg: a constant 0.8 base and a constant 0.4 window on PCM: no sample step above 0.01.

## Phase 2: retries and per-range outcome

Files: `src/footage/isolate-ranges.ts`, `src/footage/isolate-ranges.test.ts`, `src/index.ts`.

- Options: `retry?: { attempts?: number (default 3); delaysMs?: number[] (default [1000, 2000]); wait? }`, the wait
  stopped by the signal; `fadeMs?`; `chargeItem?: (range) => string` (default the clip id); `rangeCache?: (range,
  clipKey) => { key, path }` (default `getSpeechRangeCache`).
- `IsolatedSpeechRange.outcome`: `{ kind: "cached" } | { kind: "bought"; attempts } | { kind: "failed"; error;
  attempts } | { kind: "not_bought" }`. A failed range is logged and left out of the lay; the call answers `ok`.
- Tests: a provider refusing one of three ranges three times (two laid and charged once each, the third `failed` with
  its error and 3 attempts, the clip's own sound in its window); a refusal that passes on the second attempt; a
  cancel during the wait rejects.

## Phase 3: estimate and docs

- `estimateSpeechRanges` / `estimateFootageFilm` take the same `rangeCache`.
- README "Isolating only the cut's voice", CHANGELOG `## Unreleased`.

## Decisions (auto)

- The charge keeps `item: clip id` by default (no ledger break); `chargeItem` gives a per-range item.
- Every refusal is retried alike: providers report no error kinds.
- Fade 15 ms (the issue's 10 to 20 ms); linear (`afade` `tri`), so the gains sum to one at a switch.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
