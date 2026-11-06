---
change_id: marketing-kit-photo-cover-layouts-1163
status: done
---

# Plan: photo cover layouts (issue #1163)

Input: change.md, research.md. Complexity: small (one module, its tests, docs).

## Phase 1: inputs (`src/og/photo-cover.ts`)

- `layout`: `photo` | `title-bottom` | `title-center` | `title-top` | `kicker-title` | `pill`, exported as
  `PHOTO_COVER_LAYOUTS` and `PhotoCoverLayout`. Default: `title-bottom` with a caption, `photo` without.
- `kicker`: trimmed, 1..`MAX_COVER_KICKER_LENGTH` (40) characters; only with `kicker-title`, which requires it.
- A text layout requires `caption`; `photo` refuses one. `pill` takes `caption` as its label, at most
  `MAX_COVER_PILL_LENGTH` (32) characters.
- `tone`: `light` | `dark`; none keeps today's ink (light text on the darker brand colour).

## Phase 2: layout and scrim

- Regions of the band: bottom and `kicker-title` and `pill` the lower half, top the upper half, centre the middle third.
  The text block is anchored at the region's outer edge with the existing padding (centre: centred in the third).
- `kicker-title`: the kicker (heading family, about 0.4 of the title size, letter-spaced) above the title.
- `pill`: the label in a rounded box filled with the shade colour; that box is the scrim.
- The measured box of all drawn pixels must lie inside the region, else an error naming the layout and region.
- Scrim: bottom as today; top mirrored (holds from the frame's top to the band's top, fades out below the text);
  centre a band that fades in above and out below the text; none for `pill` (its box) and `photo`.
- Missing glyphs are checked per text and named (the caption, the kicker, the pill label).

## Phase 3: tests and docs

- Each layout at 1080×1920 on a generated photo: every lit text pixel inside the band and in the named region.
- `tone: "dark"`: dark text on a light scrim. Scrim position for top and centre.
- Errors: overlong kicker and pill label, kicker glyph missing, kicker without `kicker-title`, text layout without a
  caption, `photo` with a caption.
- README: the layouts with one example each; CHANGELOG `## Unreleased`.

## Acceptance

- The issue's four acceptance points, each a test or the README. Gates: typecheck, lint, `npm test`.

## Decisions (auto)

- `pill` uses `caption` as its label rather than a new input: one text field, a shorter limit.
- `kicker-title` and `pill` sit in the lower half, like `title-bottom`, where the platforms' grid crop and the subject
  above leave room.
- `title-top` uses the upper half (the mirror of `title-bottom`); `title-center` the middle third.
- A kicker with another layout, or a caption with `photo`, is an error instead of being ignored silently.

## Progress

- [x] Phase 1: `layout`, `kicker`, `tone` in the zod schema; `resolveCoverText` checks the pairing;
  `PHOTO_COVER_LAYOUTS`, `PhotoCoverLayout`, `PhotoCoverTone`, `MAX_COVER_KICKER_LENGTH`, `MAX_COVER_PILL_LENGTH`
  exported from `./og` and the root.
- [x] Phase 2: `buildTextTree` (placement per region, kicker line, pill box), `checkTextGlyphs` (names the text),
  `layOutText` (region check), `buildScrim` (bottom, top, centre; none for a pill).
- [x] Phase 3: 19 new tests in `tests/og/photo-cover.test.ts` (47 pass); README layout table; CHANGELOG Unreleased.
  Gates: typecheck, ESLint, language gate, marketing-kit suite 1198 pass. Visual check of every layout done.
