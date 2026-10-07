# Implementation review: marketing-kit-portrait-templates

Verdict: **approved** after two fixes found while building (I1, I2).

## Against the plan

| Phase | Planned | Done | Evidence |
| --- | --- | --- | --- |
| 1 | `big-number` and `carousel`, portrait layout scaled by the limiting side, `slide` and `countOgSlides`, overflow oracle, snapshots | yes | `templates/portrait.ts`, `big-number.ts`, `carousel.ts`, `context.ts` (`getLayoutScale`, `PORTRAIT_BASE`), `render.ts` (`slide`, `countOgSlides`, `getDefaultOgSize`); `tests/og/templates.test.ts` (scale per size, number steps, counter, slide out of range, slide count), `tests/og/portrait-fit.test.ts`, snapshots `big-number.png`, `carousel.png` |
| 2 | size presets, per-template default, file-name collision refused, CLI files per slide, README, schema, 0.1.8 | yes, one deviation | `config/schema.ts` (`OG_SIZE_PRESETS`, `ogSize`), `config/og-image-names.ts`, `cli/og.ts`; `tests/config.test.ts` (presets, defaults, unknown preset, collision), `tests/og/cli-og.test.ts` (files and sizes, a written slide equals `renderConfiguredOgImage`); README (config table, templates table, social posts, slide option, upgrade note); JSON Schema regenerated; 0.1.8 |

Deviation: the fixture `marketing.json` did not get the two example entries (plan 2.5). It loads no font files (its
fonts come from the app's CSS), so `og` cannot render there for any template; the README tables and the tests'
`SAMPLE_DATA` carry the examples instead.

## Verification

- Old output byte for byte: `headline-cta.png` and `headline-chart.png` are unchanged in `git status` after
  `UPDATE_OG_SNAPSHOTS=1`, and the snapshot test compares PNG bytes.
- Overflow oracle (another kind than the layout code): copy at every schema limit rendered to pixels at portrait,
  square and story; the padding band must be bare background. Sabotage: the slide body at 52 px instead of 40 px
  fails "a carousel slide keeps every field inside the portrait frame"; a band twice the padding is reported on all
  four sides, so the scan sees paint.
- Looked at the renders (FIRE's "898 PLN" post and the "Myth or fact" slides): the number spans most of the width,
  the copy fills the frame, the source and call to action sit at the bottom.
- Gates: typecheck, lint (with the language gate), test, build.

## Findings

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| I1 | The first cut allowed four tiles on a slide; at the limits (headline, body, four tiles, cta, source) the portrait overflowed by about 200 px, which the oracle caught. | must | Fixed: two tiles per slide (FIRE's planned slides use at most two label and value pairs); tile values at 44 px so a 16-character value stays on one line. |
| I2 | `renderOgImage` without a `size` drew the portrait templates at 1200×630 (the old global default). | must | Fixed: `getDefaultOgSize(template)` gives the portrait templates 1080×1350; landscape keeps 1200×630. |
| I3 | Satori's break inside a long word (a run of capitals with no space) can leave a glyph's overhang about 15 px into the padding. | note | Accepted: the text stays inside the image (tested with the outer half of the band); real copy breaks at spaces. |
| I4 | Limits are lengths, not measured widths: a figure of twelve wide capitals wraps to a second line instead of being refused. | note | Accepted: refusing needs text measurement Satori does not expose; the number steps are sized for digits (tested: "888 888 8888" stays inside the frame). |
| I5 | A character no font has on slide 3 is found when slide 3 renders, not slide 1. | note | The CLI renders every slide, so `og` refuses the entry with the path `ogImages[i].data.slides[2]…` (plan review P2). |

## Manual checks for the owner

- After the 0.1.8 release, in FIRE_TRACKER: move `jedna-liczba-zus-898` and `jedna-liczba-ulga-ikze` to `big-number`
  and the planned carousels to `carousel`, render with `og`, and look at them on a phone.
