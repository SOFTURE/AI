---
change_id: marketing-kit-overlays-1200
status: in_progress
---

# Plan: EDL overlays (issue #1200)

Input: change.md, research.md. Complexity: large.

## Phase 1: shape

- `overlay-schema.ts`: kinds, sizes, sides, limits, `overlaySchema` (exactly one of `at_word`/`at`, what each kind
  needs and refuses); `edl.ts` reads `overlays` and names their change in `diffEdl`; film `overlayMinSpacing`.

## Phase 2: resolution and guards

- `overlays.ts` `resolveEdlOverlays`: film time from the word, segment, placement (text cards above the captions in
  the safe zone; arrow tail inwards; highlight rect), refusals with reasons.

## Phase 3: render

- `overlay-html.ts`: cards, list, SVG arrow and highlight, GSAP entrances and exits; `composeFootage` punch-in tweens.
  `NOTICE` credits HyperFrames.

## Phase 4: draft

- `draft-overlays.ts`: ASS cards and drawings on layer 3; `planFootageDraft` punch-in zoom in `zoompan`.

## Phase 5: wiring, hyperframes, docs

- Pipeline refuses unresolvable overlays before rendering; glyph check includes their texts.
- hyperframes 0.9.20 (manifest, lock entry, `HYPERFRAMES_VERSION`); README, CHANGELOG, schemas.

## Acceptance

- Unit tests (schema, guards, markup, ASS, zoompan), libass frame grabs, Chromium frame grabs per kind, a real
  hyperframes 0.9.20 render with a keyword overlay (`MARKETING_KIT_RENDER=1`), gates green.

## Decisions (auto)

- `at_word` is `{ text, occurrence? }`: an editor names the word it hears, the occurrence disambiguates.
- `list` takes `items`, not `text`; `lower_third` one line.
- Placement is the kit's (side and size only), so the caption/safe-zone guards hold by construction for text cards;
  anchors are the app's and are checked.
- Spacing is start-to-start (`overlayMinSpacing` on the film), "one per about 8 s".
- Blocks are adapted, not copied verbatim: the originals are standalone 1920×1080 compositions with CDN scripts.
- Draft simplifications: straight arrow, square cards, linear punch-in ramps.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4
- [x] Phase 5 (real hyperframes 0.9.20 render with a keyword overlay: tests/render.test.ts passed locally, MARKETING_KIT_RENDER=1)
