# Plan: auth-roles

Input: change.md, research.md. Complexity: medium (2 phases).

## Goal

`@softure-ai/auth` gains roles:

- options `roles` (declared role names besides `admin`) and `adminEmails` (initial admin list);
- table `auth.user_roles` (migration `0002_create_user_roles.sql`), Drizzle table `userRoles`,
  manifest `tables` with `user_roles`, health check covering it;
- `@softure-ai/auth/server`: `findUserRoles(ctx, user)`, `grantRole`, `revokeRole`, `isDeclaredRole`,
  `ADMIN_ROLE` (also from `.`);
- `@softure-ai/auth/next`: `requireRole(role)` (`notFound()` otherwise), `authorizeRole(role)`
  (`Ok<AuthUser> | Err<"auth.forbidden">`), `hasRole(role)`, `getCurrentUserRoles()`;
- `@softure-ai/auth/scripts`: `createGrantRoleScript(config)`, `createRevokeRoleScript(config)`
  (ops scripts);
- `errors.auth.forbidden` in en and pl; README sections updated.

The example app lists an admin in `adminEmails`, mounts `/admin` (page + action) and
`/api/admin/status` (route handler), ships `scripts/grant-role.ts`, and `e2e/auth-roles.spec.ts`
covers the roadmap's tests.

**Out of scope:** an admin UI for managing roles, module-declared role registries, role
hierarchies, email verification.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Role shape | declared flat strings, `^[a-z][a-z0-9_-]{0,31}$`, `admin` built in | typos fail loudly | research 1 |
| Bootstrap | `adminEmails` (evaluated per check, never stored) + `grant-role` script | roadmap; script is the safe path | research 2 |
| Pages / handlers | `requireRole` → `notFound()` for anonymous and non-holders | roadmap "not found" | research |
| Actions | `authorizeRole` → `Err<"auth.forbidden">` as a value | AGENTS.md errors | research |
| Undeclared role | throws | fail closed and visible | research 1 |
| Caching | React `cache` per request only | revocation is immediate | research |
| CLI | ops scripts from `@softure-ai/auth/scripts`, ops as a package dependency | ID-7 pattern | research |

Rejected: storing `adminEmails` grants as rows at startup (no DDL/DML at boot as `softure_app`, and
removal would not revoke); a login redirect for anonymous visitors on admin pages (leaks the
surface, roadmap asks for not found); roles in the session cookie (stale after revoke).

## Phase 1: Table, server functions and scripts

**Discipline:** TDD (security rules).

- `migrations/0002_create_user_roles.sql`, `src/schema.ts` (`userRoles`).
- `src/options.ts`: `roles`, `adminEmails` (validated, normalized lowercase, deduplicated).
- `src/roles.ts` (`ADMIN_ROLE`, `ROLE_NAME`), `src/server/roles.ts`: `getDeclaredRoles(config)`,
  `isDeclaredRole`, `assertDeclaredRole`, `findUserRoles`, `grantRole`, `revokeRole`.
- `src/server/health.ts` covers `user_roles`; manifest `tables`, `module.json`.
- `src/scripts/roles.ts` + `src/scripts/index.ts`, package export `./scripts`, dependency
  `@softure-ai/ops`; lockfile.
- `contract.ts`: `auth.forbidden`; messages en + pl.
- Tests: `tests/roles.test.ts`, `tests/role-scripts.test.ts`, module defaults and option errors,
  health.

## Phase 2: Next adapter, example app and e2e

**Discipline:** test-after (wiring).

- `src/next/current-user.ts`: `getCurrentUserRoles`, `requireRole`, `authorizeRole`, `hasRole`;
  exports in `src/next/index.ts`.
- Example: `softure.config.ts` (`auth({ adminEmails: [...] })` only), `app/admin/page.tsx`,
  `app/admin/actions.ts` (an admin-only guestbook announcement, `authorizeRole`),
  `app/admin/announce-form.tsx`, `app/api/admin/status/route.ts`, account page link via `hasRole`,
  `scripts/grant-role.ts` + npm script, messages en + pl.
- `e2e/auth-roles.spec.ts`; `e2e/migrations.spec.ts` lists `auth 2 create_user_roles`.
- README: roles section, options table, mounting, tables, limitations.

## Risks and rollback

- Rollback of the migration: `DROP TABLE auth.user_roles;` and the ledger row (in the SQL header).
- If `notFound()` in a route handler misbehaves, the e2e catches it before merge.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Table, server functions and scripts

#### Automated
- [x] 1.1 Role baseline tests (roles, scripts, options, health) pass on PGlite — 632b727
- [x] 1.2 `module.json` equals `toModuleJson(auth)` and the package passes `tests/repo/packages.test.ts` — 632b727
- [x] 1.3 Gates green (typecheck, lint, test) — 632b727

### Phase 2: Next adapter, example app and e2e

#### Automated
- [x] 2.1 `npm run e2e` passes against a local PostgreSQL 16, including `auth-roles.spec.ts` — e1cbdb1
- [x] 2.2 Gates green (typecheck, lint, test, build) — e1cbdb1
