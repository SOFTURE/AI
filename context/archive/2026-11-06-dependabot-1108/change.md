---
change_id: dependabot-1108
title: "deps: Dependabot #1108 (Tailwind 4.3.4, hyperframes 0.9.6) without the known breaking bumps"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-ti6gcw
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Land Dependabot #1108 (npm minor/patch group, 7 updates). It is red on typecheck + lint, two unit shards and the
theme-notion coverage job, so it becomes a change of its own (AGENTS.md, Dependabot pull requests). Outcome: the
updates that pass land, the ones known to break stay held with their reason, #1108 is closed when this merges, and the
changed package rides the next combined release.

## Notes

- Research skipped: each held update was already measured in dependabot-2026-11-05 (satori 0.63 breaks the OG render
  tests, typescript-eslint 8.72 runs the typed lint out of memory at CI's heap), and the forwarded-parse pin is recorded
  in `foundation/observability/tests/standalone-tracing.test.ts`.

## Done

- Tailwind 4.3.4 (`@tailwindcss/cli`, `@tailwindcss/node`, `tailwindcss`) and hyperframes 0.9.6 (`HYPERFRAMES_VERSION`
  follows), hyperframes rehoisted so the root undici override reaches it; `npm audit --omit=dev`: 0 vulnerabilities.
- Held: satori 0.35.1, typescript-eslint ~8.71, forwarded-parse 2.1.2 (the version `instrumentation-http` pins).
- `@softure-ai/marketing-kit` carries an `## Unreleased` entry and rides the next combined release.
