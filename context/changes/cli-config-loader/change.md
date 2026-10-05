---
change_id: cli-config-loader
title: "Module commands load the app config through one shared loader"
status: plan_reviewed
roadmap_item: BF-1
branch: claude/project-thread-8l3eyw
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure migrate` (`@softure-ai/db`), `softure-mail` (`@softure-ai/mailing`) and `softure-blog`
(`@softure-ai/blog`) find and load the app's `softure.config.*` through one shared implementation: the
default file names, the `--config` option and every error text live once, so a fix or a new config file
name lands in one place. A reviewer checks that the three `cli/command.ts` files no longer define
`takeConfigOption`, `findDefaultConfig` or `loadConfig`, and that the three bins' existing tests pass
unchanged.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BF-1, taken 2026-10-05).

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups, main since 2026-10-05), item **BF-1**:

> - **Outcome:** `findDefaultConfig`, `takeConfigOption` and `loadConfig` live once (in `@softure-ai/core` or `@softure-ai/db`) and the three bins use them; their tests keep the same messages.
> - **Risk:** low. Three copies of about 60 lines that have not drifted yet.
> - **Source:** BL-2 `blog-content-store` impl review R1.

Current state: `foundation/db/src/cli/command.ts`, `modules/mailing/src/cli/command.ts` and
`modules/blog/src/cli/command.ts` each hold a copy of `DEFAULT_CONFIG_FILES`, `takeConfigOption`,
`findDefaultConfig`, `loadConfig` and `isConfigLike`. The copies differ only in the app-script hint of the
"cannot load" message and in db's `isConfigLike`, which does not require a `database` key.

Coordinator brief (2026-10-05): only BF-1, lane A; BF-6 (`blog-check-without-database`) follows it in the
same lane.

## Constraints

- Owns: the three `cli/command.ts` files, a new `cli` entry in `foundation/core/`, their tests and READMEs.
- Must not touch the commands' own logic (`cli/run.ts` of each package) or their messages. The database
  requirement of `softure-blog check` is BF-6, not this change.
- English-only code, comments and commits (AGENTS.md). Gaps found on the way go to the blog-followups
  roadmap as `BF-` items, not fixed here.

## Notes

- Placement: main roadmap blog-followups, item BF-1 (work now).
- Framing skipped: the problem (three identical copies) and the outcome are fixed by the roadmap item
  and the impl review that found it; there is no doubt about the problem itself. A short research maps
  the copies and their differences.
