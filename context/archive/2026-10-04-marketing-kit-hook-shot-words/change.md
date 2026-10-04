---
change_id: marketing-kit-hook-shot-words
title: "Opening shots after the first name their word in the config check"
status: archived
roadmap_item: FU-19
branch: claude/fu-19-8dscst
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

A project that writes several opening shots learns that every shot after the first needs a `word` when
`marketing.json` loads, at the key to fix (`videos[i].hook.shots[j].word`), not after a paid recording when the
film is composed.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-19** (roadmap `followups`, main since 2026-10-03):

> ### FU-19: Opening shots after the first name their word in the config check
> - **Outcome:** A `videos[].hook.shots[]` entry after the first without `word` is refused when `marketing.json` loads, on the path `videos[i].hook.shots[j].word`, instead of failing at compose time after the recording with an error that names an empty word.
> - **Unknowns:** none.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-2 `mk-config-contract`: `word` is optional on every shot (`src/config/schema.ts`), and `src/compose/compose.ts` throws for a later shot without one. After: a config test refuses it, and the schema description says when it is required.

The gap is F2 of the FU-14 implementation review (`marketing-kit-schema-docs`). The backlog entry this change was
opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Lane E (roadmap Order): shares `tools/marketing-kit/src/config/schema.ts` and `schema/marketing.schema.json` with
  FU-15 (next in the lane); this change touches only the video `hook` check.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent; the owner tags releases.

## Notes

- Placement: roadmap `followups`, item FU-19 (taken from `context/backlog/roadmap-followups/`).
- Research: done (quick depth): where the check belongs and what compose does with the first shot's word.
- Framing skipped: the problem and the outcome are fixed by the roadmap (path, timing, description); there is one
  reasonable place for the check (the video `superRefine` that already checks shot words), so there are no
  alternatives to weigh.
- Archived 2026-10-04: a later opening shot without `word` is refused at load on `videos[i].hook.shots[j].word`; a
  one-shot opening needs none; the JSON Schema is unchanged (the description already stated the rule).
