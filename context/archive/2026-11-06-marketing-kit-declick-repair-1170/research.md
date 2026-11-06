# Research: the speech declick gates speech (issue #1170)

## Where the stage lives

- `tools/marketing-kit/src/footage/declick.ts`: `getGateWindows` (word ± 40 ms, 20 ms fade outside), `findImpulses`
  (2-8 kHz band energy, 2 ms frames, 1 ms hop, jump over a ±100 ms running median, bursts under 30 ms outside the
  words' own spans), `getDeclickGain` (gate times a -30 dB dip per impulse), `declickSamples`, `declickSpeech`
  (ffmpeg decode to f32, process, encode), `describeDeclick`. `DeclickReport` is `{ level, impulses, gateDb }`.
- Callers: `pipeline.ts` (render) and `draft.ts` (draft) run it when `getDeclickLevel(film) !== "off"`; the config
  schema (`schema.ts`) defaults `speech.declick` to `off`; `schema/marketing.schema.json` carries the description.
- Exports in `src/index.ts`: the gate's constants and functions are public API.

## Findings

- The issue's measurement matches the code: the gate covers everything outside word ± 40 ms, its fade sits at 40-60
  ms past the transcript boundary, exactly where real decays and soft onsets still sound. The impulse dip is a gain
  change too (-30 dB), not a repair.
- The fixture in `declick.test.ts` makes the transcript spans equal to the sound, so it never saw the boundary error.
- AR interpolation: a model fitted by the autocorrelation method (Levinson-Durbin) is minimum phase, so predicting
  forward from the left context and backward from the right context is stable; a linear blend of the two meets both
  edges. A raised-cosine crossfade of 3 ms on each side joins the prediction to the original.
- With a ±80 ms guard on every word, a gap must be longer than 160 ms plus the repair to hold one, which satisfies the
  issue's "gaps ≥ 150 ms".
