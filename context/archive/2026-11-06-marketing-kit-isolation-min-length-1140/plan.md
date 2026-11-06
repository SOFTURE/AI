---
change_id: marketing-kit-isolation-min-length-1140
status: archived
---

# Plan: plan speech ranges the Voice Isolator accepts (issue #1140)

Input: change.md, research.md. Complexity: medium (planner, block, estimate, providers, tests, docs).

## Phase 1: the provider names its minimum

Files: `providers.ts`, `elevenlabs.ts`, `fake.ts`, `fake.test.ts`.

- `IsolationProvider.minSeconds?: number`: the shortest input the provider accepts; absent: no minimum.
- `ELEVENLABS_ISOLATION_MIN_SECONDS = 4.6`, set on `createElevenLabsIsolationProvider`.
- `createFakeIsolationProvider({ minSeconds? })`: declares it and refuses (`audio_too_short`) an input whose probed
  length is under it, so tests see the provider's behaviour.

## Phase 2: the planner plans source ranges

Files: `speech-ranges.ts`, `speech-ranges.test.ts`.

- `SpeechRange.heard?: { startMs; endMs }`: the part the cut hears when the range was widened or merged; absent: the
  whole range. `SpeechRange.skip?: { reason: "too_short"; minSeconds }`: the range cannot pass and is not sent.
- Options: `minSeconds?` (default none), `mergeGap?: number | null` (default `DEFAULT_SPEECH_RANGE_MERGE_GAP` = 2 s;
  null keeps every range apart, as before; `Infinity` isolates each clip's whole used span once), `minPad?` (default
  `DEFAULT_SPEECH_RANGE_MIN_PAD` = 0.4 s).
- Order: spans with margin → drop identical/inside → merge ranges of a clip with a gap ≤ `mergeGap` (heard = union) →
  widen each range shorter than `minSeconds` symmetrically to `minSeconds + minPad`, inside the clip (shifted when an
  edge stops it) → merge again where a widened range now reaches a neighbour → mark a range still under the minimum.
- `getSpeechRangeWindows`: windows from the heard spans (switching at the middle of overlapping heard spans), so the
  cleaned result is trimmed back to what the cut hears.

## Phase 3: block and estimate

Files: `isolate-ranges.ts`, `paid.ts`, `isolate-ranges.test.ts`, `index.ts`.

- `isolateSpeechRanges` plans with `providers.isolation.minSeconds` and takes `mergeGap`, `minPad`. A skipped range is
  never cut nor sent: `outcome { kind: "skipped"; reason; minSeconds }`, its window keeps the clip's own sound. A range
  refused on every attempt has its cut file removed.
- The estimate plans the same way (`mergeGap`, `minPad` options); a skipped range is an item with `units: 0`,
  `credits: 0` and `skipped: { reason, minSeconds }`.
- Acceptance test: the issue's film shape (one clip, 14 segments, 6 under 4.6 s, gaps under 2 s) with a fake provider
  refusing under 4.6 s: every range bought, no refusal, the estimate's seconds equal the seconds sent. Plus: a clip
  shorter than the minimum is skipped, marked in the estimate and leaves no work file; a refused range leaves no file.

## Phase 4: docs

README "Isolating only the cut's voice", CHANGELOG `## Unreleased`.

## Decisions (auto)

- 4.6 s for ElevenLabs from the production evidence (bound in (4.18, 4.64]); a paid probe call is not made.
- Merging is on by default (2 s, as the issue asks). It changes the cache keys of ranges an app already paid for;
  `mergeGap: null` keeps the old per-segment ranges. Recorded in the CHANGELOG.
- Never retrying a deterministic refusal waits for #1141's structured errors; here the too-short range is not sent.
- The whole-span option is `mergeGap: Infinity`, not a separate flag.
- Edge fades stay inside the window.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4
