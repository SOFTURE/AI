---
change_id: marketing-kit-segment-captions-1077
title: "marketing-kit: per-EDL-segment caption box (issue #1077)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1077]
branch: claude/project-thread-ej7l76
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1077](https://github.com/SOFTURE/AI/issues/1077): an EDL segment can move the caption box for its own
captions (`EdlSegment.caption: { bottom?, top? }`, px of the film frame), merged over the film's caption layout. A
chunk that spans a cut takes the box of the segment where its first word starts. Render and draft draw the same box.
`validateEdl` refuses a box that leaves the frame, `diffEdl` names the move, and an exported helper tells which box
each chunk is drawn in.

## Context

Owns the caption parts of `tools/marketing-kit` (footage/edl.ts, captions.ts, draft.ts, compose.ts, pipeline.ts
caption wiring, index.ts exports). A parallel change (#1079, audio) touches pipeline.ts, index.ts and CHANGELOG in
the same package; whoever merges second resolves the conflict.

## Constraints

- An EDL without the field renders byte-identically (composition HTML and ASS file unchanged).
- No version bump: CHANGELOG `## Unreleased`; the coordinator releases once for the batch.

## Notes

- Framing: skipped. The issue names the field, the rules and the done criteria.

## Done

`EdlSegment.caption { bottom?, top? }` moves the caption box per segment in the render and the draft; validation,
diff, JSON Schema and helpers (`getSegmentCaptionLayout`, `getCaptionChunkLayouts`) follow. Rides the next combined
marketing-kit release (CHANGELOG `## Unreleased`).
