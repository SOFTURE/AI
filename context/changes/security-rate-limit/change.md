---
change_id: security-rate-limit
title: "Rate limiting module with configurable buckets and client-IP resolvers"
status: implemented
roadmap_item: ID-2
branch: claude/id-2-security-rate-limit-1uapih
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

An app that lists `security({ clientIp, buckets })` in `softure.config.ts` can rate-limit any
public entry point (a login, a sign-up, a beacon, an API route) with a fixed-window limiter in
Postgres, identify the client through a resolver that matches its hosting (Cloudflare, a chain
of proxies, or its own), never folds unidentified clients into one shared bucket, and reads small
request bodies with a hard size cap. Module authors (auth in ID-3 first) build on it instead of
copying FIRE_TRACKER's limiter.

## Context

Taken from the queued roadmap entry, kept as
[`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `identity`), item **ID-2**:

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

The owner started the identity roadmap before FD-8 (Jaro, 2026-10-02, project chat, written in
Polish; translated): "I attached the FIRE_TRACKER repository so you have code you can copy (but do
not change anything there), and carry on with the next roadmaps, because FD-8 has to wait until I
am at the computer on Monday."

Current state: `modules/security/` holds only a README stub and empty folders.

## Constraints

- Exclusively owns: `modules/security/`, `examples/next-app/e2e/security.spec.ts`.
- Shared hot file `examples/next-app/softure.config.ts`: append only this module's entry; never
  rewrite other entries.
- ID-1 (`next-actions-spike`) runs in parallel and owns `spikes/next-actions/`, docs/02 §8 and the
  roadmap promotion; this change does not touch them.
- FIRE_TRACKER is read-only: code is copied from it, nothing is changed there.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en`
  message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- `new URL("../migrations/", import.meta.url)` breaks `next build` on Turbopack until ID-1 fixes
  it: use the `String(import.meta.url)` form of `examples/next-app/modules/guestbook/index.ts`.

## Notes

- Mode: fully autonomous (owner decision 2026-10-02): self-review, merge to master, branch
  cleanup by GitHub auto-delete.
