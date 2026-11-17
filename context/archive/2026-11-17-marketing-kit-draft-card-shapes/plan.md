# Plan: marketing-kit-draft-card-shapes

## Approach
One card layout in `overlays.ts`, measured by an `OverlayTextMeasure` (role, text, CSS px, letter spacing → CSS px):
`getSideTextLayout(overlay, measure)` (lines, card, dot) and `getCounterCard(overlay, text, measure)`; without a
measure everything stays as today. `getDrawnOverlayCard(overlay, measure?)` returns the render's card when given one.
`createOverlayTextMeasure(fonts)` builds the measure from `loadFootageDraftFonts`. `DraftFont` gains the content area
(`ascentEm`, `descentEm`) a browser gives an inline box. The draft (`draft-overlays.ts`) uses the layout for side
texts, counters and highlight marks.

## Phases
1. **Layout (TDD).** `DraftFont` content area (hhea, typo with `USE_TYPO_METRICS`); `OverlayTextMeasure`,
   `getSideTextLayout`, `getCounterCard`, `getDrawnOverlayCard(overlay, measure?)`, `createOverlayTextMeasure`.
   Unit tests with a fixed-width fake measure and the fixture fonts. Done when: unit tests green.
2. **Draft.** Side texts: the layout's card, wrapped lines as one event each a CSS line apart, the lower third's dot
   and its text after it. Counter: its card per shown value. Highlight marks: measured width per line, content-area
   height and place; a wrapped highlighted keyword one mark per line. Done when: unit tests pin the drawings.
3. **Regression test (`tests/draft-cards-match-render.test.ts`).** Highlight hook title, wrapping highlight keyword
   with a wipe, wrapping keyword card, lower third, place cards (`size: s`, `subtitle_size: m`), counter; render in
   Chromium (seeking with callbacks) vs libass; card boxes within 1 % of the frame, text lines equal; and
   `getDrawnOverlayCard` with the fonts' measure within 1 % of the render's card. Red on 0.42.0's draft.
4. **Wiring and release.** Exports, README, CHANGELOG, version (next free minor, coordinated with the other open kit
   change), auto-release; then the adopting app bumps.

## Done when
Typecheck, lint, the kit suite green; the regression test fails on 0.42.0 and passes; evidence frames saved outside git.

## Progress
- [x] 1 Layout: `getSideTextLayout`, `getCounterCard`, `getKeywordMarkBlock`, `getDrawnOverlayCard(overlay, measure?)`,
  `createOverlayTextMeasure`, `DraftFont.contentArea`; `src/footage/draft-card-shapes.test.ts` (22 tests).
- [x] 2 Draft: side texts per line one CSS line apart, keyword edge, lower third dot, counter cards per width and the
  unit's gap, measured highlight marks (a keyword's one block, as the render's flex item). `draft-font-size.test.ts`
  updated to the per-line drawing.
- [x] 3 `tests/draft-cards-match-render.test.ts`: 14 moments, every card within 1 % of the frame (largest gap 4 px of
  540), equal line counts, reported card within 1 %. On 0.42.0 the same comparison failed for the highlighted hook
  title (marks 335 vs 215 px wide), the highlighted and plain wrapped keyword (one line tall), the counter (267 vs
  141 px wide) and the lower third's text (no dot); research.md has the table. The 0.42.0 test's lower-third exception
  is removed (the dot is drawn). Evidence (not committed): the adopting app's project files,
  `draft-matches-render/draft-overlay-shapes-match-render/01..07-*-{before,after}-1080-light.webp`.
  Gates: `npx tsc --noEmit` clean, ESLint clean, `npm run lint:language` clean, `npx vitest run tools/marketing-kit`
  1783 passed.
- [x] 4 Wiring and release: exports, README, CHANGELOG, 0.43.0 (the other open kit change takes 0.44.0); published by `auto-release.yml` after the merge.

## Decisions (auto)
- The render is the reference; the CSS is not changed.
- Text baseline offsets between libass and Chromium (under 1 % of the frame for the fixture and brand fonts) stay.
- A highlighted keyword's mark is one block round all its lines: the render's `.ov-mark` is a flex item of the card,
  so it is blockified (measured in Chromium: 751 x 200 px round two lines), unlike a hook title's inline marks.
- A brand style's thin border (a few px) is not added to a laid-out card's size; under 0.3 % of the frame.
- The test harness seeks the render with callbacks (`seek(t, false)`), as the capture does, so a counter counts.
