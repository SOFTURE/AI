---
change_id: example-app
title: "Example app and e2e harness"
status: archived
roadmap_item: FD-7
branch: claude/fd-7-example-app-uknuk7
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02
---

## Intent

`examples/next-app` (Next 16) consuming core, db and ui through `softure.config.ts`,
running migrations on Postgres in Docker, with Playwright e2e in `.github/workflows/e2e.yml`.
This is the harness every later module adds scenarios to. Sets `integration.local` in
`context/workflow.json` to the e2e command, so orchestrators run it before READY.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-7** (roadmap `foundation`):

> ### FD-7: Example app and e2e harness
> - **Change ID:** `example-app`
> - **Status:** ready
> - **Outcome:** `examples/next-app` (Next 16) consuming core, db and ui through `softure.config.ts`,
>   running migrations on Postgres in Docker, with Playwright e2e in `.github/workflows/e2e.yml`.
>   This is the harness every later module adds scenarios to. Sets `integration.local` in
>   `context/workflow.json` to the e2e command, so orchestrators run it before READY.
> - **Prerequisites:** FD-4, FD-6.
> - **Unknowns:** workspace linking vs. packed tarballs in e2e (packed is closer to real consumers).
> - **Risk:** low.
> - **Baseline:** none. After: e2e green in CI with theme switch, a modal and a migration check.
> - **PRD refs:** FR-9, NFR-2.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `examples/next-app/`, `.github/workflows/e2e.yml`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

Archived 2026-10-02: examples/next-app runs core, db and ui as packed packages with six Playwright tests in the e2e workflow; integration.local is npm run e2e.
