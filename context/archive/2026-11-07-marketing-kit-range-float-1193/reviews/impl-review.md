---
change_id: marketing-kit-range-float-1193
verdict: approved
---

# Implementation review (auto)

- `buildRangeAudioArgs` cuts a `.wav` range as `pcm_f32le` with `peaks: "float"` and `pcm_s24le` otherwise;
  `isolateSpeechRanges` passes `speechPeaks`. The default path's arguments are unchanged.
- The issue's acceptance: an ffmpeg test cuts 2-5 s of a stereo float tone at 1.8 and the float range keeps its
  peak above 1.79 with two channels; the 24-bit cut is shown clamped at 1.0. `isolateSpeechRanges` hands the
  provider `pcm_f32le` ranges with `speechPeaks: "float"` and `pcm_s24le` without.
- Found while testing: ffmpeg's `-ac 2` upmix of a mono source lowers it by 3 dB; the kit's ranges never change the
  channel count, so neither upmix nor downmix normalization applies to them.
- Evidence: `npx vitest run tools/marketing-kit tests/repo` (1944 passed, 0 failed after installing ssh-keygen for
  the deploy workflow test); `npm run typecheck`; ESLint on the changed files; `npm run lint:language`.
- Approved.
