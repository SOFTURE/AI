---
change_id: marketing-kit-footage-draft-1018
title: "marketing-kit: a fast ffmpeg draft of a footage film with its captions and transitions (issue #1018)"
status: planned
roadmap_item: null
issue: 1018
branch: claude/project-thread-vbzl1a
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1018](https://github.com/SOFTURE/AI/issues/1018): an adopting app shows the owner a free draft of a
footage film before the paid render, but the only cheap draft is the cut preview plus the speech track (hard cuts, no
captions, no transitions), and the only way to see captions and transitions is the hyperframes render (minutes on a
small worker). Add an ffmpeg-only draft builder that burns in the film's phrase captions, draws the zoom cuts, the
fades and the Ken Burns b-roll, muxes the speech track and writes a fast-start H.264/AAC MP4 at a small width.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Open pull requests touch the same package: #1016 (key terms), #1017
(render disk check), #1019 (normalize and cut preview speed, issue #1015). This change adds a new module and touches
shared files (`index.ts`, `tools.ts`, `pipeline.ts`, README, CHANGELOG) only at small, separate spots. One batched
marketing-kit release follows (coordinator), so no version bump here.

## Constraints

- No hyperframes, no browser: ffmpeg only.
- Unit tests pin the argument builders without ffmpeg; one test renders a real draft when ffmpeg with libass is there.
- Storing and showing the draft are the app's.
- The full render path stays as it is.

## Notes

- Framing: skipped. The issue names the problem, the measurements and each part of the draft.
