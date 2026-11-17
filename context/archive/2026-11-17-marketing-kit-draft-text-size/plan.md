# Plan: marketing-kit-draft-text-size

## Approach
One description of a draft font, `DraftFont` (`draft-text-width.ts`): its family, its file, `measure(text, cssPx)`
in CSS px (advances per em, as a browser lays text) and `toAssSize(cssPx)` (`cssPx * winSum / unitsPerEm`, to two
decimals). Every size in the draft stays CSS px until an ASS size is written, where the role's font converts it.
`buildFootageDraftCaptions` takes a `fonts` set (body, heading, interface); without one it keeps today's behaviour
(the given family at scale 1, the old measure), so callers move over explicitly. `renderFootageDraft` builds the set
with `loadFootageDraftFonts` (exported, so an adopting app's previews use the same one).

## Phases
1. **Font metrics (TDD).** `readDraftFontMetrics(buffer)` (`unitsPerEm`, `winSum`), `createDraftTextMeasure` stays
   the libass measure; new `createDraftFont({family, file})` / `loadFootageDraftFonts(brand fonts)` return
   `DraftFont`s; the hand font reuses them. Tests: DejaVu Sans Bold and Caveat known numbers, a font without OS/2,
   a broken file. Done when: unit tests green.
2. **Captions.** Style `Fontsize`, `CaptionShape`, the pill and ribbon measure and line heights from the body
   `DraftFont` when `fonts` is given. Done when: tests pin the converted sizes and the pill's breaks in CSS widths.
3. **Overlays.** Every `\fs` converted by its role's font; keyword and lower third texts broken into the lines the
   render's card breaks them (`wrapDraftLine` on the role's measure, the box width less the padding), drawn with
   `\N`; the counter's unit, chip numbers, note strips. Done when: unit tests pin `\fs` per role and the keyword's
   breaks.
4. **Wiring.** `renderFootageDraft` passes `loadFootageDraftFonts`; exports in `index.ts`; README, CHANGELOG,
   version 0.42.0.
5. **Regression test, draft vs render (`tests/draft-matches-render.test.ts`).** A fixture film with a hook title, a
   place card, a counter, a keyword that wraps, a lower third, a list and highlight-pill captions; the render's
   composition in Chromium at 1080x1920 and the draft's ASS burnt by libass at 540x960 on the same plain picture,
   the render scaled to 540x960; card and accent colours set to the picture's so only text differs; at 12 or more
   seconds: text ink boxes within 2 % of the frame and the same number of text rows per overlay and caption. Runs
   where Chromium and libass exist (CI has both). Before and after frames as evidence (not committed).

## Done when
- All the above tests green; typecheck, lint, the kit suite green; the regression test fails on master's code.

## Progress
- [x] 1 Font metrics: `createDraftFont`, `toDraftAssSize`, `toDraftSpacing`, `withLetterSpacing`,
  `loadFootageDraftFonts` (in `draft.ts`, next to `FOOTAGE_DRAFT_FONT`); `src/footage/draft-font-size.test.ts`.
- [x] 2 Captions: style sizes and `Spacing`, pill and ribbon measure and line heights from the body font.
- [x] 3 Overlays: every `\fs` per role, `\fsp` per the render's letter spacing (shared constants now feed the
  render's CSS too, byte-identical), keyword and lower third broken as the render's card breaks them.
- [x] 4 Wiring: `renderFootageDraft` passes `loadFootageDraftFonts`; exports; README; CHANGELOG; 0.42.0.
- [x] 5 `tests/draft-matches-render.test.ts`: 12 moments, all text boxes within 2 % and equal line counts; the same
  test with the old draft arguments fails 12 of 12 (widths 0.80x to 0.86x). Evidence (not committed):
  `draft-matches-render/draft-text-matches-render/` in the adopting app's project files, 01-06 before and after.
  Gates: `npx tsc --noEmit` clean, ESLint clean, `npm run lint:language` clean, `npx vitest run tools/marketing-kit`
  1747 passed (one pinned caption style updated to the converted size).

## Decisions (auto)
- Letter spacing (`-.01em` captions, `-.015em` to `-.025em` cards) is not drawn in the draft: at most 2.5 % of a
  line's width; left with the follow-up shape change.
- Line pitch inside a wrapped keyword is libass's (one libass size), not CSS's 1.15: the line count matches, the
  card's height and the text's vertical place are the follow-up change's (`box_percent` parity).
- The caption fit to `captionMaxLines` stays render-only (rare at four words a chunk).
- Letter spacing turned out to be 3 to 4 % of a title's width, past the 2 % bar: drawn with `\fsp` after all (the
  first decision above is reversed).
- The lower third's accent dot is not drawn by the draft (its text starts 0.81 em further left than the render's):
  a card-shape difference, left to the follow-up change; the regression test checks its size and lines only.
- `buildFootageDraftCaptions` without `fonts` stays as it was, so a caller that does not pass fonts sees no change
  until it moves over.
