---
change_id: marketing-kit-footage-publish-899
status: done
---

# Research: publishable footage output (issue #899)

Read on master 01cf45f.

- `renderFootage` (`src/footage/pipeline.ts`) builds `assets/speech.mp3` (`buildSpeechArgs`), the ducked music, the
  end card's backdrop, then runs `hyperframes render -o <output>` and returns `{ kind, output, seconds, edlPath }`.
  hyperframes mixes the audio tracks itself, so the speech track's level is what ends up in the film.
- No `loudnorm` in `src/`. `-movflags +faststart` only in `normalize.ts` (normalized clips).
- `runFfmpeg` (`process.ts`) keeps stderr only for its error message; a `loudnorm` measurement needs stderr, so the
  first pass runs through `runProcess`, which collects stderr when no line callback is given.
- `probe.ts` reads duration, picture and HDR but not the profile, the audio rate or the channels.
- ffmpeg's `loudnorm` two-pass: pass 1 `loudnorm=I:TP:LRA:print_format=json` prints `input_i`, `input_tp`,
  `input_lra`, `input_thresh`, `target_offset`; pass 2 feeds them as `measured_*` and `offset` with `linear=true`.
  Its output runs at 192 kHz, so a resample to 48 kHz follows. Silence measures `-inf`: nothing to normalize.
- Fast start: `moov` before `mdat` among the MP4's top-level boxes; readable without ffprobe from the box headers.
- `getSegmentStarts(edl)` (`edl.ts`) gives each segment's film time; the EDL's segments name clips, whose role tells
  a talking segment.
- The fixture render tests (`tests/render.test.ts`, `MARKETING_KIT_RENDER=1`) run in CI's render job and in the
  worker image job; they are where the real pass is checked.
