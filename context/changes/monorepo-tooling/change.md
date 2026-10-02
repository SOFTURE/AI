---
change_id: monorepo-tooling
title: "Monorepo tooling and gates"
status: new
roadmap_item: FD-1
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`npm ci && npm run typecheck && npm run lint && npm test` works at the root over all workspaces; each package builds ESM + `.d.ts` (tsup) and, where it has styles, compiled CSS; `.github/workflows/ci.yml` runs the gates on push and PR; `context/workflow.json` gates point at the real scripts; a package template (`templates/package/`) matches docs/02 §2.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-1** (roadmap `foundation`):

> ### FD-1: Monorepo tooling and gates
> - **Change ID:** `monorepo-tooling`
> - **Status:** ready
> - **Outcome:** `npm ci && npm run typecheck && npm run lint && npm test` works at the root over
>   all workspaces; each package builds ESM + `.d.ts` (tsup) and, where it has styles, compiled CSS;
>   `.github/workflows/ci.yml` runs the gates on push and PR; `context/workflow.json` gates point
>   at the real scripts; a package template (`templates/package/`) matches docs/02 §2.
> - **Prerequisites:** none.
> - **Unknowns:** tsup vs. tsc-only builds for server-only code; how to run architecture tests
>   (docs/02 §5) once for all packages; how NODE_ENV=production on the owner's machine affects `npm ci`.
> - **Risk:** low. Wrong choices are cheap to change before any package ships.
> - **Baseline:** no build exists. After: all four commands green on an empty package.
> - **PRD refs:** FR-1, NFR-1, NFR-3, NFR-6.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `package.json`, `tsconfig*.json`, `eslint.config.*`, `vitest.config.*`, `.github/workflows/ci.yml`, `templates/package/`, `context/workflow.json` (gates).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
