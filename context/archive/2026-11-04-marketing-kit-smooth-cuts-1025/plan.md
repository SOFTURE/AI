---
change_id: marketing-kit-smooth-cuts-1025
status: done
---

# Plan: smooth cuts on handheld footage (issue #1025)

Input: change.md, research.md (option 1). Complexity: medium.

## Phase 1: eased punch-in (TDD)

Files: `film.ts`, `compose.ts`, `draft.ts`, `config/schema.ts`, `config/config.ts`, tests.

- `FootageEdit.zoomEaseFrames` (default 0); schema `edit.zoomEaseFrames` 0-15, `zoomPercent` max 112.
- `composeFootage`: a `zoom` segment (index > 0, not `kenburns`) with ease > 0 gets
  `tl.fromTo("#segN", { scale: <before> }, { scale: <after>, duration: F/30, ease: "power1.out", immediateRender: false }, start)`.
- `planFootageDraft`: `startScale` and `easeFrames` per segment; `buildPictureFilters` draws an eased segment with
  `zoompan` `z = to - (to-from)*pow(1-min(on/F,1),2)`. The ease is clamped to the segment's frames.
- Tests: the tween and the draft filter for `zoomEaseFrames: 4`; no change without it; the schema takes 112.

## Phase 2: cut audio fade and crossfade (TDD)

Files: `render.ts`, `pipeline.ts`, `draft.ts`, `film.ts`, schema, config, tests.

- `buildSpeechArgs(edl, sources, output, { fadeSeconds?, isCrossfade? })`; the render and the draft pass the film's
  edit. Default output identical to today.
- Crossfade: each side lengthened by D/2 into its source (padded with `adelay`/`apad` where the source ends), chained
  `acrossfade=d=D:c1=tri:c2=tri`, a fade in at the start and out at the end of the track.
- Tests: 40 ms at every cut; the crossfade graph; real ffmpeg keeps the track's length.

## Phase 3: transition chosen from the frames (TDD)

Files: new `src/footage/cuts.ts`, `edl.ts`, `pipeline.ts`, `cli/footage.ts`, `index.ts`, schema, config, tests.

- `measureFrameDifference(a, b)` and `chooseCutTransition(difference, threshold)` (pure); `buildCutFrameArgs`;
  `chooseCutTransitions(edl, clips, { threshold, workDir, signal })` measures the jump cuts and sets `zoom`/`fade`.
- `buildEdl` writes `cut` at auto jump cuts; `cutFootageFilm` (async) builds, chooses when `jump` is `auto`, writes and
  returns `{ edl, cuts }`; the CLI and `renderFootageFilm` use it.
- Tests: synthetic frame pairs (similar → zoom, different → fade); real ffmpeg on two lavfi clips.

## Phase 4: docs

README (edit options, auto transitions, the speech crossfade), CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: eased punch-in (bdb7f9f)
- [x] Phase 2: cut audio fade and crossfade (7eaf169)
- [x] Phase 3: transition chosen from the frames (6bf01f3)
- [x] Phase 4: docs (849212a)

## Verification

- `vitest run tools/marketing-kit`: 63 files, all green (the regenerated `schema/marketing.schema.json` included).
- Real ffmpeg: the draft test renders an eased zoom cut and a cross-faded speech track; a cross-faded track of three
  segments (one starting 10 ms into its source) written as WAV is exactly 3.49 s, the cut's length; the auto choice
  on a clip that changes its picture at 2 s measured 0 for the cut inside the first shot (`zoom`) and 0.338 across
  the change (`fade`).
- typecheck, ESLint and the language gate green in the pre-commit hook.
