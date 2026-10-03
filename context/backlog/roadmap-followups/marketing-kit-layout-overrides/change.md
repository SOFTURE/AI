---
change_id: marketing-kit-layout-overrides
title: "A project can adjust a format's layout in marketing.json"
status: backlog
roadmap_item: FU-16
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project tunes how its films are laid out without forking the package.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-16** (roadmap `followups`, main since 2026-10-03):

> ### FU-16: A project can adjust a format's layout in marketing.json
> - **Change ID:** `marketing-kit-layout-overrides`
> - **Status:** proposed
> - **Outcome:** `marketing.json` can override entries of the per-format geometry table (caption box and font size, persona and end-card position, end-card phone pose), validated by the schema, so a brand with long headlines or another caption style does not need a package change.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Which entries are worth exposing; whether overrides are per video or per format.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-6 `mk-formats`: the layout is a fixed table in `src/compose/timeline.ts` (frame.md, framing 3 deferred). After: an override in the fixture config changes the composition snapshot.
> - **PRD refs:** FR-24.
> - **Source:** `tools/marketing-kit/src/compose/timeline.ts` (`LAYOUTS`); `context/archive/2026-10-03-mk-formats/frame.md`

## Constraints

- Exclusively owns: a `layout` section in `tools/marketing-kit/src/config/schema.ts`, the regenerated JSON Schema, and the merge into `getGeometry`.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes
