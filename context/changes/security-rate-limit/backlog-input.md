---
change_id: security-rate-limit
title: "Rate limiting module"
status: backlog
roadmap_item: ID-2
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`@softure-ai/security`, consisting of:
- table `security.rate_limits(bucket, identifier, attempts, window_started_at)`;
- a fixed-window limiter (atomic `INSERT … ON CONFLICT`, probabilistic cleanup);
- buckets from configuration;
- client-IP resolvers `cloudflareIp()`, `forwardedForIp({ trustedProxies })` and custom ones;
- `readSmallBody` (request body size cap);
- unit tests on PGlite, a README per docs/02 §11, and pl + en messages for the limit-exceeded error.

## Context

From [`roadmap-identity.md`](../../foundation/roadmaps/roadmap-identity.md), item **ID-2** (queued roadmap `identity`):

> ### ID-2: Rate limiting module
> - **Change ID:** `security-rate-limit`
> - **Status:** ready
> - **Outcome:** `@softure-ai/security`, consisting of:
>   - table `security.rate_limits(bucket, identifier, attempts, window_started_at)`;
>   - a fixed-window limiter (atomic `INSERT … ON CONFLICT`, probabilistic cleanup);
>   - buckets from configuration;
>   - client-IP resolvers `cloudflareIp()`, `forwardedForIp({ trustedProxies })` and custom ones;
>   - `readSmallBody` (request body size cap);
>   - unit tests on PGlite, a README per docs/02 §11, and pl + en messages for the limit-exceeded error.
> - **Prerequisites:** FD-3, FD-4.
> - **Unknowns:** whether to key on IP only or IP + bucket subject (e.g. email); how resolvers
>   behave behind several proxies; what happens without any resolver match (must not collapse all
>   clients into one shared bucket).
> - **Risk:** low.
> - **Baseline:** source behaviour in FIRE_TRACKER (`src/db/auth-attempts.ts` and its test).
>   After: the same behaviour tests pass in the module, plus resolver tests.
> - **PRD refs:** FR-10, NFR-5.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER), `docs/05-adoption-playbook.md` (adoption).

## Constraints

- Exclusively owns: `modules/security/`, `examples/next-app/e2e/security.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never rewrite other entries.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
