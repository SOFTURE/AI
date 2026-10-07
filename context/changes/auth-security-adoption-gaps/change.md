---
change_id: auth-security-adoption-gaps
title: "auth + security: the 14 gaps an adopting app found (issue #156)"
status: impl_reviewed
roadmap_item: null
issue: 156
branch: claude/project-thread-x1jpxm
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close every point of [issue #156](https://github.com/SOFTURE/AI/issues/156), so an existing app can adopt
`@softure-ai/auth` and `@softure-ai/security` without its own workarounds:

1. the route guard can be deny-by-default (`exclude`, auth's own pages never guarded, no redirect loop);
2. app data reaches `onRegistered` (declared registration fields), and the register page takes a consent label
   and extra fields without being replaced;
3. `revokeUserSessions(ctx, userId)` and a `set-temporary-password` ops script next to `grant-role`;
4. an optional legacy session read path, so an adopter does not log everyone out;
5. a legacy hash of non-NFC input still verifies, and is rehashed in NFC;
6. the security README documents a resolver chain for dev and test stacks;
7. the password reset buckets are required only when password reset is on;
8. a password change to the same password is refused;
9. `toSafeNextPath` takes OAuth-sized paths and logs when it falls back for length;
10. the README says the per-IP `login` bucket is never reset by a success;
11. the auth forms' submit button takes a variant and a class slot;
12. `@softure-ai/ops` becomes an optional peer (only `./scripts` needs it);
13. the scrypt cost's memory and time are documented next to the option;
14. 0.1.6 (unpublished) carries all of this; publishing is a separate release step.

A reviewer checks the auth tests (guard, password, login, change password, register, sessions, scripts, forms,
safe next path, actions), both READMEs and the package manifests.

## Context

Issue #156 (filed 2026-10-07 while an existing app planned its switch to the packages). Issues are tracked in
GitHub Issues, not in a roadmap: this change has no roadmap item and closes the issue on merge.

## Constraints

- Scope: `modules/auth` and `modules/security` only (README, package versions). Parallel work: #153 owns
  `foundation/db`, #155 `foundation/core/src/config.ts`, #158 will touch `modules/auth/module.json` and #154 the module
  adapters later; this change keeps `module.json` edits to the version only.
- Never bind an id or a role to a server action; actions stay in `src/next/` with `"use server"`.
- No npm publish, tag or release by the agent (a separate release step).
- English-only code, comments and commits; Polish only in `messages/pl.ts`.

## Process notes

- Research: written ([research.md](research.md)), short: the issue cites file and line for every gap, and the reading
  confirmed each one.
- Framing: skipped. Each point is an observed gap with its fix named by the adopter, verified end to end on the adopting app's
  data; there is no competing explanation to test, and the scope is the issue's list.
