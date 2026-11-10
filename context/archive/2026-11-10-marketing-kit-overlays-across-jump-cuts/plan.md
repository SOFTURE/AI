# Plan: marketing-kit-overlays-across-jump-cuts

## Steps

1. `src/footage/overlays.ts`: `findShotBreak(edl, index)` (exported) answers why the cut starting segment `index`
   ends the shot (another clip, a transition other than `cut`, a Ken Burns zoom on either side, a moved caption box,
   the cut's end) or null; `findShotSpan` walks on from the overlay's segment across every null break until the
   overlay ends. `resolveEdlOverlays` refuses only past the shot's end, naming the breaking cut and the segments the
   overlay may span. A `punch_in` never crosses; a `hook_title` keeps crossing any cut.
2. Tests (TDD): a 4 s list across a pause cut accepted with its start, end and start segment; several jump cuts in a
   row; each break reason; the punch-in; `findShotBreak` per cut. The existing search-bar test across a plain jump
   cut flips to accepted; the zoom-cut refusal gains its reason.
3. `edl.ts` overlay description and the generated `schema/edl.schema.json`, README, CHANGELOG, version 0.26.0
   (minor: a new export), `tools/deploy`'s range widened to accept it.

## Progress

- [x] 1 `findShotBreak`, `findShotSpan`, the resolver's check.
- [x] 2 `npx vitest run tools/marketing-kit` green (1367 passed, 68 skipped); a libass burn of the draft's captions
  file shows the list card 0.5 s before the jump cut and 1.5 s after it, gone once its 4 s end.
- [x] 3 Schema regenerated (`npm run schema -w @softure-ai/marketing-kit`, `tests/schema.test.ts` green), README,
  CHANGELOG 0.26.0, package.json and package-lock.json, deploy range. `npm run typecheck` clean.

## Decisions (auto)

- The same caption box is part of "the same shot": the resolver places a text overlay against the caption band of
  the segment it starts in, so a moved box after the cut could leave it on the captions.
- A dissolve (`fade`) or `zoom` cut breaks the shot even inside one clip: the picture changes there.
- Minor bump: the new export `findShotBreak` lets an app explain the rule before it edits.
