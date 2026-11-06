# Implementation review: marketing-kit-isolation-min-length-1140

Verdict: approved.

- Provider: `IsolationProvider.minSeconds` (optional); ElevenLabs declares `ELEVENLABS_ISOLATION_MIN_SECONDS` 4.6;
  the fake takes `{ minSeconds }`, probes the input and refuses a shorter one with `audio_too_short`.
- Planner: drop identical/inside → merge (`mergeGap`, default 2 s, `null` off, `Infinity` whole span) → widen a
  short range to `minSeconds + minPad` inside the clip, shifted at an edge → merge again → mark `skip` below the
  minimum. `heard` is set only when narrower than the range, so unchanged plans compare equal to before.
- Lay: `getSpeechRangeWindows` works on heard spans, so a widened range is trimmed back to what the cut hears (ffmpeg
  test: silent inside the heard part, the clip's tone in the widened context).
- Block: a skipped range is never cut nor sent (`outcome: skipped`, no `audio/ranges/`), a range refused on every
  attempt has its cut file removed. Estimate: same plan through `getPlanOptions`; skipped items at 0 with `skipped`.
- Acceptance: the issue's film shape (one 80 s clip, 14 segments, 6 under 4.6 s, 1.2 s apart) with a fake refusing
  under 4.6 s: every range bought, no refusal, estimate seconds equal to the charged seconds, both merged (1 range)
  and with `mergeGap: null` (14 widened ranges).
- Evidence: `npx vitest run tools/marketing-kit` 72 files, 1120 tests passed; `npm run typecheck`, ESLint on
  `src/footage` and `npm run lint:language` clean.
