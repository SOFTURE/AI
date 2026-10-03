---
change_id: marketing-kit-schema-docs
title: "The marketing.json JSON Schema documents every key"
status: implemented
roadmap_item: FU-14
branch: claude/project-thread-6sox1i
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project or an agent writing `marketing.json` against the published JSON Schema
(`tools/marketing-kit/schema/marketing.schema.json`) sees, in the editor, what every key means and what it
defaults to, without opening the package README. A test fails when a key without a description is added.

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

The gap was deferred from the MK-2 implementation review
([`impl-review.md` F9](../../archive/2026-10-03-mk-config-contract/reviews/impl-review.md)): "editors show field
names and types but no help text; the README carries the reference." The backlog entry this change was opened
from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: the descriptions in `tools/marketing-kit/src/config/schema.ts`,
  `tools/marketing-kit/src/config/actions-schema.ts` and `tools/marketing-kit/src/og/templates/schemas.ts`, the
  regenerated `tools/marketing-kit/schema/marketing.schema.json`, and `tools/marketing-kit/tests/schema.test.ts`.
- Lane E (roadmap Order): FU-16 (layout overrides) and FU-18 (screenshot variants) wait for this change on
  `master` and will add keys to the same schema; FU-15 follows FU-16. FU-17 (OG glyphs, lane F) works in
  `src/og/`; this change touches only the descriptions in `src/og/templates/schemas.ts`.
- No change in validation behaviour: the same documents pass and fail, with the same messages.
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent.

## Notes

- Placement: roadmap `followups`, item FU-14 (taken from `context/backlog/roadmap-followups/`).
- Framing skipped: the outcome is not bug-shaped, its scope is pinned by the roadmap item (every key, a
  description, a guarding test), and nothing in it questions whether the problem is the right one.
- Research done (quick depth): the one roadmap Unknown needs a probe of `z.toJSONSchema`.
