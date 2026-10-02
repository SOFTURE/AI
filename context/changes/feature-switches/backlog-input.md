---
change_id: feature-switches
title: "Feature switches module"
status: backlog
roadmap_item: ID-6
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/feature-switches`, consisting of:
- table `features.switches(name, enabled, updated_at, updated_by)`;
- a registry of switches declared by the app and by modules (name, label, description, default,
  `failMode: open|closed`, env override);
- `isEnabled(name)` and `setSwitch`;
- a generic admin panel listing every declared switch, guarded by `requireRole("admin")` from
  ID-4; the module refuses to mount the panel without an authorization hook;
- pl + en messages, unit tests and e2e.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **ID-6** (roadmap `identity`):

> ### ID-6: Feature switches module
> - **Change ID:** `feature-switches`
> - **Status:** ready
> - **Outcome:** `@softure-ai/feature-switches`, consisting of:
>   - table `features.switches(name, enabled, updated_at, updated_by)`;
>   - a registry of switches declared by the app and by modules (name, label, description, default,
>     `failMode: open|closed`, env override);
>   - `isEnabled(name)` and `setSwitch`;
>   - a generic admin panel listing every declared switch, guarded by `requireRole("admin")` from
>     ID-4; the module refuses to mount the panel without an authorization hook;
>   - pl + en messages, unit tests and e2e.
> - **Prerequisites:** ID-4.
> - **Unknowns:** caching of switch reads per request; how modules declare switches (manifest vs.
>   runtime); audit of who changed what (the `updated_by` column is enough for v1?).
> - **Risk:** medium. A wrong default can lock an app.
> - **Baseline:** source behaviour in FIRE_TRACKER (`src/db/feature-switches.ts` and its tests).
>   After: the same behaviour plus admin-only access, tested.
> - **PRD refs:** FR-14, NFR-5.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: `modules/feature-switches/`, `examples/next-app/e2e/feature-switches.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
