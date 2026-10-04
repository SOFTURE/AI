---
change_id: blog-writing-skill
title: "An agent writes blog texts with a skill generated from the app's quality gate"
status: archived
roadmap_item: BL-7
branch: claude/bl-7-0rg37c
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

An app that enables `@softure-ai/blog` runs `softure-blog skill install` and gets a writing skill in
`.claude/skills/blog-write/`: a procedure (question, sources, structure, frontmatter, draft, rewrite,
the gate, a sceptical second reader, publish) and references (structure, file template, the rules,
the reviewer's prompt). The skill is filled from the app's config: its language ruleset, voice
phrases, YMYL switch, limits, paths, content folder and plugin rules, each rule with its effective
severity. `softure-blog skill install --check` tells CI when the installed skill no longer matches
the config. A sync test keeps the shipped skill and the gate's catalog naming the same rules.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-7).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-7** (roadmap `blog`, main since 2026-10-04):

> ### BL-7: Article writing skill
> - **Outcome:**
>   - a skill (`SKILL.md` plus references) in `@softure-ai/blog` that walks an agent through writing an article: brief, sources, structure, frontmatter, the gate, publish;
>   - `softure-blog skill install` copies it into the app's `.claude/skills/`, filled from the app's ruleset and voice;
>   - a sync test: every rule the gate enforces is named in the skill, and the skill names no rule the gate lacks.
> - **Unknowns:** Whether the skill belongs in `@softure-ai/skills` (the external workflow package) instead; default: ship it with the blog module, since it depends on the module's rules.
> - **Risk:** low.
> - **Baseline:** FIRE `.claude/skills/blog-pisz/` and `src/lib/blog/quality/skill-sync.test.ts`. After: the skill installs into the example app and the sync test is green.

Coordinator brief (2026-10-04): only BL-7; BL-4 (pages) runs in parallel in another thread and adds
`blog()` to the example app. BL-6 left `listQualityRules(getQualitySettings(config))` for this item:
rule id, group, effective severity, description.

## Constraints

- Exclusively owns: `modules/blog/skill/`, `modules/blog/src/cli/skill.ts`. Touches `cli/run.ts`
  (the command), `package.json` (`files`), README and tests.
- English-only code, comments, commits and skill text (AGENTS.md). The skill tells the agent which
  language the articles are written in.
- FIRE_TRACKER is read only: its skill is adapted, never changed there.
- No release, tag or publish by the agent; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items, not fixed here.

## Notes

- Research done: it answers the unknown, separates FIRE's generic procedure from its domain and
  settles how the skill is filled and checked.
- Framing skipped: the problem is not in doubt. The roadmap names the outcome, the source and the
  baseline; the open points are design choices that research settles.
- Archived 2026-10-04: `@softure-ai/blog` ships an article writing skill (`skill/`: `SKILL.md` plus structure, template, rules and reviewer references, adapted from FIRE's `blog-pisz`); `softure-blog skill install` fills it from the app's blog config into `.claude/skills/blog-write/`, listing exactly the gate's rules with their effective severity, and `--check` reports drift for CI; a two-way sync test keeps the templates and `listQualityRules` in step. Gap BF-7.
