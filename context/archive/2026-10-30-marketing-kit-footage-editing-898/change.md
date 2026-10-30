---
change_id: marketing-kit-footage-editing-898
title: "marketing-kit: natural editing for footage films (issue #898)"
status: archived
roadmap_item: null
issue: 898
branch: claude/project-thread-22trpl
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

Close [issue #898](https://github.com/SOFTURE/AI/issues/898): make a footage film read as an ordinary, well-edited
phone video and give an agent the means to edit it. Sentences with stable ids and retake suggestions, quiet
defaults (hard cuts, no Ken Burns, no end-card whoosh, a sized zoom, a fade in frames), a plain `phrase` caption
style, EDL v2 (segment ids, sound from another clip or span for J/L-cuts and b-roll over speech, a JSON Schema,
`validateEdl`, `diffEdl`), `extractFrames`, caption safe-zone presets and a glyph check of the caption fonts.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Follows #897 and #899 (same files); the batched marketing-kit release
comes after this change.

## Constraints

- The kit holds no language model: retakes are suggestions, never applied silently.
- A v1 EDL file (hand-edited in a build folder) still reads: it is upgraded with generated ids.
- The paid video-music cache key must not change for an EDL that uses no v2 field.
- Unit tests need no ffmpeg.

## Notes

- Framing: skipped. The issue names each gap and its fix.
