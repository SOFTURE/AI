# Plan: marketing-kit-overlay-polish

## Steps

1. `getCentredLeft` (centre on the frame, clamped to the zone) and `getCentredSpan` (the wider side on both edges);
   `measureCentred`: measure in the whole zone as before; when wider than the centred span, measure again in it; when
   that fails, keep the whole-zone result. Use it in `placeCard` (not the date stamp), `placeEndWord` and the chip
   row; a centred stack and a centred keyword get a box centred on the axis.
2. Chips as a countdown: chips always staggered; a numbered accent badge per chip (`LIST_CHIP_BADGE_EM`, the left
   padding equal to the vertical one); `getChipCoveredTimes` (the next point's second) after which the point is drawn
   at `LIST_CHIP_COVERED_OPACITY` and the number gives way to a drawn tick. Draft: badge on layer 5, number and tick
   on layer 6, the point in two steps. Render: `.ov-num` with the number and an SVG tick, three tweens per covered chip.
3. Note without a side: on the axis, tilt halved; resolved `side: "center"`.
4. Tests: every changed expectation re-derived (centre at 540); new assertions for the badge, the covered steps and
   tweens, the burned frames (newest point lit, covered fainter), the centred note; schema texts, README,
   CHANGELOG 0.38.0, deploy's dev range.

## Progress

- [x] 1 Centring (`npx vitest run tools/marketing-kit/src/footage`: centred cards at x 540, long end word clamped).
- [x] 2 Chips countdown.
- [x] 3 Note on the axis.
- [x] 4 `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx vitest run tools/marketing-kit`: 1667 passed, 4
  skipped; `npx tsc --noEmit -p tools/marketing-kit`, ESLint clean. Frame grabs of the draft and the render
  (fictional texts) show the cards, chips and note on the axis.

## Decisions (auto)

- Fit before centring: a card that cannot fit the centred span keeps the whole zone (as near the axis as it can)
  rather than being refused; stored cuts keep drafting.
- Chips always come in one by one: a countdown needs an order; points without words are spaced as `stagger` spaces them.
- The covered state dims the point and swaps the number for a tick; the card itself keeps its colour (one rule for
  draft and render, no extra layer to fade on exit).
