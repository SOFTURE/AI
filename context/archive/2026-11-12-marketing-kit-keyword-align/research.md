# Research: marketing-kit-keyword-align

- `placeSideText` sets a keyword's `side` from `style.side` (default `right`) and its `box` to the whole room; the card
  is fitted to the text on that side (`getSideTextCard`), or in the middle for a list with `isCentred`.
- The render positions the card with `.ov.right` / `.ov.center` (flex `justify-content`); `.ov.center .ov-card` already
  scales about its middle.
- The draft places the text at the card's padding on its side (`\an7`/`\an9`); a centred list uses `\an8` on the card's
  axis, and `getTypedSteps(..., isCentred)` types centred text without the hidden remainder.
- `style.align` is validated as `center | left` and refused on every kind but the two titles.
