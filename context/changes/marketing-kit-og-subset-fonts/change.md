---
change_id: marketing-kit-og-subset-fonts
title: "OG images use every subset file of a weight"
status: implementing
roadmap_item: FU-23
branch: claude/fu-23-og-subset-fonts-m8zb8g
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A brand that splits a font into subset files of one weight (Fontsource `latin` and `latin-ext`,
listed next to each other in `brand.fonts`) gets its Polish copy drawn in OG images, at the weight
the template asks for, instead of the missing-glyph error FU-17 gives today. A card whose text
would still be drawn with no glyph, or only with another weight's file, keeps being refused.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-23).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-23** (roadmap `followups`):

> - **Outcome:** A brand font listing several files of one weight (e.g. Fontsource `latin` and `latin-ext`, split by `unicodeRange` for the video renderer) draws Polish copy in OG images too: each further file of a weight is registered with Satori so its fallback reaches it, at the requested weight.
> - **Unknowns:** Registering further files under derived family names (Satori falls back across families, not files) vs. merging; the order Satori tries them in; whether `unicodeRange` should steer the choice.
> - **Risk:** LOW.
> - **Baseline:** FU-17 `marketing-kit-og-glyphs`: Satori keeps one file per family, weight and style (the first), so such a brand gets the missing-glyph error; the README says to ship one covering file per weight. After: the `latin` + `latin-ext` brand renders Polish copy, covered by a render test and the glyph check.

Current state: `loadFamily` (`tools/marketing-kit/src/og/fonts.ts`) registers every file under the
brand family name; `findMissingGlyphs` (`src/og/glyphs.ts`) mirrors Satori's one-file-per-family
choice; `checkGlyphs` (`src/og/render.ts`) and the README's OG "Fonts" paragraph tell the user a
second subset file of a weight is not used. Found in the FU-17 plan review (C1,
`context/archive/2026-10-03-marketing-kit-og-glyphs/reviews/plan-review.md`).

## Constraints

- Exclusively owns: `tools/marketing-kit/src/og/` and its tests (`tests/og/`), the OG section of
  `tools/marketing-kit/README.md` (lane F, after FU-17).
- `tools/marketing-kit/src/config/schema.ts` stays untouched (lane E items touch it).
- English-only code; Polish test letters as `\u` escapes (language gate). No release, tag or
  publish (owner, MK-8).

## Notes

- Research: kept short (Satori 0.35 font loader read from its source map); it settles the three
  unknowns of the item.
- Framing skipped: the problem, the outcome and the test are stated by the roadmap item and the
  FU-17 plan review; the open questions are technical and research answers them.
