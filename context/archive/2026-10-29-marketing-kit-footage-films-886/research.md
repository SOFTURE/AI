---
change_id: marketing-kit-footage-films-886
---

# Research: footage films (issue #886)

## What exists in the kit

- `src/compose/compose.ts` builds one HyperFrames 0.8.85 composition for the screen film: clips with
  `data-start`/`data-duration`/`data-media-start`, `<audio>` elements with `data-volume`, one paused GSAP timeline in
  `window.__timelines`. The same `<video>` source may appear in several clips with different media starts (the
  screen film does it for the backdrop and the phone screen). Audio is placed only by `data-start`, `data-duration`
  and a constant `data-volume`; nothing in the contract animates an audio element's volume.
- `captionChunks(words)` (timeline.ts) groups timed words into caption pills; the GSAP word highlight lives inline in
  `composeFilm`. `LAYOUTS[format].caption` and `.endCard` give the caption and end card boxes per format.
- `src/render/render.ts` runs ffmpeg through `spawnSync` and hyperframes through `runHyperframes`; `preflight.ts`
  checks ffmpeg and hyperframes before slow work.
- Paid steps: `TtsProvider` (`estimate` free, `synthesize` paid), `produceVoiceover` logs the estimate and calls the
  provider only with `isCommit`; results are `{ ok, value } | { ok, error }`; the cache is content-keyed
  (`voiceoverKey`) under `voice.cacheDir/<video>/`, committed by the project. `--placeholder` writes into the build
  folder, never into the cache, and renders `<video>.placeholder.mp4`.
- `marketing.json`: `videos` entries are screen films only (path, persona, beats, hook, screen guard are required);
  `social.posts` refers to them by id; output goes to `<output.dir>/<id>/`.
- CI: the `test` job has no ffmpeg; the `render` job installs static ffmpeg 6.0 (johnvansickle build via
  ffmpeg-static b6.0: libx264, libx265, libmp3lame, libzimg) and runs `tests/render.test.ts` with
  `MARKETING_KIT_RENDER=1`.

## ElevenLabs endpoints (API reference, checked 2026-10-29)

- Speech to text: `POST /v1/speech-to-text`, multipart: `model_id` (`scribe_v2` in the examples), `file`,
  `language_code` (ISO 639-1/3), `timestamps_granularity=word`, `tag_audio_events`. Response: `language_code`,
  `text`, `words[]` with `text`, `start`, `end`, `type` (`word` | `spacing` | `audio_event`).
- Voice isolator: `POST /v1/audio-isolation`, multipart `audio` file; the response is the audio file.
- Music: `POST /v1/music`, JSON `prompt`, `music_length_ms` (3000-600000), `model_id` (default `music_v1`),
  `force_instrumental`; query `output_format` (default mp3); the response is the audio file.
- Video to music: `POST /v1/music/video-to-music`, multipart `videos` (up to 10 files, 200 MB, 600 s),
  `description` (up to 4100 characters), `tags` (up to 10); query `output_format`; the response is the audio file.
- The reference pages give no prices; billing is by audio length (STT, isolation) or generated length (music).

## ffmpeg facts (local 6.1.1 and the CI's static 6.0)

- ffprobe `-show_streams -show_format -of json`: `color_transfer` `smpte2084` (PQ) or `arib-std-b67` (HLG) marks
  HDR; Dolby Vision adds a `DOVI configuration record` side data entry (iPhone: profile 8.4 on an HLG base layer).
  Rotation is the `displaymatrix` side data's `rotation` (newer) or the `rotate` tag (older muxers).
- Decoding applies the display matrix by default (`-autorotate`), so a normalized clip is upright.
- Tone mapping without GPU: `zscale` (libzimg) to linear light, `tonemap=hable`, `zscale` back to BT.709; both
  builds have `zscale` and `tonemap`.
- `-display_rotation` (6.0+) writes a rotation into a generated test clip; colour tags (`-color_trc smpte2084`,
  `-color_primaries bt2020`) make an HDR-tagged sample without a real HDR camera.
- The `volume` filter evaluates an expression per frame (`eval=frame`, variable `t`), which carries ducking keyframes
  as a sum of linear pieces without nesting.

## Options

1. Footage films in `videos` with a `kind` discriminant. The screen film's required fields (path, persona, beats,
   hook, screen guard) would all become conditional, and `VideoConfig`, `findVideo`, `loadFilm` and every command
   that takes a video would branch. Rejected: high churn for the screen film, which must stay as it is.
2. A top-level `footage` array beside `videos`, ids unique across both (one output folder per id), `social.posts`
   may name either; `videos` may be empty when `footage` has an entry. Chosen.
3. Music ducking as GSAP tweens of the `<audio>` volume: the hyperframes contract has no animated volume. Rejected;
   the keyframes are computed by a pure function and applied by ffmpeg to the music file before the composition
   (the composition plays a pre-ducked track).
4. Speech as one `<audio>` per EDL segment vs one pre-cut speech track: a pre-cut track (ffmpeg `atrim` + `concat`
   with 20 ms fades at each cut) keeps the composition simple and click-free. Chosen.
