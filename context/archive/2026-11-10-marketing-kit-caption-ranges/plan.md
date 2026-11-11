# Plan: marketing-kit-caption-ranges

## Approach

One optional EDL field, `captionRanges`, read by one new helper `getCaptionPlaceAt(edl, time, base)` that both the
chunk layouts and the overlay band use. Test-first on the pure functions.

## Decisions (auto)

- Field name `captionRanges` (not `captions`, which reads as caption text). Film seconds, `to` excluded, at most 40.
- Overlapping ranges are refused by `validateEdl`, not merged: the app decides which box wins.
- Overlay band = union of the boxes on screen during the overlay (start segment's box and every overlapping range),
  never a refusal: the app keeps ranges away from overlays when it needs the room.

## Phase 1: EDL field, placement, validation, diff (TDD)

- `edl.ts`: `EdlCaptionRange`, `Edl.captionRanges`, schema field, `findCaptionRangeAt`, `validateEdl` range problems,
  `diffEdl` line. `captions.ts`: `getCaptionPlaceAt`, `getCaptionChunkLayouts` through it. `overlays.ts`: band union.
  Exports in `index.ts`; regenerate `schema/edl.schema.json`.
- Done when: unit tests for chunk boxes in and out of a range, `validateEdl` (inverted, past the end, overlap, bounds),
  `diffEdl`, overlay band union; a draft frame grab of a fixture with a range shows the pill lifted (draft test on
  the drawn ASS position); an EDL without ranges keeps every existing test green; typecheck, lint, tests pass.

## Phase 2: release

- CHANGELOG, README (EDL section), version bump; PR, green CI, merge, `auto-release` for marketing-kit.
- Done when: the version is on npm (`npm view @softure-ai/marketing-kit version`).

## Progress

- [x] Phase 1: unit tests for ranges in edl, captions, overlays, draft (ASS style at the range's foot) and compose (div at the range's foot); `npx vitest run tools/marketing-kit tests/repo`: 2091 passed, 1 file failed only on a missing ssh-keygen in this container (tests/repo/deploy-workflows, unrelated); typecheck and eslint clean; schema regenerated.
- [x] Phase 2: 0.32.0 (0.28.0 to 0.31.0 were taken by other changes first), CHANGELOG and README; release by `auto-release` after the merge.
