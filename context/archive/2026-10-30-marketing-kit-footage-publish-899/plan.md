---
change_id: marketing-kit-footage-publish-899
status: archived
---

# Plan: publishable footage output (issue #899)

Input: change.md, research.md. Complexity: medium (two new modules, the render step's tail, config, docs).

## Phase 1: loudness

Files: `src/footage/loudness.ts` (new) and its test, `film.ts`, `pipeline.ts`.

- `FootageFilm.loudness?: { target, truePeak } | null` (absent: −14 LUFS, −1 dBTP; null: off).
- `buildLoudnessMeasureArgs`, `readLoudnessMeasurement(stderr)`, `buildLoudnessArgs(input, measured, target, output)`
  (pure); `normalizeLoudness(input, output, target, { signal })` runs both passes, copies the track when it is silent.
- The speech track goes to `assets/speech.raw.mp3` and is normalized into `assets/speech.mp3`.

## Phase 2: final pass, facts, cover

Files: `src/footage/publish.ts` (new) and its test, `pipeline.ts`, `providers.ts`.

- hyperframes renders to `<buildDir>/render.mp4`; `readFilmFacts(ffprobe json)` reads codecs, profile, pixel
  format, audio rate and channels, picture and duration; `buildFinishArgs(input, facts, output)` copies each stream
  that already matches and re-encodes the other (libx264 High yuv420p CRF 18 / AAC 48 kHz stereo 192 kb/s), always
  with `+faststart`; `isFastStart(file)` reads the top-level boxes.
- `finishFilm` runs the pass and checks the result (ffprobe facts plus `moov` before `mdat`); a mismatch is an error.
- `FootageFilm.cover?: { at?: number } | null` (absent: on, at the middle of the first talking segment, or the first
  segment); `buildCoverArgs` writes `<output>.jpg` from the finished film.
- `RenderedFootage` gains `bytes`, `width`, `height`, `durationSeconds`, `cover` (path or null).
- A `finish` progress stage.

## Phase 3: config, CLI, docs

- `marketing.json` `footage[]`: `loudness: { target, truePeak } | false`, `cover: { at } | false`; the schema file
  regenerated; `config.ts` maps them; the CLI prints the cover and the file's facts.
- README (footage section), CHANGELOG `## Unreleased`; fixture render tests assert H.264 High, AAC 48 kHz stereo,
  fast start, the cover, the facts.

## Decisions (auto)

- In TypeScript an absent `loudness` / `cover` means the default and `null` turns it off (the film's other optional
  parts use null); in `marketing.json` `false` turns it off, as the issue writes it.
- Loudness range target 11 LU (ffmpeg's default) and `linear=true`; the music is not normalized, it is mixed under
  the normalized speech at its ducked volume.
- A film without sound keeps none: the final pass adds no silent track.
- A cover time past the film's end is clamped to its last frame and logged.
- No version bump: the batched marketing-kit release follows #898.

## Progress

- [x] Phase 1: loudness
- [x] Phase 2: final pass, facts, cover
- [x] Phase 3: config, CLI, docs
- [x] Implementation review
