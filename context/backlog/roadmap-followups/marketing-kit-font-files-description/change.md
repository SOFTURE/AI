---
change_id: marketing-kit-font-files-description
title: "The marketing.json font files description admits subset files"
status: backlog
roadmap_item: FU-29
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A project reading the JSON Schema of `marketing.json` in its editor learns that `brand.fonts.*.files`
may list several subset files of one weight and style (Fontsource `latin` and `latin-ext`, each with
its `unicodeRange`), which both the film and the OG images use, instead of "one per weight and style".

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-29** (roadmap `followups`):

> ### FU-29: The marketing.json font files description admits subset files
> - **Change ID:** `marketing-kit-font-files-description`
> - **Status:** proposed
> - **Outcome:** The `.describe()` of `brand.fonts.<kind>.files` in `tools/marketing-kit/src/config/schema.ts` says the files cover weights and styles and that one weight and style may take several subset files, tried in the listed order (OG images) or chosen by `unicodeRange` (the film); `schema/marketing.schema.json` is regenerated.
> - **Risk:** LOW. Documentation only; the description today steers a project away from the subset setup FU-23 supports.
> - **Baseline:** FU-23 `marketing-kit-og-subset-fonts`: OG images use every subset file of a weight; the schema still says "The files of the family, one per weight and style". After: the description matches, the schema drift test passes.
> - **Source:** FU-23 (lane F could not touch `schema.ts`, lane E owns it); `tools/marketing-kit/src/config/schema.ts` (`files` of the brand font)

## Constraints

- Owns: `tools/marketing-kit/src/config/schema.ts` (the one description), `schema/marketing.schema.json` (lane E).

## Notes
