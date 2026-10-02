---
change_id: auth-roles
title: "Roles in auth: user_roles table, requireRole, authorizeRole and hasRole; admin-only surfaces fail closed"
status: implementing
roadmap_item: ID-4
branch: claude/id-4-auth-roles-o071gn
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

An app that enables `auth({ ... })` can give users roles and guard surfaces by them. Roles are
rows in `auth.user_roles`; `admin` can also come from an initial admin list in the configuration,
and an operator grants or revokes any declared role with a dry-run-by-default CLI script. Pages,
layouts and route handlers call `requireRole(role)` and answer "not found" to everyone else;
server actions call `authorizeRole(role)` and return a refusal; the UI asks `hasRole(role)`.
Nothing is granted by default: with no admin configured and no rows, every admin-only surface is
closed. The feature-switches panel (ID-6) and FIRE_TRACKER's admin pages (ID-9) build on this.

## Context

Taken from the queued roadmap entry, kept as [`backlog-input.md`](backlog-input.md). Roadmap:
[`roadmap.md`](../../foundation/roadmap.md) (roadmap `identity`), item **ID-4**. Outcome, unknowns,
risk and baseline are quoted there.

What ID-3 left for this change (coordinator brief, 2026-10-02): server logic in
`modules/auth/src/server/`, `AuthContext = ModuleContext<Queryable>`, `findSessionUser(ctx, token)`
returns `AuthUser { id, email, createdAt }`; roles get migration `0002_*` and `requireRole` next to
`requireUser` in `src/next/current-user.ts`; Next imports without `.js`; copy only in
`src/messages/{en,pl}.ts`; extend the `checkAuthTables` health check with the new table; the example
lists the new migration in `e2e/migrations.spec.ts`. Never bind an id or a role to an action: read
them from the session.

## Constraints

- Exclusively owns: role files and migrations in `modules/auth/`, `examples/next-app/e2e/auth-roles.spec.ts`,
  the example's admin page, admin route handler and role scripts.
- Shared hot file `examples/next-app/softure.config.ts`: change only the `auth({ ... })` entry.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- No release, tag or publish by the agent; the owner tags releases.
- FIRE_TRACKER is read-only.

## Notes
