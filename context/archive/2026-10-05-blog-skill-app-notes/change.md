---
change_id: blog-skill-app-notes
title: "The app's own sections in the generated writing skill"
status: archived
roadmap_item: BF-9
branch: claude/project-thread-l5kwsp
created: 2026-10-05
updated: 2026-10-05
archived_at: 2026-10-05
---

## Intent

An app adds its own procedure to the generated writing skill (where its numbers come from, its block
plugins, its frontmatter fields), and `softure-blog skill install` keeps it across reinstalls, so an app
such as FIRE_TRACKER needs no second skill next to `blog-write`. `skill install --check` covers those
sections like the rest of the skill.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups, main since 2026-10-05), item **BF-9**:

> ### BF-9: The app's own sections in the generated writing skill
> - **Change ID:** `blog-skill-app-notes`
> - **Outcome:** the generated skill carries the app's own sections, from an option such as `blog({ skill: { notes } })` or from a local file the install preserves; FIRE_TRACKER's engine numbers, calculator scenario and chart block fit there; `--check` covers them.
> - **Risk:** low. Today an app keeps such guidance in a second skill of its own.
> - **Source:** BL-7 `blog-writing-skill` research, "Gaps".

Current state: `modules/blog/src/cli/skill.ts` renders the templates of `modules/blog/skill/` from the
app's blog config; `runSkillInstall` in `src/cli/run.ts` overwrites the folder it generated (marker in
`SKILL.md`) and `--check` compares each rendered file with the folder. The app has no way to add text:
every file is regenerated. The backlog entry is [`backlog-input.md`](backlog-input.md).

## Constraints

- Lane E owns `modules/blog/src/cli/skill.ts` and `modules/blog/skill/`; `src/options.ts`, `src/cli/run.ts`
  and the blog README are shared with other lanes (master wins on conflicts).
- The install still never overwrites a skill the app wrote itself, and stays deterministic (a reinstall
  with the same config changes nothing).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent;
  `@softure-ai/blog` is unpublished, so the change rides its first publish (BL-8).

## Notes

- Placement: roadmap `blog-followups`, item BF-9 (taken from `context/backlog/roadmap-blog-followups/`).
- Research: quick depth, choosing between a config option and a preserved local file.
- Framing skipped: the problem is not in doubt (the roadmap names the outcome and two candidate shapes);
  the only open question is which shape, and research answers it.
- Archived 2026-10-05: `blog({ skill: { sections } })` adds the app's own sections to the generated writing skill (`references/app.md`, named in `SKILL.md`); install keeps them across reinstalls and removes a Markdown file the config no longer gives, `--check` covers both; no new gaps.
