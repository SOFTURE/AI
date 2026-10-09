---
change_id: auth-guard-fixtures-admin-emails
title: "auth: relative guard redirect and exact public paths, fixture test accounts, adminEmails from the raw env string (issue #314)"
status: archived
roadmap_item: null
issue: 314
branch: claude/project-thread-ysy6v0
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #314](https://github.com/SOFTURE/AI/issues/314), filed by an adopting app that keeps its own guard, its
own fixture inserts into `auth.users` and its own `parseAdminEmails` because auth 0.1.10 lacks three things:

1. `createAuthGuard` cannot answer with a relative `Location` (a stack on an unknown port) and has no exact allowlist
   (`exclude` matches prefixes).
2. `createTestAccount` takes no `id`, `createdAt` or ready `passwordHash`, hashes on every call and runs no
   `onRegistered` hook.
3. `adminEmails` throws at config load on one invalid entry, so the raw env string cannot be passed.

A reviewer checks `modules/auth/tests/guard.test.ts` ("relative redirect", "exact public paths"),
`tests/testing.test.ts` ("fixture accounts") and `tests/roles.test.ts` ("adminEmails as the raw environment string").

## Context

#311 (merged) moved the request-origin rule to core: `config.origins.trustRequestHost` already covers the issue's
`trustRequestOrigin: true` alternative, so this change adds only the relative redirect. auth 0.1.11 was unreleased on
master when work started and was published meanwhile, so this change ships as auth 0.1.12.

## Constraints

- Existing configs and calls behave as before: `redirect` defaults to `"absolute"`, `createTestAccount(db, …)` keeps
  its signature, an `adminEmails` list stays strict.
- The relative redirect reads no request header.
- The adminEmails log line never prints the dropped values (they may be personal data).

## Process notes

- Research: skipped; the issue names the files and lines, and plan.md's "Today" records what the code does.
- Framing: skipped; the issue states the problem and the proposal.

## Decisions (auto)

- Guard option `redirect: "absolute" | "relative"` rather than a boolean, so a later mode fits; exact allowlist as a
  separate `excludeExact` list instead of changing `exclude`'s meaning.
- `runHooks` needs a module context as the first argument (the hook takes one); `createTestAccount(ctx, …)` also
  hashes with the app's parameters. The hook's consent is accepted at `createdAt`.
- Hashes are memoized per password and parameters for the test run (the issue's "slow in big suites").
- Only the string form of `adminEmails` is lenient: a literal list in the config is the developer's typo and keeps
  failing at load.
- Version: auth 0.1.12 (0.1.11 was published while this change was in flight).
