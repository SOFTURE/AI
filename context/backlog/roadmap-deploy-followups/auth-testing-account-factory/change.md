---
change_id: auth-testing-account-factory
title: "An account factory in @softure-ai/auth/testing"
status: backlog
roadmap_item: DF-2
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

`@softure-ai/auth/testing` exports a factory that creates an account directly in the database (the
password hashed with auth's own `hashPassword` and scrypt parameters) and returns its id, so an e2e
that is not about registration logs in through the form without filling the registration form first.
The example app's e2e uses it where a spec only needs "a signed-in account".

## Context

From [`roadmap-deploy-followups.md`](../../../foundation/roadmaps/roadmap-deploy-followups.md), item **DF-2**:

> ### DF-2: Account factory in auth's testing export
> - **Change ID:** `auth-testing-account-factory`
> - **Status:** ready
> - **Outcome:** `@softure-ai/auth/testing` with `createTestAccount(db, { email, password, roles? })` that writes
>   the `users` row (and roles) with auth's hashing; the example's e2e registers through the form only in the
>   specs about registration; auth bumps its version.
> - **Risk:** low. Test-only export; it changes a published package, so it rides auth's next release.
> - **Source:** DP-7 (`testing-playwright-helpers`), research: FIRE_TRACKER's `integration/infrastructure/auth.ts`
>   creates accounts in SQL; DP-7 decided module-specific factories belong in each module's own `testing`
>   export (precedent: `@softure-ai/mailing/testing`), and adding one to auth was outside DP-7.

## Constraints

- English only. Test-only code under `src/testing/`, exported as `./testing`, never imported by runtime code.
- Bumps `@softure-ai/auth`; the owner releases it.

## Notes
