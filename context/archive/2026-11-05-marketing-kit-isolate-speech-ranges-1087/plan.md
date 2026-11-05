---
change_id: marketing-kit-isolate-speech-ranges-1087
status: archived
---

# Plan: isolate a footage film's voice per time range (issue #1087)

Input: change.md, research.md. Complexity: medium (one new module, small edits in shared files).

## Phase 1: planning (pure)

Files: `src/footage/isolate-ranges.ts` (new), `src/footage/isolate-ranges.test.ts` (new).

- `planSpeechRanges(edl, clips: { id, role, duration }[], { margin? })`: per talking clip, the ranges the cut hears
  (each segment's sound span, and the picture clip's own span when `audio.ownVolume > 0`) widened by `margin`
  (default `DEFAULT_SPEECH_RANGE_MARGIN` 0.25 s), clamped to the clip, rounded out to whole milliseconds,
  deduplicated, ranges inside another dropped, sorted.
- `getSpeechRangeWindows(ranges)`: where each range is laid; overlapping neighbours switch at the middle of their
  overlap.
- `getSpeechRangeCache(film, clipKey, range, options)`: `footageCacheKey("isolated", { clip, range: [startMs,
  endMs], provider })` under `<cacheDir>/<film>/`.
- `buildRangeAudioArgs` (cut a range from the clip's sound) and `buildRangeLayArgs` (mute each window in the clip's
  sound, `adelay` each cleaned window into place, mono answers panned to both channels, `amix normalize=0`).

## Phase 2: the block and the estimate

Files: `src/footage/isolate-ranges.ts`, `src/footage/paid.ts`, `src/footage/providers.ts`, `src/index.ts`.

- `isolateSpeechRanges(film, clips, edl, { buildDir, cacheDir, providers, isCommit, margin?, log?, onCharge?,
  onProgress?, signal?, onFfmpegFailure? })` answers `{ speech, ranges }`: every clip in `speech` (its laid file, or
  the normalized clip when no window of it is laid), each range with its cache key, path, `cached` and `laid`.
  With `isCommit` uncached ranges are bought (charge step `isolate`, item = clip id, `range` on the charge);
  without it only cached ranges are laid.
- `FootageCharge.range?: { start, end }` (seconds) for a range charge.
- `estimateFootageFilm` takes `isolate: "clips" | "segments"` and `margin`; `"segments"` prices the cut's ranges
  (one `isolate` item per range, with `range`) and needs the cut. `estimateSpeechRanges(film, options)` answers only
  those items.

## Phase 3: docs

- README "Isolating only the cut's voice", CHANGELOG `## Unreleased`.

## Decisions (auto)

- Ranges are not merged across segments: merging would change a range's key whenever a neighbour moves, and the
  issue asks that a changed cut pays only its new ranges. Identical and contained ranges are dropped.
- The base under the windows is the clip's own sound, whatever `film.isolateVoice` says; the block is meant for
  films that transcribe the raw voice.
- Default margin 0.25 s: covers the half cut fade of a cross-fade and a short declick tail at a few percent of cost.
- Only talking clips are isolated, as in the whole-clip path.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
