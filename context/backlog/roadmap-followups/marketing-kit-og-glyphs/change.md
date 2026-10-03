---
change_id: marketing-kit-og-glyphs
title: "OG images refuse copy the brand fonts cannot draw"
status: backlog
roadmap_item: FU-17
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`softure-marketing og` stops with the image id, the JSON path and the characters when the copy in
`data` holds a glyph none of the brand's OG fonts contains, instead of rendering a card with gaps.

## Context

From [`roadmap-followups.md`](../../../foundation/roadmaps/roadmap-followups.md), item **FU-17** (queued roadmap `followups`):

> ### FU-17: OG images refuse copy the brand fonts cannot draw
> - **Change ID:** `marketing-kit-og-glyphs`
> - **Status:** proposed
> - **Outcome:** Before laying out an OG card, the renderer checks every character of the template's text against the loaded fonts' character maps and returns an error naming the image, the JSON path and the missing characters (e.g. Polish letters with a `latin` subset file).
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether Satori exposes its parsed fonts or the check needs its own font parser (opentype.js is already a Satori dependency); how emoji should be treated.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-5 `mk-og-images`: Satori draws nothing for a missing glyph and reports no error; the README tells projects to ship fonts that cover their language. After: a test with a `latin` subset font and Polish copy gets the error.
> - **PRD refs:** FR-25.
> - **Source:** `tools/marketing-kit/src/og/fonts.ts`; `context/archive/2026-10-03-mk-og-images/research.md` (Constraints and risks)

## Constraints

- Exclusively owns: `tools/marketing-kit/src/og/`.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes
