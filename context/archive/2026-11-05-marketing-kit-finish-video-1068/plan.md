---
change_id: marketing-kit-finish-video-1068
status: in_progress
---

# Plan: finishVideo (issue #1068)

Input: change.md, research.md. Complexity: small (one pure function, one option, docs).

## Phase 1: arguments and validation (TDD)

Files: `tools/marketing-kit/src/footage/publish.ts`, `publish.test.ts`.

- `FinishVideo { preset: X264Preset; crf: number; maxBitrate?: string }`.
- `findFinishVideoProblems(video): string[]`: preset in `X264_PRESETS`, `crf` whole 0..51, `maxBitrate` a positive
  number with an optional `k`/`M` suffix.
- `buildFinishArgs(..., { audioFilter, video })`: with `video` the picture is always re-encoded High yuv420p at its
  preset and CRF, `-maxrate <m> -bufsize <2m>` when capped; without it today's arguments.
- Tests: exact arguments with and without the cap, a publishable picture re-encoded when asked, each invalid value.

## Phase 2: the pipeline

Files: `pipeline.ts`, `index.ts`, `finish.test.ts`.

- `RenderFootageOptions.finishVideo`; `runRenderFootage` returns `err` on invalid values before the disk check;
  `finishFootage` passes it on; the `finish:` log line names what was copied and re-encoded
  (`picture re-encoded (veryfast CRF 20), sound copied`).
- Export `FinishVideo`, `findFinishVideoProblems`.
- ffmpeg test: an `ultrafast` render with `finishVideo` ends H.264 High yuv420p, fast start.

## Phase 3: docs

CHANGELOG `## Unreleased`; README "Encoder speed": the option, the issue's measure.

## Decisions (auto)

- Validation returns a sentence before anything runs (no paid step wasted), unlike `crf`'s late throw.
- `bufsize` is twice `maxBitrate`; no separate option (the issue asks for `maxBitrate` only).
- With `finishVideo` the picture is re-encoded whatever the render is; that is what the app asks for.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: arguments and validation
- [ ] Phase 2: the pipeline
- [ ] Phase 3: CHANGELOG and README
- [ ] Implementation review
