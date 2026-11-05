# Plan review: marketing-kit-speech-declick-1084

Verdict: approved.

- Every ask of #1084 maps to a phase: the stage in both chains (2), the setting with `off` running no pass (2), the
  gate and the impulse removal with the issue's parameters (1), the logged count in the ok value (2), the synthetic
  fixture tests (1).
- Departure from the issue's "one `volume=eval=frame` pass": justified, since ffmpeg evaluates the expression once per
  audio frame (~21 ms), coarser than the crossfades. The Node gain is exact and keeps the core testable without ffmpeg.
- Risk noted: the decode/encode adds a generation of lossy mp3 when the loudness pass is off; the declicked track is
  written as WAV when a loudness pass follows (the pass re-encodes it), mp3 only when it is the final file.
- Backwards compatible: a new optional setting, absent means off.
