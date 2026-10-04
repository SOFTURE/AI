---
change_id: blog-writing-skill
title: "Article writing skill"
status: backlog
roadmap_item: BL-7
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A writing skill shipped with the blog module and installed into the app, kept in sync with the gate's rules.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **BL-7** (roadmap `blog`, main since 2026-10-04):

> ### BL-7: Article writing skill
> - **Change ID:** `blog-writing-skill`
> - **Status:** ready
> - **Outcome:**
>   - a skill (`SKILL.md` plus references) in `@softure-ai/blog` that walks an agent through writing an article: brief, sources, structure, frontmatter, the gate, publish;
>   - `softure-blog skill install` copies it into the app's `.claude/skills/`, filled from the app's ruleset and voice;
>   - a sync test: every rule the gate enforces is named in the skill, and the skill names no rule the gate lacks.
> - **Prerequisites:** BL-6.
> - **Unknowns:** Whether the skill belongs in `@softure-ai/skills` (the external workflow package) instead; default: ship it with the blog module, since it depends on the module's rules.
> - **Risk:** low.
> - **Baseline:** FIRE `.claude/skills/blog-pisz/` and `src/lib/blog/quality/skill-sync.test.ts`. After: the skill installs into the example app and the sync test is green.
> - **PRD refs:** FR-30, NFR-6.
> - **Source (FIRE_TRACKER, read only):** `.claude/skills/blog-pisz/`, `src/lib/blog/quality/skill-sync.test.ts`

Reference material: [`docs/06-fire-extraction-2.md`](../../../../docs/06-fire-extraction-2.md) (the FIRE_TRACKER source map and the split rules),
[`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard). FIRE_TRACKER is read only:
copy its code, never change it.

## Constraints

- Exclusively owns: `modules/blog/skill/`, `modules/blog/src/cli/skill.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
