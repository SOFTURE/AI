# Research: declick stage in the footage speech chain (issue #1084)

## What exists

- `runRenderFootage` (`footage/pipeline.ts`) builds the assets as a list of tracks: `speech` (`buildSpeechArgs`, to
  `speech.raw.mp3` when a loudness target is set, else straight to `speech.mp3`), then `loudness`
  (`normalizeLoudness`), then the ducked music. The words in film time come from `remapWords(edl, transcript.words,
  film.cut.fillers)`, the same list `duckingKeyframes` reads.
- `runRenderFootageDraft` (`footage/draft.ts`) writes `draft/speech.mp3` with the same `buildSpeechArgs` and no
  loudness pass, then hands the file to `buildFootageDraftArgs`.
- `volumeExpression` drives `volume=eval=frame`; ffmpeg evaluates it once per audio frame (about 1024 samples, 21 ms
  at 48 kHz), too coarse for the 5-8 ms crossfades around a 2-6 ms click, and an expression with hundreds of impulses
  would be long and slow per frame.
- `runProcess` collects stdout as text, so PCM cannot be piped back; `runFfmpeg` writes files with progress.
- Real ffmpeg runs in the footage tests (draft, picture, normalize), so a fixture can go through the real stage.

## Options

1. Gain in ffmpeg: keyframes and `volume=eval=frame` (as the issue suggests), with `asetnsamples` to shrink frames.
2. Gain in Node: decode the cut speech to raw float PCM (one ffmpeg run), analyse and apply the gain per sample in
   Node, encode back (one ffmpeg run).

Recommendation: option 2. It is sample-accurate, the analysis needs the PCM in Node anyway, and the core (detection,
gate, gain) becomes pure functions over a `Float32Array` tested without ffmpeg. Memory: a 3-minute stereo track is
about 70 MB of float32, fine for the kit's films.

## Risks

- A track with no words: nothing tells speech from pauses, so the gate is skipped (impulses still removed).
- b-roll sound kept under no words is gated like a pause; documented.
- Thresholds are the issue's starting point; tuning on a real recording may follow.
