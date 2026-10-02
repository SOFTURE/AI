---
change_id: auth-password-reset
title: "Password reset by token"
status: backlog
roadmap_item: ID-5
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

- table `auth.password_resets` (only the token hash stored, single use, expiring);
- a request page that never reveals whether the email exists, and a reset page;
- rate limits on both;
- existing sessions invalidated on reset;
- a `sendPasswordReset(link, user)` hook the app implements. A console/dev sender is provided,
  and the `@softure-ai/mailing` adapter plugs in later without changes to auth.

## Context

From [`roadmap-identity.md`](../../../foundation/roadmaps/roadmap-identity.md), item **ID-5** (queued roadmap `identity`):

> ### ID-5: Password reset by token
> - **Change ID:** `auth-password-reset`
> - **Status:** ready
> - **Outcome:**
>   - table `auth.password_resets` (only the token hash stored, single use, expiring);
>   - a request page that never reveals whether the email exists, and a reset page;
>   - rate limits on both;
>   - existing sessions invalidated on reset;
>   - a `sendPasswordReset(link, user)` hook the app implements. A console/dev sender is provided,
>     and the `@softure-ai/mailing` adapter plugs in later without changes to auth.
> - **Prerequisites:** ID-4 (same module folder, so sequential).
> - **Unknowns:** token TTL default; behaviour when a reset is requested while one is pending;
>   how the link base URL is configured for multi-host apps.
> - **Risk:** medium.
> - **Baseline:** the source app resets passwords through a manual owner procedure. After: the
>   self-service reset is covered by e2e in the example app.
> - **PRD refs:** FR-12, NFR-5.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: reset files and migrations in `modules/auth/`, `examples/next-app/e2e/auth-reset.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
