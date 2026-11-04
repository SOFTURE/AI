---
change_id: marketing-kit-smooth-cuts-1025
---

# Research: smooth cuts on handheld footage (issue #1025)

## Current code

- `getSegmentScales` (`compose.ts`) gives each segment one scale: a `zoom` cut alternates 1 / `zoomPercent`.
  `composeFootage` writes it as a static `transform:scale()`; `planFootageDraft` crops by it. No easing anywhere.
- `buildSpeechArgs` (`render.ts`) trims every segment's sound span and fades it in and out over
  `CUT_FADE_SECONDS = 0.02`, then `concat`s: a 40 ms dip to silence around each cut. The render and the draft share it.
- `buildEdl` (`edl.ts`) is pure and sync; `cutFootage` (`pipeline.ts`, sync, public) builds and writes the EDL; the
  CLI and `renderFootageFilm` call it. A hand-edited EDL is read back by `readEdlFile` and never re-cut.
- `runProcess` collects stdout as UTF-8, so a frame for measuring is written by ffmpeg to a file and read back.

## ffmpeg / GSAP semantics

- `zoompan` evaluates `z` per output frame (`on`); a crop at the zoom origin is what the draft already uses for Ken
  Burns. An ease-out quad `1-(1-t)^2` in `z` matches GSAP's `power1.out`.
- `acrossfade=d=D` overlaps the end of the first input with the start of the second and shortens the sum by D. If
  each side is lengthened by D/2 into its source (the first segment's start and the last one's end excepted), the
  joined track keeps the cut's length and every crossfade is centred on the cut. A span too close to its source's
  start is padded with silence (`adelay`), past its end with `apad`.
- Frame difference: both frames scaled to a small gray thumbnail (`scale=36:64,format=gray`, `-f rawvideo`), the mean
  absolute difference of the bytes / 255 (0-1). Deterministic, cheap, no provider. Downscaling hides shake noise and
  keeps a camera move (the whole frame shifts) visible.

## Options

1. Auto choice as a separate async step (`chooseCutTransitions`) over the EDL that `buildEdl` wrote with plain cuts
   at the auto jump cuts, run by a new async `cutFootageFilm` that the CLI and `renderFootageFilm` use. `cutFootage`
   stays sync and unchanged in signature. Chosen: no breaking change; a hand-edited EDL keeps its transitions because
   only a fresh cut runs the choice.
2. Make `cutFootage` async. Rejected: breaks the 0.6.0 API.
3. A per-segment fade length in the EDL for the auto dissolve. Rejected: widens the EDL schema; the film's
   `fadeFrames` (set to 4-6) already gives the short dissolve.

## Decisions (auto)

- Option 1. `FootageTransitions.jump` accepts `"auto"`; `transitions.autoThreshold` (0-1, default 0.08) splits zoom
  from fade. Cuts between clips keep `transitions.clip`.
- `edit.zoomEaseFrames` (0-15, default 0) eases both the punch-in and the punch-out (from the scale on screen before
  the cut); a `kenburns` segment keeps its own slow zoom and is not eased.
- `edit.cutAudioFadeMs` (10-100, default 20) and `edit.cutAudioCrossfade` (default false): the length applies to both
  the dip and the crossfade, so the default track stays byte-for-byte the same.
- Measures (segment id, difference, chosen transition) are returned by `chooseCutTransitions`/`cutFootageFilm` and
  logged by the CLI, so an app or an agent can see why.
