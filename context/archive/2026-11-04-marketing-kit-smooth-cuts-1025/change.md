---
change_id: marketing-kit-smooth-cuts-1025
title: "marketing-kit: footage cuts that do not jump on handheld footage (issue #1025)"
status: archived
roadmap_item: null
issue: 1025
branch: claude/project-thread-5v784j
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1025](https://github.com/SOFTURE/AI/issues/1025). Cuts in handheld footage read as "the screen jumps":
a `zoom` cut is a hard scale step and a plain jump cut shows the camera move. After this change:

1. `edit.zoomEaseFrames` eases a `zoom` cut into its scale over N frames, the same in `composeFootage` and the draft;
   `zoomPercent` allows up to 112;
2. `edit.cutAudioFadeMs` sets the speech track's fade at every cut, and `edit.cutAudioCrossfade` turns the dip into a
   true crossfade centred on the cut, without moving the speech against the picture;
3. `transitions.jump: "auto"` measures how different the frames on both sides of each jump cut are and gives a small
   difference a `zoom`, a large one a `fade`, with the measures returned and logged;
4. defaults unchanged: hard cuts, 20 ms dips.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{film,compose,draft,render,
pipeline,edl}.ts`, a new `src/footage/cuts.ts`, `src/config/{schema,config}.ts`, `src/cli/footage.ts`, tests, README,
CHANGELOG. #1026 changes captions in the same package in parallel (other files).

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed. No paid provider in the auto choice.

## Notes

- Framing: skipped. The issue measures the problem and names the options to add.
