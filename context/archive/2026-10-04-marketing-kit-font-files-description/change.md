---
change_id: marketing-kit-font-files-description
title: "The marketing.json font files description admits subset files"
status: archived
roadmap_item: FU-29
branch: claude/fu-29-font-files-description-i3mims
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

A project reading the JSON Schema of `marketing.json` in its editor learns that `brand.fonts.*.files`
may list several subset files of one weight and style (Fontsource `latin` and `latin-ext`, each with
its `unicodeRange`), which both the film and the OG images use, instead of "one per weight and style".

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-29** (roadmap `followups`):

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

The backlog entry this change was opened from is [`backlog-input.md`](backlog-input.md).

## Notes

- Placement: roadmap `followups`, item FU-29 (taken from `context/backlog/roadmap-followups/`).
- Research: done (quick depth): what the film and the OG images do with several files of one weight and style.
- Framing skipped: the problem and the outcome are fixed by the roadmap (one `.describe()` text and the regenerated
  JSON Schema); there is one place to change and no alternatives to weigh.
- Archived 2026-10-04: the `brand.fonts.<kind>.files` description admits several subset files per weight and style
  and says how the film and OG images pick among them; the JSON Schema is regenerated.
