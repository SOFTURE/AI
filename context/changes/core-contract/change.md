---
change_id: core-contract
title: "Module contract in @softure-ai/core"
status: new
roadmap_item: FD-3
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`defineSoftureConfig` (zod-validated), `defineModule` (manifest, dependencies, migrations, routes, switches, privacy contributors), `Result<T, ErrorCode>`, `Clock`, messages with `pl`/`en` dictionaries and partial overrides, `locale`/`timezone`, and a `safeError` helper, with unit tests and a README per docs/02 §11.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-3** (roadmap `foundation`):

> ### FD-3: Module contract in @softure-ai/core
> - **Change ID:** `core-contract`
> - **Status:** ready
> - **Outcome:** `defineSoftureConfig` (zod-validated), `defineModule` (manifest, dependencies,
>   migrations, routes, switches, privacy contributors), `Result<T, ErrorCode>`, `Clock`,
>   messages with `pl`/`en` dictionaries and partial overrides, `locale`/`timezone`, and a
>   `safeError` helper, with unit tests and a README per docs/02 §11.
> - **Prerequisites:** FD-1.
> - **Unknowns:** how server actions read the registered config (docs/02 §8, global registry vs.
>   explicit import); the shape of `module.json` vs. the TS manifest (single source of truth).
> - **Risk:** high. Every module depends on this contract.
> - **Baseline:** none. After: a dummy module defined, validated and listed in a test app config.
> - **PRD refs:** FR-3, FR-4, NFR-6.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `foundation/core/`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
