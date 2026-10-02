---
change_id: auth-core
title: "Authentication core"
status: backlog
roadmap_item: ID-3
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/auth`, consisting of:
- tables `auth.users` and `auth.sessions`;
- scrypt password hashing (constant-time compare, dummy verification for unknown emails);
- opaque DB sessions (32-byte token, only its sha256 stored, configurable TTL, secure cookie);
- register with a required consent and an `onRegistered` hook (consent persistence is handed to
  `privacy` later through this hook), login, logout, change password (invalidates other sessions);
- `getCurrentUser` / `requireUser`, and a route-guard piece for the app's `proxy.ts`;
- the switch `auth.registration_closed`, declared for `feature-switches`;
- pages and forms built on `@softure-ai/ui` with slots and pl + en messages;
- rate limits from `@softure-ai/security`;
- unit tests on PGlite and e2e in the example app.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **ID-3** (roadmap `identity`):

> ### ID-3: Authentication core
> - **Change ID:** `auth-core`
> - **Status:** ready
> - **Outcome:** `@softure-ai/auth`, consisting of:
>   - tables `auth.users` and `auth.sessions`;
>   - scrypt password hashing (constant-time compare, dummy verification for unknown emails);
>   - opaque DB sessions (32-byte token, only its sha256 stored, configurable TTL, secure cookie);
>   - register with a required consent and an `onRegistered` hook (consent persistence is handed to
>     `privacy` later through this hook), login, logout, change password (invalidates other sessions);
>   - `getCurrentUser` / `requireUser`, and a route-guard piece for the app's `proxy.ts`;
>   - the switch `auth.registration_closed`, declared for `feature-switches`;
>   - pages and forms built on `@softure-ai/ui` with slots and pl + en messages;
>   - rate limits from `@softure-ai/security`;
>   - unit tests on PGlite and e2e in the example app.
> - **Prerequisites:** ID-1, ID-2.
> - **Unknowns:**
>   - How the route guard composes with other proxy pieces (channel tagging lives in `analytics` later).
>   - Cookie naming and domain options for apex + subdomain setups.
>   - How the module reads switches before `feature-switches` exists (declared default + env override).
> - **Risk:** high. It is the reference module for the standard and FIRE depends on it.
> - **Baseline:** source tests in FIRE_TRACKER (`do-auth.test.ts`, `password`, `session`, `sessions`,
>   `proxy`; e2e `auth-boundary`, `konto-haslo`, `login-pending`). After: equivalent tests green in the
>   module and the example app.
> - **PRD refs:** FR-11, NFR-2, NFR-3, NFR-5, NFR-6.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: `modules/auth/` (sessions, passwords, register/login/logout, pages), `examples/next-app/e2e/auth.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
