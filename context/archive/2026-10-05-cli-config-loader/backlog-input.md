---
change_id: cli-config-loader
title: "Module commands load the app config through one shared loader"
status: backlog
roadmap_item: BF-1
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

`softure migrate`, `softure-mail` and `softure-blog` find and load `softure.config` through one function
(default file names, `--config`, the error texts), so a fix or a new config file name lands once.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (blog-followups), item **BF-1**:

> ### BF-1: One config loader for module commands
> - **Change ID:** `cli-config-loader`
> - **Status:** ready
> - **Outcome:** `findDefaultConfig`, `takeConfigOption` and `loadConfig` live once (in `@softure-ai/core` or `@softure-ai/db`) and the three bins use them; their tests keep the same messages.
> - **Risk:** low. Three copies of about 60 lines that have not drifted yet.
> - **Source:** BL-2 `blog-content-store` impl review R1: `modules/blog/src/cli/command.ts` copies `modules/mailing/src/cli/command.ts`, which copies `foundation/db/src/cli/command.ts`.

## Constraints

- English-only code, comments and commits (AGENTS.md).

## Notes
