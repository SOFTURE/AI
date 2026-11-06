# Plan review: marketing-kit-lossless-speech-1139

Verdict: approved.

- Covers the issue: lossless intermediates (1) through the extension-driven codec and the new clip sound, the pre-gain
  (2) in `prepareClipSounds`, the isolator's lossless pre-gained input on both paths (3); point 4 rides #1143, which
  reads the same speech map and file names; the three "done when" checks are Phase 2's test and Phase 3's check.
- Timing: the WAV is cut with the normalize step's own seek and length, so EDL times hold; the test compares lengths.
- Risk: WAV files are larger (24-bit stereo 48 kHz is 288 kB/s); a one-minute clip is 17 MB, fine for the build folder
  and under the providers' upload limits.
- Risk: the draft thread changes `draft.ts` in parallel; this plan does not touch it and keeps the shared signatures,
  and the extension-driven codec keeps the draft's `speech.mp3` name working until #1143 lands.
