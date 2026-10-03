---
change_id: marketing-kit-layout-overrides
title: "A project can adjust a format's layout in marketing.json"
status: preparing
roadmap_item: FU-16
branch: claude/project-thread-92jg14
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project tunes how its films are laid out without forking the package: `marketing.json` can override entries of
the per-format layout table (caption box and font size, persona card position, end-card position and headline size,
the end-card phone pose), the schema refuses values that do not fit the frame, and a film composed with an override
differs from the default exactly where the override says. Without overrides every film composes byte for byte as
before.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-16** (roadmap `followups`, main since 2026-10-03):

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

The gap is framing 3 of the MK-6 frame ([`frame.md`](../../archive/2026-10-03-mk-formats/frame.md)): "Geometry in
`marketing.json`. Let a project override the table. Nobody asked for it yet; the table can be exposed later without
breaking the contract." The backlog entry this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: a `layout` section in `tools/marketing-kit/src/config/schema.ts`, the regenerated
  `tools/marketing-kit/schema/marketing.schema.json`, and the merge of overrides into `getGeometry`
  (`tools/marketing-kit/src/compose/timeline.ts`).
- Lane E (roadmap Order): FU-15 (desktop 16:9) follows this change in `src/compose/`; FU-18 and FU-19 add keys to the
  same `schema.ts` later. This change must not do their work.
- The 9:16, 1:1 and 16:9 composition snapshots (`tests/snapshots/film-*.html`) stay byte for byte without overrides.
- Every new schema key carries a `.describe()` (`tests/schema.test.ts`); cross-field rules name their path.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent; the owner tags releases.

## Notes

- Placement: roadmap `followups`, item FU-16 (taken from `context/backlog/roadmap-followups/`).
- Research: done (quick depth), it answers the two roadmap Unknowns from the code.
- Framing skipped: this item *is* framing 3 of the MK-6 frame (`archive/2026-10-03-mk-formats/frame.md`), which already
  checked the premise (the layout is a table the composition reads, nothing in the recording depends on it); the
  remaining questions are which keys and at what scope, which research answers from the code, not a choice between
  problems.
