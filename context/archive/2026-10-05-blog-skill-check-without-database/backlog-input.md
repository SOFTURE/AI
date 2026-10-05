---
change_id: blog-skill-check-without-database
title: "softure-blog skill install without a database URL"
status: backlog
roadmap_item: BF-13
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`softure-blog skill install` (and its `--check`, which a CI job runs) loads an app config whose database
URL is missing or empty, since rendering the skill never connects to the database, like `check` since BF-6.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-13**:

> ### BF-13: softure-blog skill install without a database URL
> - **Change ID:** `blog-skill-check-without-database`
> - **Status:** proposed
> - **Outcome:** the blog bin loads the config with `database: "optional"` for `skill install` as it does for `check`; a bin test runs `skill install --check` over a config without a database URL.
> - **Risk:** low. A CI job that runs `skill install --check` passes a placeholder `DATABASE_URL` today; nothing connects.
> - **Mode:** autonomous.
> - **Source:** BF-6 `blog-check-without-database` plan review S1.

## Constraints

- English-only code, comments and commits (AGENTS.md).
- Lane A file (`modules/blog/src/cli/command.ts`); BF-9 changes the skill install in lane E, not the loading.

## Notes
