---
change_id: marketing-kit-schema-docs
title: "The marketing.json JSON Schema documents every key"
status: backlog
roadmap_item: FU-14
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project or an agent writing `marketing.json` with the published JSON Schema sees, in the editor, what
every key means and what it defaults to, without opening the package README.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-14** (roadmap `followups`, main since 2026-10-03):

> ### FU-14: The marketing.json JSON Schema documents every key
> - **Change ID:** `marketing-kit-schema-docs`
> - **Status:** proposed
> - **Outcome:** Every key of `tools/marketing-kit/schema/marketing.schema.json` carries a `description` (from `.describe()` on the zod schema instead of doc comments), so editors and agents writing a `marketing.json` see what each key means and its default.
> - **Prerequisites:** none beyond the main branch; best after MK-3…MK-7 have added their keys.
> - **Unknowns:** Whether `z.toJSONSchema` keeps descriptions on keys wrapped in `.default()` and `.prefault()`.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-2 `mk-config-contract`: the schema has types, patterns and defaults but no descriptions; the meaning lives in doc comments in `src/config/schema.ts` and the README table. After: a test checks that every property has a description.
> - **PRD refs:** FR-24.
> - **Source:** `tools/marketing-kit/src/config/schema.ts`; `context/archive/2026-10-03-mk-config-contract/reviews/impl-review.md`

## Constraints

- Exclusively owns: `tools/marketing-kit/src/config/schema.ts` descriptions and the regenerated `schema/marketing.schema.json`.
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes
