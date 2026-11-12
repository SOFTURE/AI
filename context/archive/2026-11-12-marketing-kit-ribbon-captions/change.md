---
change_id: marketing-kit-ribbon-captions
title: "marketing-kit: ribbon captions, each line on its own strip, the block slightly tilted"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-ribbon-captions
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app's owner wants a third caption look beside the plain phrase and the highlight pill: bold capitals,
each line on its own flat strip of the caption background, the whole block turned a few degrees, as many to-camera
reels set a line over the middle of the frame. The draft (libass) and the render (composition) draw it alike.

## Context

Captions are cut in `captions.ts` (`getFootageCaptionChunks`), drawn by the render in `compose.ts` (`.pill`,
`.phrase`) and by the draft in `draft.ts` (`buildFootageDraftCaptions`). The style list is `CAPTION_STYLES` in
`film.ts`, read by the config schema and `config.ts`.

## Constraints

- An EDL or film without the new style renders exactly as before (same HTML, same ASS).
- No overshoot, nothing made from third-party frames: the strip is a flat box drawn in code.
- Unit tests for the schema, chunks, the render markup and the draft events; libass frames of the draft.

## Notes

- Frame skipped: the adopting app's roadmap item settles the outcome; the look is a caption style like the others.
