---
change_id: marketing-kit-segment-captions-1077
status: in_progress
---

# Plan: per-EDL-segment caption box (issue #1077)

Input: change.md, research.md. Complexity: medium (EDL format, render, draft, validation, diff).

## Phase 1: EDL field, validation, diff (TDD)

Files: `footage/edl.ts`, `footage/edl.test.ts`, `footage/pipeline.ts` (`readEdlFile` passes the frame).

- `EdlCaption { bottom?: number; top?: number }`, `EdlSegment.caption?`; schema: strict object, both optional, each
  `min(0)`, described; JSON Schema follows from the zod schema.
- `validateEdl(edl, clips, filmId, captionBounds?)`: with `{ frameHeight, minCardHeight }` refuses `top`/`bottom` past
  `frameHeight - minCardHeight`; an empty `caption: {}` is allowed (no move).
- `diffEdl`: `s4 captions moved` (or `s4 captions back to the film's box`) when the field differs.

## Phase 2: chunk layouts, render, draft (TDD)

Files: `footage/captions.ts`, `footage/compose.ts`, `footage/draft.ts`, tests, `index.ts`.

- `applySegmentCaption(base, caption?)`, `getSegmentCaptionLayout(film, edl, index, override?)`,
  `findSegmentAt(edl, time)`, `getCaptionChunkLayouts(chunks, edl, base)`.
- Render: chunks whose box differs get `style="top:auto;bottom:Npx"` / `style="bottom:auto;top:Npx"`.
- Draft: one extra ASS style per distinct moved box (`Caption2`, ...), its alignment and `MarginV` from the box.
- Tests: moved segment drawn at its foot and others at the film's; spanning chunk takes the starting segment's box;
  no-field output equals the output before the change (snapshot compare against the base layout path).

## Phase 3: docs

README footage EDL section, CHANGELOG `## Unreleased`.

## Decisions (auto)

- A segment's `top` alone replaces the film's `bottom` anchor (research).
- Bounds need the frame, so `validateEdl` takes an optional fourth argument; the pipeline passes it. Without it only
  the schema's non-negative rule applies (backwards compatible signature).
- Card height for the bound: one caption line plus the pill's vertical padding.

## Progress

- [ ] Phase 1: EDL field, validation, diff
- [ ] Phase 2: chunk layouts, render, draft
- [ ] Phase 3: docs
- [ ] Implementation review
