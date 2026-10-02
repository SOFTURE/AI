---
change_id: auth-core
title: "Authentication core: users, sessions, register, login, logout, change password, guard and pages"
status: implementing
roadmap_item: ID-3
branch: claude/id-3-auth-core-vdx54s
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

An app that lists `auth({ ... })` (with `security({ ... })`) in `softure.config.ts`, runs
`softure migrate` and mounts a few one-line files gets working accounts: a visitor registers with a
required consent, logs in and out, changes the password (which ends every other session), and the
app reads the signed-in user on the server (`getCurrentUser` / `requireUser`) and keeps
anonymous visitors out of private paths through a guard in its `proxy.ts`. Passwords are scrypt
hashes, sessions are opaque database rows keyed by a token hash, and every public entry point is
rate-limited through `@softure-ai/security`. `auth` is the reference module of the standard: every
layer (migrations, server, Next adapter, UI, messages) exists in it.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `identity`), item **ID-3**. Outcome, unknowns,
risk and baseline are quoted there.

What ID-1 and ID-2 left for this change (coordinator brief, 2026-10-02):

- ID-1 (docs/02 §8): actions, route handlers and pages ship from the package without
  `transpilePackages`; `"use server"` files live in `src/next/`; the app mounts each page or route
  with a one-line re-export. Config comes from `getSoftureConfig()` (`@softure-ai/core/next`). Bound
  action arguments are tamperable: never bind an id or a role, read them from the session.
  Migrations: `resolveMigrationsDir(import.meta.url, "../migrations/")`. React (and Next when
  imported) are peer dependencies. Once auth covers the same paths, `spikes/next-actions/` is
  deleted with its mount files and e2e.
- ID-2: `@softure-ai/security/server` gives `identifyClient` (no IP → refuse), `subjectKey`,
  `consumeRateLimit` / `resetRateLimit`. Login consumes two buckets, `login` (IP) and
  `login-account` (subject), before hashing; limiter errors go through `try` + `safeError`.
  Auth declares `dependsOn: { security: "^0.0.0" }` and tests with
  `createTestDatabase([security(...), auth(...)])`.

## Constraints

- Exclusively owns: `modules/auth/`, `examples/next-app/e2e/auth.spec.ts` and the example app's auth
  mount files.
- Shared hot files in the example app (`softure.config.ts`, `e2e/migrations.spec.ts`, the route
  folder): append only this module's entries. ID-7 (`ops-health-migrate`) runs in parallel and
  touches the same files.
- FIRE_TRACKER is read-only.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en`
  message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

- Mode: fully autonomous (owner decision 2026-10-02): self-review, merge to master, branch cleanup
  by GitHub auto-delete.
- Cloud session; the branch carries the workflow state (`worktree.cloudState: "branch"`).
