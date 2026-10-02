---
change_id: auth-password-reset
title: "Password reset by token: single-use expiring link, sender hook, request and reset pages"
status: implementing
roadmap_item: ID-5
branch: claude/id-5-auth-password-reset-3oz4vt
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

A user who forgot their password asks for a link on a "forgot password" page and sets a new
password on the page the link opens. The link carries a random token; only its sha256 is stored in
`auth.password_resets`, it expires, and it works once. The request page answers the same whether
or not the email has an account. Both pages are rate limited. A completed reset ends every session
of the account. Auth never sends mail itself: the app passes `passwordReset.send(link, user, details)`
to `auth({ ... })`; a console sender is provided for development, and the `@softure-ai/mailing`
adapter (engagement EN-4) plugs into the same hook later.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `identity`), item **ID-5**. Outcome, unknowns,
risk and baseline are quoted there.

What ID-3 and ID-4 left for this change (coordinator brief, 2026-10-02): the next auth migration is
`0003_*` (listed in `examples/next-app/e2e/migrations.spec.ts`); a new table goes into the manifest
`tables`, `module.json` and `checkAuthTables`; new default options extend the "fills in the
defaults" test; new error codes go into `AuthErrorCode` with en and pl copy; actions live in
`src/next/` files marked "use server" and never take an id bound by the client.

## Constraints

- Exclusively owns: reset files and migrations in `modules/auth/`, `examples/next-app/e2e/auth-reset.spec.ts`,
  the example's reset pages and sender.
- Shared hot file `examples/next-app/softure.config.ts`: change only the `auth({ ... })` entry.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- FIRE_TRACKER is read-only.

## Notes

- 2026-10-02: taken in the cloud session on `claude/id-5-auth-password-reset-3oz4vt`, in parallel
  with ID-6 (`modules/feature-switches/`, no shared files besides the backlog README).
