---
change_id: marketing-kit-og-subset-fonts
title: "OG images use every subset file of a weight"
status: backlog
roadmap_item: FU-22
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A brand that splits a font into subset files of one weight (Fontsource `latin` and `latin-ext`)
gets Polish copy drawn in OG images, not the missing-glyph error.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-22** (roadmap `followups`):

> ### FU-22: OG images use every subset file of a weight
> - **Change ID:** `marketing-kit-og-subset-fonts`
> - **Status:** proposed
> - **Outcome:** A brand font listing several files of one weight (e.g. Fontsource `latin` and `latin-ext`, split by `unicodeRange` for the video renderer) draws Polish copy in OG images too: each further file of a weight is registered with Satori so its fallback reaches it, at the requested weight.
> - **Unknowns:** Registering further files under derived family names (Satori falls back across families, not files) vs. merging; the order Satori tries them in; whether `unicodeRange` should steer the choice.
> - **Risk:** LOW.
> - **Baseline:** FU-17 `marketing-kit-og-glyphs`: Satori keeps one file per family, weight and style (the first), so such a brand gets the missing-glyph error; the README says to ship one covering file per weight. After: the `latin` + `latin-ext` brand renders Polish copy, covered by a render test and the glyph check.
> - **Source:** FU-17 plan review C1; `tools/marketing-kit/src/og/fonts.ts`

## Constraints

- Owns: `tools/marketing-kit/src/og/` (lane F, after FU-17).

## Notes
