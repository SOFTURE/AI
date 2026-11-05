---
change_id: marketing-kit-mix-keep-speech-1085
---

# Research

## Where the gain is decided

`finishFootage` (`tools/marketing-kit/src/footage/pipeline.ts`) measures the render (`measureLoudness`), then
`finishMix` runs `getFirstMixAttempt` (`gainDb = target - inputI`, ceiling `truePeak - 1 dB`), encodes the sound to
AAC through `getMixFilter` (volume, `alimiter` at 192 kHz), measures it and, while `findLoudnessProblems` reports a
miss, takes `getNextMixAttempt` (ceiling lowered by the overshoot + 0.3 dB, gain corrected by `target - integrated`),
at most `MIX_ATTEMPTS` (4) encodes. The finished MP4 is measured and gated with the same `findLoudnessProblems`
(fixed `MIX_LOUDNESS_TOLERANCE` = 1 LU). All gain decisions live in the two pure helpers in `loudness.ts`.

## Why the speech moves

The gain is measured on the whole mix, so it follows the music: the speech track is already at `film.loudness`, and
any gain on the mix moves it. A window instead of a point target removes the dependency as long as the mix lands
inside it, which is the usual case once the speech is normalized to the same target (the issue's table: -13.7 to
-15.5 LUFS without the final gain).

## Options

1. Window gain in the two helpers (chosen): `keep: "speech"` makes the first gain 0 inside the window, else the
   distance to the nearest edge; a retry corrects only by what the encoded mix misses the window by. The limiter,
   encode and gate stay #1079's.
2. Re-mix speech and music in the final pass: needs the separate stems, which the render does not give back. Rejected.

## Risks

- Landing exactly on the edge: the limiter and the AAC encode move the integrated value by a few hundredths, so a
  gain to the very edge can measure just outside and cost a retry. The edge gain aims a small margin inside
  (`min(0.2, tolerance / 2)` LU).
- The limiter lowers a dense mix a little when it works hard; inside the window that is not a miss.
