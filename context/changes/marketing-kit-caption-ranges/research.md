# Research: marketing-kit-caption-ranges

- Both outputs place caption chunks through `getCaptionChunkLayouts` (`compose.ts:224` render, `draft.ts:332` draft):
  a chunk takes the box of the segment its first word starts in (`applySegmentCaption`). One change there covers both.
- Overlays keep clear of the captions through `getCaptionBand(input, segment)` (`overlays.ts`), the box of the
  overlay's start segment. A caption box that changes during an overlay is today only possible at a segment cut, and
  `findShotBreak` stops non-hook overlays there; a range edge can fall inside a segment, so the band must cover every
  box on screen during the overlay (the union).
- `validateEdl` checks segment caption boxes against `EdlCaptionBounds`; ranges need the same check plus order,
  overlap and the cut's end. `diffEdl` names caption moves per segment; ranges need one line.
- `schema/edl.schema.json` is generated (`npm run schema`); the repository test compares it.
- Version: 0.27.0 is on npm (latest); this takes the next free minor at release time (0.28.0 unless taken).
