# Research: marketing-kit-portrait-templates

Input: change.md (MK-12, issue #150). Sources: the package on `master` (e2d1974); FIRE_TRACKER `master` (2fead8d7,
read only): `marketing.json` (`ogImages`), `context/marketing/social-bank-tresci.md` (the planned slide copy).

## 1. Current state

- `src/og/render.ts` `buildOgTree`: parses `data` with the template's schema, builds a context with
  `scale: width / BASE_WIDTH` (`BASE_WIDTH = 1200`, `templates/context.ts`), then checks every drawn character
  against the loaded fonts (`checkGlyphs`, paths from `listStrings(parsed.data, dataPath)`).
- `templates/frame.ts` `frame`: padding 64, the logo and name on top, the content in a column with
  `flexGrow: 1; justifyContent: center`. Sizes are written for a 1200-wide card and multiplied by `scale`
  (`text`, `px`).
- One entry renders one PNG: `renderConfiguredOgImage` returns one `Buffer`, `src/cli/og.ts` writes
  `<output.dir>/og/<id>.png`.
- `src/config/schema.ts` `ogImageSchema`: a discriminated union on `template`, each variant with `id`, `size`
  (a `[w, h]` tuple, default `[1200, 630]`) and the template's `data` schema.
- Tests: `tests/og/templates.test.ts` (weights, palette, scale), `tests/og/render.test.ts` (glyph errors, one
  committed PNG snapshot per template, compared byte for byte; `has no snapshot without a template`).

## 2. Why the portrait looks empty (confirmed in code)

At 1080×1350 `scale` is 0.9: a 72 px headline becomes 65 px. Content height for FIRE's `jedna-liczba-zus-898` is
roughly eyebrow 23 + headline 2 lines × 72 + tiles 100 + cta 60, about 330 px, centred in 1350 - 2×58 px: about
450 px of empty background above and below. Fixing `headline-cta` for portrait would change its 1200×630 output,
which the constraint forbids, so the portrait look belongs to new templates.

## 3. Decisions

| Question (issue "open for research") | Choice | Why |
| --- | --- | --- |
| Carousel: one entry with N slides, or N entries sharing a `series` key | **One entry, `data.slides` (2-10)**, files `<id>-1.png`…`<id>-N.png` | the counter "2/6" and the shared look need the whole run; one place to reorder slides; Instagram caps a carousel at 10 (now 20, but FIRE's series use 3-6) |
| Size presets | **Yes**: `size` takes `"landscape"` (1200×630), `"portrait"` (1080×1350), `"square"` (1080×1080), `"story"` (1080×1920) or a `[w, h]` tuple; the loaded config always holds the tuple | the three social formats are fixed by the platforms; the tuple stays for anything else |
| A source line | **Yes**, optional `source` (≤ 80) on the big number and on every slide, drawn small and muted at the bottom | FIRE's rule: every figure in a post names its source |
| How sizes scale | the new templates are written for **1080×1350** and scale by `min(width / 1080, height / 1350)`; the two old templates keep `width / 1200` | the limiting side decides, so a square or a story never overflows what the portrait fits; old output unchanged |
| Default size | the new templates default to `portrait`, the old to `[1200, 630]` | a variant of the discriminated union has its own default |
| A slide's content | `eyebrow`, `headline`, `body`, `tiles` (≤ 4), `cta`, `source` | FIRE's planned slides use all of them (bank, items 3 and 5) |
| The big number's content | `eyebrow`, `number` (≤ 12, e.g. "1 356,48 PLN"), `caption` (≤ 90), `tiles` (≤ 2), `cta`, `source` | FIRE's "One number" posts: one figure and its sentence, a second figure as a tile ("744 PLN / woman, 60") |
| Rendering one slide | `OgImageInput.slide` and `renderConfiguredOgImage({ slide })`, 1-based, default 1; `countOgSlides` | a Next route can serve each slide; the 0.1.7 call shapes keep working |
| File name collisions | the config refuses an `ogImages` id equal to `<carousel id>-<n>` | two entries would write the same file |

## 4. How "refused, not shrunk" is proven

The schema caps each field; the caps are chosen so the worst case fits. An oracle of another kind than the layout
code: render the worst-case copy (every field at its cap, wide glyphs such as `W` and `0`) to PNG and check that every
pixel of the outer padding band is the background colour, at portrait, square and story. If a cap is too generous the
text spills into the band and the test fails.

## 5. Risks

- Satori breaks long words only at spaces; a 12-character number without spaces must fit on one line at its size.
  The worst-case render covers it.
- The glyph check lists strings of all slides; the counter ("1/6") is drawn text too and is checked like the rest.
- Snapshots: one committed PNG per template; the carousel's snapshot is slide 1.
