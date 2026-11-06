# Research: isolateSpeechRanges resilience (issue #1127)

## Where the code is

- `tools/marketing-kit/src/footage/isolate-ranges.ts`: `runIsolateSpeechRanges` buys uncached ranges in a loop and
  returns `err(...)` on the first `!cleaned.ok`; ranges already written to the cache are charged but not laid.
- `tools/marketing-kit/src/footage/speech-ranges.ts`: `getSpeechRangeWindows` (overlapping neighbours switch at the
  middle of their overlap) and `buildRangeLayArgs` (base muted with `volume=0:enable=between(...)`, each window
  `atrim` + `adelay` in milliseconds, `amix normalize=0`). The switch is a hard step.
- `paid.ts`: `estimateSpeechRanges` / `estimateFootageFilm` read the same cache through `getSpeechRangeCache`.

## Findings

- A window's edge is either its range's own edge (the range has no sound outside it: a fade must lie inside) or a
  switch with an overlapping neighbour (both ranges have sound around the switch: the fade can be centred on it).
- `afade` (default curve `tri`) is linear in samples; `aeval` evaluates per sample with `t`, so the base can be
  multiplied by `1 - sum(window gains)` with the same piecewise linear gains. `adelay` takes a delay in samples
  (`<n>S`), exact at 48 kHz for whole milliseconds.
- An MP3 round trip high-passes a constant level, so the step check runs the filter graph on PCM inputs and output.
- Providers answer `TtsResult` (no error kinds), so every refusal is retried alike.
