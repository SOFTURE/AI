---
change_id: marketing-kit-footage-publish-899
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and issue #899.

- Loudness (`src/footage/loudness.ts`): two passes, the measurement parsed from loudnorm's JSON with zod, silence
  (`-inf`) copied as it is instead of failing, the second pass linear and resampled to 48 kHz. The speech track is
  written as `speech.raw.mp3` and normalized into `speech.mp3`, which the composition plays; the music track is
  built separately and mixed under it by hyperframes.
- Final pass (`src/footage/publish.ts`, `finishFootage` in `pipeline.ts`): hyperframes renders into the build folder,
  each stream is copied or re-encoded by what ffprobe reports, `+faststart` always; the result is probed again and
  `moov` before `mdat` read from the box headers. A mismatch is a returned error, the partial output is removed on
  abort by `runFfmpeg`, and `render.mp4` is removed after the pass.
- Cover: `film.cover.at` or the middle of the first talking segment (first segment otherwise), clamped inside the
  film and logged when clamped; null writes none.
- `RenderedFootage` gains `bytes`, `width`, `height`, `durationSeconds`, `cover`; `FootageFilm` only gains optional
  fields; `marketing.json` takes `false` to turn either off, the schema file regenerated.
- Tests: unit tests for every builder and parser (no ffmpeg needed, except a synthetic MP4 box file), config
  defaults and refusals, and the fixture renders assert the codecs, fast start, cover, facts, `finish` progress and
  the speech track at −14 LUFS ±1.
- Gates: typecheck, lint (ESLint + language), the marketing-kit tests pass locally.

Verdict: approved.
