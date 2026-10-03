---
change_id: marketing-kit-og-glyphs
title: "OG images refuse copy the brand fonts cannot draw"
status: archived
roadmap_item: FU-17
branch: claude/project-thread-l02pfg
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

`softure-marketing og` (and a Next route calling `renderOgImage`) stops with the image id, the JSON
path and the characters when the copy of a card holds a character none of the loaded OG fonts can
draw, instead of rendering a card with gaps. A project sees it the first time it renders Polish copy
with a `latin` subset font.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-17).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-17** (roadmap `followups`):

> - **Outcome:** Before laying out an OG card, the renderer checks every character of the template's text against the loaded fonts' character maps and returns an error naming the image, the JSON path and the missing characters (e.g. Polish letters with a `latin` subset file).
> - **Unknowns:** Whether Satori exposes its parsed fonts or the check needs its own font parser (opentype.js is already a Satori dependency); how emoji should be treated.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-5 `mk-og-images`: Satori draws nothing for a missing glyph and reports no error; the README tells projects to ship fonts that cover their language. After: a test with a `latin` subset font and Polish copy gets the error.

The gap was found in MK-5 (`context/archive/2026-10-03-mk-og-images/research.md`, Constraints and
risks; `reviews/impl-review.md`).

## Constraints

- Exclusively owns: `tools/marketing-kit/src/og/` and its tests, the OG section of the README.
- `tools/marketing-kit/src/config/schema.ts` stays untouched (lane E: FU-16, FU-18 wait on it).
- Parallel: FU-5 (analytics), FU-9 (billing), FU-13 (`ci.yml`, marketing-kit render). No shared files
  beyond `context/` rows.
- English-only code; no release, tag or publish (owner).

## Notes

- Framing skipped: the problem, the outcome and the test are stated by the roadmap item and the MK-5
  review; the two unknowns are technical and research settles them.
- Archived 2026-10-03: OG images refuse copy no font Satori would try can draw, naming the image, the JSON path and the characters; subset files of one weight filed as FU-23.
