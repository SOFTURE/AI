---
change_id: marketing-kit-ffmpeg-failure-1063
---

# Research

## Where ffmpeg runs

Every footage ffmpeg run goes through `runFfmpeg(step, args, options)` in `tools/marketing-kit/src/footage/process.ts`
(normalize, tone map LUT, loudness, audio extraction, cut frames, cut preview, speech and music tracks, picture pieces
and join, final pass, cover, the draft). It keeps only non-empty stderr lines and throws with the last five. The args
are built deep in helpers (`normalizeFootage`, `buildPicture`, `chooseCutTransitions`, `normalizeLoudness`,
`ensureToneMapLut`) that take only `signal` and `onSeconds`.

## Options

1. Thread `onFfmpegFailure` through every helper's options down to `runFfmpeg`: about ten signatures change, and a
   new helper that forgets it silently drops failures.
2. An `AsyncLocalStorage` set by each entry point, read by `runFfmpeg`: no helper signature changes, every nested
   step (also ones added later) is covered. `runFfmpeg` also takes `onFailure` directly for a direct caller.

Option 2 is recommended.

## ffmpeg facts (checked on 6.1.1 in the container)

- The filter graph parser skips whitespace and newlines between chains, so a graph file with one chain per line
  parses as the inline graph.
- `-filter_complex_script <file>` works up to 7.x (deprecated in 7.1); 7.1 adds `-/filter_complex <file>`. The
  script picks the option by `ffmpeg -version`.
- Inputs can be `lavfi` sources (`-f lavfi -i anullsrc=...` in normalize): not files, so not resolved or probed.
- The runs use `-v error`, so stderr is short; it is kept whole up to the last 2000 lines.
