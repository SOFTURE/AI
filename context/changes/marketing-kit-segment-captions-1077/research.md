# Research: marketing-kit-segment-captions-1077

## Where the caption box lives today

- `getFootageCaptionLayout(film, override)` (`footage/captions.ts`) gives one `CaptionLayout` per film: the format's
  layout, the 9:16 preset's box, or the project's `layout.caption` override. `bottom` (when set) anchors the box by
  its foot and wins over `top` (`getCaptionPositionCss`).
- Render: `composeFootage` (`footage/compose.ts`) writes one `.caption` CSS rule from that box; each chunk is a
  `div.clip.caption` with its span from `getCaptionSpans`. Chunks come from `captionChunks` (highlight) or
  `phraseChunks` (phrase), both over the film-time words from `remapWords`.
- Draft: `buildFootageDraftCaptions` (`footage/draft.ts`) writes one ASS style `Caption` whose alignment (2 by foot,
  8 by top) and `MarginV` come from the box; every Dialogue uses it. The ASS file is laid out in the full film frame.
- EDL: `edlSchema` is strict; `validateEdl(edl, clips, filmId)` is called by `readEdlFile` (pipeline), which knows
  the film (so its frame through `getFrame` and the caption font size through the layout).
- `captionMaxLines`' fit script works per `.caption > p` element, so a moved box keeps it; the glyph check is about
  characters only, so it is unaffected by the box.

## Options

1. Per-chunk layouts computed once (`getCaptionChunkLayouts`) and applied as an inline position style on chunks that
   differ (render) and as extra ASS styles for each distinct moved box (draft). Unchanged chunks emit exactly what
   they did before, so an EDL without the field is byte-identical. Recommended.
2. Per-chunk `MarginV` overrides in Dialogue lines: cannot switch the anchor (alignment) and a margin of 0 means
   "use the style's", so a foot at 0 px could not be expressed. Rejected.

## Semantics chosen

- A segment's `bottom` anchors its box by the foot (as `CaptionLayout`). A segment's `top` without `bottom` hangs the
  box from that top, dropping the film's `bottom`; otherwise a `top` alone could never move a bottom-anchored box.
- Bounds (`validateEdl`, when given the frame): `top` and `bottom` each at most frame height minus one card (one line
  plus the pill's padding), so a card always fits; negatives are refused by the schema.
