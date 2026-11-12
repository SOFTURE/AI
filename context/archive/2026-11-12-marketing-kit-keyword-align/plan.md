# Plan: marketing-kit-keyword-align

## Steps

1. `overlay-schema.ts`: `OVERLAY_KEYWORD_ALIGNS` (`left`, `center`, `right`); `style.align` takes them; a keyword with
   both `align` and `side` is refused; a title with `right` is refused by name; another kind refused as before.
   Regenerate `edl.schema.json`.
2. `overlays.ts`: a keyword's `align` left/right becomes its side, center sets `isCentred`; `getSideTextCard` centres a
   centred keyword; a title's align narrows to `center`/`left`.
3. `overlay-html.ts`: a centred keyword gets the `center` class and centred text.
4. `draft-overlays.ts`: a centred keyword's text on the card's axis (`\an8`), typed in centred.
5. Tests (`overlay-keyword-align.test.ts`): schema, placement, render classes and CSS, draft tags, typing, libass
   frames for each alignment. README, CHANGELOG, 0.34.0, `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Schema and JSON schema (`npx tsx tools/marketing-kit/scripts/write-schema.ts`).
- [x] 2 Resolver.
- [x] 3 Render.
- [x] 4 Draft.
- [x] 5 `npx vitest run tools/marketing-kit`: all pass (one existing schema test updated for the new message);
  libass frames of a keyword at left, center and right match the reported cards within 2 %.

## Decisions (auto)

- `align` on a keyword names where its card sits, in place of `side` (not both): one knob for the adopting app's
  preset, and `side` stays for existing EDLs.
- A keyword without either stays on the right in the kit; the adopting app sets its own default.
- A separate `OVERLAY_KEYWORD_ALIGNS` keeps `OVERLAY_ALIGNS` (titles) as it was, so apps listing title alignments do
  not start offering `right` for titles.
