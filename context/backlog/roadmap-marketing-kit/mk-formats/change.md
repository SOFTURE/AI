---
change_id: mk-formats
title: "Render formats 1:1 and 16:9"
status: backlog
roadmap_item: MK-6
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- `format` per video: `9:16`, `1:1` or `16:9`.
- Frame size, device viewport placement, camera targets and caption layout come from a geometry table, not constants.
- The end card and persona card adapt per format.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MK-6** (roadmap `marketing-kit`, main since 2026-10-03):

> ### MK-6: Render formats 1:1 and 16:9
> - **Change ID:** `mk-formats`
> - **Status:** ready
> - **Outcome:**
>   - `format` per video: `9:16`, `1:1` or `16:9`.
>   - Frame size, device viewport placement, camera targets and caption layout come from a geometry table, not constants.
>   - The end card and persona card adapt per format.
> - **Prerequisites:** MK-2.
> - **Unknowns:** whether 16:9 needs a desktop viewport recording or a framed phone; how captions wrap in 1:1.
> - **Risk:** low.
> - **Baseline:** 9:16 output of MK-1 (composition snapshot). After: snapshots for all three formats, and 9:16 is unchanged.
> - **PRD refs:** FR-24.

Reference material: [`docs/03-marketing-kit.md`](../../../../docs/03-marketing-kit.md) (architecture, JSON contract, licenses), PRD FR-24 and FR-25, and the source in FIRE_TRACKER `video/**`, `scripts/screenshot.mts`, `src/app/**/opengraph-image.tsx`.

## Constraints

- Exclusively owns: `tools/marketing-kit/src/compose/` and `src/render/` geometry.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
