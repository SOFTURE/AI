---
change_id: marketing-kit-hook-shot-words
title: "Opening shots after the first name their word in the config check"
status: backlog
roadmap_item: FU-19
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project that writes several opening shots learns that every shot after the first needs a `word` when
`marketing.json` loads, at the key to fix, not after a paid recording when the film is composed.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-19** (roadmap `followups`, main since 2026-10-03):

> ### FU-19: Opening shots after the first name their word in the config check
> - **Change ID:** `marketing-kit-hook-shot-words`
> - **Status:** proposed
> - **Outcome:** A `videos[].hook.shots[]` entry after the first without `word` is refused when `marketing.json` loads, on the path `videos[i].hook.shots[j].word`, instead of failing at compose time after the recording with an error that names an empty word.
> - **Prerequisites:** FU-14 on `master` (shared files, see Order).
> - **Unknowns:** none.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-2 `mk-config-contract`: `word` is optional on every shot (`src/config/schema.ts`), and `src/compose/compose.ts` throws for a later shot without one. After: a config test refuses it, and the schema description says when it is required.
> - **PRD refs:** FR-24.
> - **Source:** FU-14 (`marketing-kit-schema-docs`) implementation review F2; `tools/marketing-kit/src/compose/compose.ts` (opening shots)

## Constraints

- Lane E: shares `tools/marketing-kit/src/config/schema.ts` and `schema/marketing.schema.json` with FU-16 and FU-18.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes
