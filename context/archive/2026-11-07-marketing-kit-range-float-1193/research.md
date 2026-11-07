---
change_id: marketing-kit-range-float-1193
---

# Research

- `tools/marketing-kit/src/footage/speech-ranges.ts` `buildRangeAudioArgs`: `.wav` output always `-c:a pcm_s24le`
  (#1139); other extensions follow `getAudioCodecArgs`.
- `isolate-ranges.ts` cuts each bought range from `prepareClipSounds`' file, which is `pcm_f32le` with
  `peaks: "float"` (#1181) and `pcm_s24le` otherwise (`clip-sound.ts`).
- The range cut keeps the clip sound's two channels (no `-ac`), so the issue's note on ffmpeg's stereo-to-mono
  rematrix normalization does not apply to the kit: a float range has the same level as a 24-bit one, only the
  peaks above full scale differ.
- Checked with ffmpeg 7: a stereo float tone at 1.8 cut as `pcm_s24le` peaks at 1.0; as `pcm_f32le` at 1.8.
- The cache key of a range does not include the codec; cached ranges stay valid (same level, same laying).
