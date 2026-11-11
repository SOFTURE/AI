# Plan: marketing-kit-list-layouts

## Steps

1. `overlay-schema.ts`: `OVERLAY_LIST_LAYOUTS` (`stack`, `chips`, `auto`), `style.list_layout`, refused on another
   kind. Regenerate `edl.schema.json`.
2. `overlays.ts`: the first staggered point at the overlay's start; a list without a side is `isCentred`; chips
   measured per point (`measureChipRow`), shrunk like a title, placed left to right in a row centred in the box
   (`chips`), `auto` falling back to the stack, `chips` refused when it never fits; `getDrawnOverlayCard` answers the
   row; `getListCardsByItem`, `getListItemTimes`; a centred stack and chips draw no bullets.
3. `overlay-html.ts`: `addList`: a stack's card sized to its first point, `width`/`height` tweens to each next one
   (0.35 s, `power3.out`), later points hidden then faded in, lines centred; chips as absolute cards, the later ones
   hidden until their second, each with the list's entrance; every card leaves together.
4. `draft-overlays.ts`: `getListEvents`: the stack's card per point in three eased steps, its first part with the
   entrance and its last with the exit; lines centred on the card's axis, a later one clipped to the growing card;
   chips each with its own shape and centred text from its second.
5. Tests (`overlay-list.test.ts`): schema, placement, chips and shrink, auto, refusal, times, growth, render markup
   and tweens, draft events, libass frames (three chips in turn; a long list's card growing, never empty, centred).
   Existing tests keep a side list for the old look. README, CHANGELOG, 0.33.0, `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Schema and JSON schema (`npx tsx tools/marketing-kit/scripts/write-schema.ts`).
- [x] 2 Resolver.
- [x] 3 Render. Chips and a growing stack grabbed in Chromium with GSAP at 2.05, 2.6, 3.2, 3.6 and 4.7 s and looked
  at: the card comes in with its first point, grows, later text clipped by it; a chip's text was left-aligned (the
  list's column flex) and is now centred.
- [x] 4 Draft. The same fixtures burned in by libass and looked at; a later long point showed outside the card while
  it grew, now clipped to it.
- [x] 5 `npx vitest run tools/marketing-kit`: all pass; README, CHANGELOG, version, lockfile.

## Decisions (auto)

- Chips enter left to right in their final places: nothing already shown moves, and the order is the order they are
  said, the calmer of the two the owner offered (middle out would place the first point in the middle and push
  nothing, but reads out of order).
- A row too wide shrinks like a title (0.9, at most three times) before `auto` falls back to the stack: the owner's
  own example fits so.
- Chips and the centred stack are centred in the room the overlay may take (the safe zone's middle), not the frame's.
- An unstaggered list shows every point with its card, without the old 0.12 s cascade, so the card is never empty.
- The draft's growth is three eased steps (libass cannot ease a drawing's size); the render's is a tween.
