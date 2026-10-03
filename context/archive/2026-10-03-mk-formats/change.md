---
change_id: mk-formats
title: "A film renders in 9:16, 1:1 or 16:9 from one recording"
status: archived
roadmap_item: MK-6
branch: claude/project-thread-9mamf6
created: 2026-10-03
updated: 2026-10-03
archived_at: 2026-10-03
---

## Intent

A project that uses `@softure-ai/marketing-kit` sets `format` per video in `marketing.json` to `9:16`,
`1:1` or `16:9`, and `softure-marketing render` produces an MP4 of that size. Frame size, where the phone
sits, the camera target, the caption box, the persona card and the end card all come from one per-format
geometry table, not from constants in the composition. A 9:16 film composes byte for byte as before.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MK-6).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **MK-6** (quoted in full in
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:**
>   - `format` per video: `9:16`, `1:1` or `16:9`.
>   - Frame size, device viewport placement, camera targets and caption layout come from a geometry table, not constants.
>   - The end card and persona card adapt per format.
> - **Unknowns:** whether 16:9 needs a desktop viewport recording or a framed phone; how captions wrap in 1:1.
> - **Baseline:** 9:16 output of MK-1 (composition snapshot). After: snapshots for all three formats, and 9:16 is unchanged.

Current state (MK-2, PR #35): `src/compose/timeline.ts` has `VIDEO_FORMATS = ["9:16"]`, a `Geometry`
built by `getGeometry(viewport)` from 9:16 constants, and `fitsFrame`. `src/compose/compose.ts` hard-codes
the caption box, persona card, end card and the end-card camera pose in px for a 1080×1920 frame.
`film.format` already exists in `FilmScript` and in the schema (`z.enum(VIDEO_FORMATS)`).

## Constraints

- Exclusively owns `tools/marketing-kit/src/compose/` and the geometry in `src/render/`.
- Must not touch `src/record/` (MK-3), `src/screenshot/` (MK-4), `src/voice/` (MK-7) or OG images (MK-5),
  all running in parallel. `src/config/schema.ts` and `schema/marketing.schema.json` are shared: keep the
  edit to the format enum and regenerate the JSON schema.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish; the owner tags releases.

## Notes

- Taken from `context/backlog/roadmap-marketing-kit/mk-formats/` on 2026-10-03 (roadmap promoted, MK-2 on master).
- Research and framing both run: research answers the two unknowns from the code; framing settles the
  16:9 shape (desktop recording vs. framed phone), which changes what the item delivers.
- Archived 2026-10-03: a film renders in 9:16, 1:1 or 16:9 from one recording, laid out by a per-format geometry table; 9:16 is byte-identical to the baseline.
