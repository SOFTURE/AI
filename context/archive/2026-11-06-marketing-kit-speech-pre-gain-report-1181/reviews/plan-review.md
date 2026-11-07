# Plan review: marketing-kit-speech-pre-gain-report-1181

Verdict: approved (auto).

- Scope matches the issue: gap 1 (reporting, log) in full; gap 2 through the issue's own first option, opt-in.
- No dynamics on speech: both modes are one linear `volume`; the float mode only changes the sample format.
- Additive types only; `getPreGainDb`, `ClipSound.gainDb` and `speechGainDb` stay, so a minor release.
- Risk: a float clip sound sent whole to the isolator in `transcribeFootage` may carry a peak above 0 dBFS; it is
  opt-in and documented. Tests use real ffmpeg locally, no external service.
