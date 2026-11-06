---
change_id: marketing-kit-range-gain-1159
status: in_progress
---

# Plan: cached ranges at the pre-gained level (issue #1159)

Input: change.md, research.md. Complexity: small.

## Phase 1: record and correct the gain

- `speech-ranges.ts`: `LaidRange.gainDb?` (a `volume` on the window before its fades);
  `getSpeechRangeGainPath(path)` (`<path>.gain.json`); `buildRangeMeasureArgs(file, range?)`, a `loudnorm`
  measuring pass over a file or a range of it; `getRangeInputGainDb` (pure): which gain the cleaned voice was cut at,
  from its measured loudness against the base range's (nearer to `-clipGain` means un-gained).
- `isolate-ranges.ts`: a bought range writes `{ "inputGainDb": n }` next to its cached file. When laying, each
  window's input gain is: the clip's gain for a range bought now; the record when there is one; else the
  measurement. The window is raised by `clipGain - inputGain`. Each range answers `gainDb` (what it was raised by)
  and `IsolatedSpeech` answers `speechGainDb`.

## Phase 2: the outcome and the docs

- `TranscribeOutcome` (`ready`) answers `speechGainDb: Record<clipId, number>` (placeholder included).
- `index.ts` exports the new helpers; CHANGELOG `## 0.16.1`, README range section, version 0.16.1.

## Phase 3: tests

- isolate-ranges: a range cached from the un-gained sound (no record) and a range bought now over one quiet clip:
  both windows within 1 dB of each other and of the sound around them; the record is written for the bought range;
  a recorded gain is honoured without a measurement.
- speech-ranges: the lay args carry the volume; `getRangeInputGainDb` decides both cases and silence.
- pipeline: `speechGainDb` in the ready outcome.

## Acceptance

- The issue's "Done when" holds in the kit's tests; gates: typecheck, lint, `npm test`.

## Decisions (auto)

- Record plus measurement fallback: the record is exact for every range bought from now on; the measurement covers
  ranges bought before the record existed (both the un-gained ones and those from 0.16.0, which are pre-gained).
- The measurement is used only to classify (0 or the clip's gain), never to match levels, so the cleaned voice keeps
  its natural difference to the original that an app already corrects.
- A silent cached file or base keeps the clip's gain as input (no correction): nothing to compare.
- The record is not written for a measured legacy range: reading the cache never writes to it.
- The whole-clip isolation path is unchanged (no join with the un-gained sound there).

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
