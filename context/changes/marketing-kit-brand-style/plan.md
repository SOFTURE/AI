# Plan: marketing-kit-brand-style

Inputs: `change.md`, `research.md`. Test-first for the geometry, test-after for the CSS.

## Phase 1: Brand style in the draft and the render

- `footage/brand-style.ts` (new): `BrandStyle` (`cornerRadius`, `padding`, `shadow`, `border`, optional
  `captionCornerRadius`), the token lists, `getCornerRadiusPx(token, height, scale)` (none 0, s 12, m 22, l 36 px of a
  1080 px frame, pill half the height), `getPaddingScale`, `getStyleShadow`, `getStyleBorderWidth`.
- `og/text-width.ts` (new): `createTextMeasurer(font: Buffer)` from `cmap`, `hmtx`, `hhea`, `OS/2`: width of a line
  at a libass font size, null when unreadable.
- `pipeline.ts`: `FootageBrand.style?: BrandStyle`; the draft brand takes it too.
- Draft captions (`draft.ts`): with `brand.style`, a `highlight` chunk is wrapped by measured width, given `\N`, and
  drawn on a rounded pill (`getRoundedRectDrawing`) of the chunk's lines, padded by the token, with the soft shadow
  (a blurred dark copy) and the thin accent border; the text on the pill without a box. Without `style`, as before.
- Draft overlays: card radius, shadow and border from the token (or the overlay's own `corner_radius`); the side cards
  through `getDrawnOverlayCard` (from `overlay-drawn-boxes`).
- `overlay-schema.ts`, `overlays.ts`: `style.corner_radius` on every drawn kind (not punch_in, arrow, highlight),
  resolved as `cornerRadius`.
- Render: `.pill` and `.ov-card` radius, padding (pill), shadow and border from the style; `.url` radius; per overlay
  its own radius inline.
- Cover: `renderPhotoCover` takes `cornerRadius`: the pill and the kicker box.
- CHANGELOG 0.26.0, README section, exports.

Done when:
- unit tests: tokens to px, measurer against a fixture font, the draft ASS with and without style (pill drawing,
  `\N`, layers, shadow, border), overlay cards' radius per token and per overlay, CSS strings, the cover's radius;
- a fixture draft rendered with `cornerRadius: "l"` shows the pill, keyword, list, place card and hook title with the
  same radius (frame grab looked at); gates green (typecheck, lint, test).

## Decisions (auto)
- Radius in px of the 1080 px frame, not in em: the same token must give the same corner on a 64 px caption and a
  44 px keyword.
- Overlay padding left to the card-layout follow-up (it moves the geometry the draft frames report); here the caption
  pill's padding only.
- The search bar keeps its full pill unless its own `corner_radius` says otherwise: a search field is a pill.
- The `phrase` caption has no pill, so the style does not touch it.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Brand style in the draft and the render

#### Automated
- [ ] 1.1 Style tokens, text measurer, brand and overlay schema
- [ ] 1.2 Draft captions and overlay cards drawn with the style
- [ ] 1.3 Render CSS, cover, end card
- [ ] 1.4 Tests, fixture draft frame grab, gates green, CHANGELOG 0.26.0
