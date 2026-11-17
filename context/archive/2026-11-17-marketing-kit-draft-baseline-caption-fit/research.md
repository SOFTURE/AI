# Research: marketing-kit-draft-baseline-caption-fit

## Findings
- `draft-text-width.ts` `readMetrics` reads `usWinAscent + usWinDescent` for the libass size; the baseline offset is
  never read. `createDraftFont` already reads the browser's content area (`contentArea`).
- `draft-overlays.ts` places every card line by its top (`\an7`, `\an8`, `\an9`) at the CSS line box's top
  (`getCardEvents` `text`, `getLaidOutSideTextEvents`, `getListEvents` `write`, `getNoteEvents` strip) or by its
  middle (`\an4`, `\an5`: counter, search bar). None corrects for the baseline.
- `draft.ts` `buildFootageDraftCaptions`: one `Caption` style at the box's size, one per moved box
  (`isSameCaptionPlace`, which ignores the size); `getDrawnPill` wraps with `wrapDraftLine` at `place.fontSize`.
- Probe (libass 0.17.1 here, 0.17.3 on the adopting app's server): DejaVu Sans at `\fs200`, PlayRes 1000: cap height
  125 px (sized by win metrics); a display serif with win ascent 1.3 em at `\an8\pos(500,100)\fs170` (100 px): ink
  bottom at 229, the baseline 130 px below the anchor; a browser in a 1.15 line box: 92.5 px.
- `tests/draft-matches-render.test.ts` compares Chromium and libass frames at 2 % tolerance with the kit's fonts.
