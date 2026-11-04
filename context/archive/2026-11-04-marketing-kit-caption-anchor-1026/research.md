---
change_id: marketing-kit-caption-anchor-1026
---

# Research: caption anchor and line limit

## Where captions are placed

- `CaptionLayout` (`src/compose/timeline.ts`) is `{ top, left, right, fontSize }`; `resolveLayout` merges the
  `marketing.json` `layout` override key by key, `layoutOverrideSchema` (`src/config/schema.ts`) validates it.
- Three consumers draw the box: the screen-recording composition (`src/compose/compose.ts`, `.caption{top:…}`), the
  footage composition (`src/footage/compose.ts`, same CSS) and the footage draft (`src/footage/draft.ts`, an ASS style
  with alignment 8 and `MarginV = top`).
- `getCaptionPresetLayout` computes `top` for two lines (`2.5 × fontSize + 40`), so a third line ends about one line
  lower than the zone's edge.
- Pill metrics are inline CSS: `line-height:1.18`, `padding:16px 28px`; the phrase style shares the line height.

## The render and measuring text

- hyperframes hides inactive clips with `visibility: hidden` (layout kept), and waits for `document.fonts.ready`
  before capturing, so a page script can measure every caption with its brand font before the first frame.
- Only the browser knows the font's advance widths; the kit has character maps, not metrics. Fitting therefore runs
  in the page: step the font size down until the box's height is at most N lines.
- libass (the draft) wraps on its own and cannot be measured from the kit; the draft is a preview, so it keeps the
  font size and only follows the anchor.

## Options

1. `bottom?: number` on `CaptionLayout` (px from the frame's bottom), winning over `top`: smallest change, one field
   in the override. An `anchor` enum would change what `top` means.
2. `captionMaxLines` on the footage film (1-4), absent: no limit. Shrink in 1 px steps to a floor of 70 % of the
   box's size; splitting chunks would change caption timing in both the render and the draft.
3. Export `CAPTION_LINE_HEIGHT` and `CAPTION_PILL_PADDING`; `captionChunks` bounds as options are not needed once 1
   and 2 hold the foot in place.

Recommended: 1 + 2 + 3 (metrics only).
