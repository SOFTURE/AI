# Implementation review: marketing-kit-speech-declick-1084

Verdict: approved.

- Every ask of #1084 is covered: the stage between the cut speech and the loudness pass in `renderFootage` and
  `renderFootageDraft`; `speech.declick` (`off` | `gentle` | `strong`, absent: off) on `FootageFilm` and in
  `marketing.json`; the gate (word ± 40 ms, merged, 20 ms fade outside the window); impulse removal (2-8 kHz band, 2 ms
  frames, 1 ms hop, ±100 ms running median, under 30 ms, never inside a word, -30 dB with a 5/8 ms crossfade clamped to
  the neighbouring words); the count in the log and in the ok value (`declick`).
- `off` adds no step and no file: `getSpeechChainFiles` keeps the old file chain (tested for all four combinations),
  and the draft test checks the step list and that no declicked file exists.
- The synthetic fixture test (10 tonal words, -55 dBFS room tone, 20 clicks of 2-6 ms at -30 to -22 dBFS) asserts,
  for both levels: pause RMS down by the gate ± 1 dB, every click found and its peak down at least 25 dB, no detection
  inside a word, every word's first 30 ms within 0.5 dB. A real ffmpeg run checks the decode/encode round trip.
- Departure from the issue, recorded in the plan: the gain is applied per sample in Node instead of a
  `volume=eval=frame` expression, which ffmpeg evaluates once per audio frame (~21 ms).
- Gates: typecheck, ESLint and the language gate green; the marketing-kit suite and the repository tests pass (the
  `deploy-workflows` suite needs `ssh-keygen`, installed in the container).
