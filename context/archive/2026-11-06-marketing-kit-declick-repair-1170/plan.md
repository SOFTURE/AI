---
change_id: marketing-kit-declick-repair-1170
status: done
---

# Plan: impulse repair instead of a gate (issue #1170)

Input: change.md, research.md. Complexity: small.

## Phase 1: the regression test first

- `declick.test.ts`: a fixture whose transcript spans are 30 ms (onset) and 60 ms (decay) narrower than the sound;
  the 5 ms RMS envelope inside every word window (±80 ms) differs from the input by ≤ 1 dB in 99.9 % of frames, for
  both levels. It must fail on the current stage.

## Phase 2: the stage

- `declick.ts`: remove the gate (`getGateWindows`, `getDeclickGain`, `DECLICK_GATE_FADE`, `DECLICK_IMPULSE_DB`,
  `gateDb`). New: `DECLICK_WORD_GUARD` (0.08), `DECLICK_CROSSFADE` (0.003), `getRepairZones(words, seconds)` (gaps
  shrunk by the guard; none without words), `findImpulses` keeps its detector but returns only impulses whose repair
  (with its crossfades) fits a zone, `repairImpulse` (AR order 24 over 10 ms of context on each side, forward and
  backward prediction blended, 3 ms raised-cosine crossfades), `declickSamples` repairs every channel and leaves every
  other sample as it is. `DeclickReport` becomes `{ level, impulses, repairs: TimeSpan[] }`; the log line names the
  count and the first times.
- `DECLICK_MAX_IMPULSE` drops to 12 ms: a mouth click is a few milliseconds, longer bursts are not interpolated.

## Phase 3: callers, docs

- `draft.test.ts` and the ffmpeg test read the new report; `schema.ts` description, `marketing.schema.json`
  regenerated, README section, CHANGELOG `## 0.18.0` entry (breaking: the gate's exports are gone).

## Acceptance

- The regression test fails before Phase 2 and passes after; clicks in long pauses fall by ≥ 20 dB at their peak;
  every sample outside the repairs is identical to the input.
- Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- Keep `gentle` / `strong` as names (detector sensitivity 15 / 9 dB) instead of removing them: configs that name them
  keep loading, and both now meet the issue's point 2, so they need no "experimental" mark.
- No words, no repair: without a transcript the stage cannot tell a click from a consonant.
- The prediction carries no added noise: inside a repair of a few milliseconds in a pause, a dip of the room tone is
  inaudible and the result stays deterministic.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
