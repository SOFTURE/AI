# Plan: marketing-kit-drawn-overlay-card

## Steps

1. `overlays.ts`: `getSideTextLines` (a list's points with their bullets, whitespace collapsed) and the exported
   `getDrawnOverlayCard(overlay)`: for keyword, lower third and list the card fitted to the widest line
   (`estimateTextWidth` + 2 × padding x), capped at the box's width, on its side, the box's top and height; every other
   kind `getOverlayBounds`. Export it from `index.ts`.
2. `draft-overlays.ts`: `getSideTextEvents` draws `getRoundedRectDrawing(card, 0.42 em)` on layer 3 (`OverlayShape`, the
   card colour) and the text on layer 4 (`OverlayPlain`) inset by padding x/y on its side (lower third from its foot);
   a list one event per point on `OVERLAY_LIST_LINE_HEIGHT`; entrances as before (none given: fade). Drop the unused
   `Overlay` style and `getTextTags`' card flag.
3. Tests: exact events for the three kinds, entrances and colours; `getDrawnOverlayCard` for right, left, a list, a
   capped long keyword, another kind and a punch-in; a libass-burned frame whose card edges match the function within
   2 % of the frame.
4. README, CHANGELOG, version 0.25.0 (minor: a new export), `tools/deploy` dev range.

## Progress

- [x] 1 `getDrawnOverlayCard` and `getSideTextLines` in `overlays.ts`, exported.
- [x] 2 The draft draws the fitted rounded card. Frame grabs of "2 konwencje", a three-point list and a lower third
  looked at: text inside its card on its side, list padding even.
- [x] 3 `npx vitest run tools/marketing-kit/src/footage/overlays.test.ts tools/marketing-kit/src/footage/overlay-kinds.test.ts`:
  43 passed (the libass test runs with ffmpeg's `ass` filter here).
- [x] 4 README, CHANGELOG, version 0.25.0, lockfile.

## Decisions (auto)

- A drawn card in place of libass's box: libass sizes the box from real glyph widths the kit cannot read back, so no
  report could match it; drawing from the estimate makes report and frame one box, as the other cards already are.
- The radius is the render's `.ov-card` 0.42 em, in one local function, so a brand style token can replace it later.
- `getOverlayBounds` stays the whole box: it guards overlaps against the hook title, where the render's real text
  may be wider than the estimate.
- Minor bump: a new export and a visible change of the draft's look (rounded, render padding).
