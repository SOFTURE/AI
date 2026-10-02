---
change_id: auth-roles
title: "Roles and admin"
status: backlog
roadmap_item: ID-4
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

table `auth.user_roles`, `requireRole(role)` for pages, actions and route handlers,
and `hasRole` for UI. The admin role is granted by configuration (an initial admin list) or by a
CLI command. Every admin-only surface fails closed when no admin is configured. Includes tests that
a non-admin gets "not found" on admin pages and a refusal on admin actions.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **ID-4** (roadmap `identity`):

> ### ID-4: Roles and admin
> - **Change ID:** `auth-roles`
> - **Status:** ready
> - **Outcome:** table `auth.user_roles`, `requireRole(role)` for pages, actions and route handlers,
>   and `hasRole` for UI. The admin role is granted by configuration (an initial admin list) or by a
>   CLI command. Every admin-only surface fails closed when no admin is configured. Includes tests that
>   a non-admin gets "not found" on admin pages and a refusal on admin actions.
> - **Prerequisites:** ID-3.
> - **Unknowns:** whether roles are flat strings or a small enum declared by modules; how an app
>   bootstraps the first admin safely (config list vs. CLI); how this supersedes FIRE_TRACKER's
>   interim admin allowlist (see ID-9).
> - **Risk:** medium. Security-relevant defaults.
> - **Baseline:** the source app has no role concept. After: role checks covered by unit and e2e tests.
> - **PRD refs:** FR-13, NFR-5.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: role files and migrations in `modules/auth/`, `examples/next-app/e2e/auth-roles.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
