---
change_id: blog-skill-check-without-database
title: "softure-blog skill install without a database URL"
status: planned
roadmap_item: BF-13
branch: claude/project-thread-fjndju
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-blog skill install` (and its `--check`, which an app runs in CI) loads an app config whose
database URL is missing or empty, since rendering the skill never connects to the database, as `check`
does since BF-6. A reviewer checks that the bin's `skill install` and `skill install --check` run over a
fixture config whose `database.url` comes from an unset variable, and that `publish` with the same config
still refuses it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-13, taken 2026-10-05).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-13**:

> - **Outcome:** the blog bin loads the config with `database: "optional"` for `skill install` as it does for `check`; a bin test runs `skill install --check` over a config without a database URL.
> - **Risk:** low. A CI job that runs `skill install --check` passes a placeholder `DATABASE_URL` today; nothing connects.
> - **Source:** BF-6 `blog-check-without-database` plan review S1.

BF-6 (PR #92) is on `master`: `@softure-ai/core/cli`'s `loadAppConfig` takes `database: "optional"`, and
`@softure-ai/core` exports `withDatabaseOptional` for app scripts.

Coordinator brief (2026-10-05): only BF-13, lane A; BF-2, BF-8 and BF-11 run in parallel; gaps go to the
roadmap from the next free `BF-` number on `master`.

## Constraints

- Owns: `modules/blog/src/cli/command.ts`, `modules/blog/tests/cli.test.ts`, the blog README's command
  paragraphs.
- `softure-blog publish` keeps requiring a database exactly as today.
- English-only code, comments and commits (AGENTS.md).

## Notes

- Placement: main roadmap blog-followups, item BF-13 (work now).
- Research skipped: the mechanism exists (BF-6's loader option) and `runSkillInstall` reads only the
  config's blog options (`renderBlogSkill`), never `config.database`; the BF-6 research and plan review S1
  already established both.
- Framing skipped: the problem and the outcome are fixed by the roadmap item; there is one shape (the
  same option for one more command).
