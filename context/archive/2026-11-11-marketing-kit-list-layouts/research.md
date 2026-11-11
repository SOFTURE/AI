# Research: marketing-kit-list-layouts

- `placeSideText` sizes a list's box for every point (`lines × 1.4 em + padding`) and puts its card on `side`
  (default left); `getDrawnOverlayCard` fits the card to the widest line with its bullet.
- The render draws one `<ul class="ov-card">` that enters at the start; unstaggered points tween in from
  `start + 0.2 + 0.12 i`, staggered ones (`.st li{opacity:0}`) on `itemStarts`, which start 0.2 s after the card at
  the earliest (`getListItemStarts`). So the card always stands empty for a moment.
- The draft draws one card shape for the whole span and one text event per point.
- Titles already shrink by 0.9, at most three times, before being refused (`fitTitle`): the same rule fits a row of
  chips that is a little too wide (an adopting app's real list, two short points and one longer one, overflows 852 px at 48 px;
  two steps of 0.9 bring it to 39 px).
- libass animates a rectangular `\clip` with `\t` (with an acceleration), which can follow a growing card.
