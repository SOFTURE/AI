# Research: auth-roles

Input: change.md, backlog-input.md. Depth: medium (security-relevant defaults). Sources:
`modules/auth` (ID-3), `modules/ops` (ops scripts, least-privilege roles), `foundation/core`,
docs/01 §"No roles and no admin concept", docs/02 (manifest lists `user_roles`), the PRD (FR-13,
NFR-5) and the roadmap blocks of ID-6 and ID-9.

FIRE_TRACKER was not read in this session: its clone was refused by the session's permission
policy. What this change needs from it is recorded in this repository: the source app has no role
concept (docs/01), and its interim guard is an email allowlist `ADMIN_EMAILS` from the change
`switches-admin-guard` (roadmap ID-9), which ID-9 replaces with these roles.

## Current state

- `@softure-ai/auth` has `auth.users` and `auth.sessions` (migration 0001), `findSessionUser`,
  `getCurrentUser` (React `cache`, one lookup per request) and `requireUser` (redirect to login).
- The manifest already reserves nothing for roles; docs/02's example manifest lists `user_roles`.
- `@softure-ai/ops/scripts` gives safe ops scripts: dry run by default, `--commit` writes, one
  transaction, `before`/`after` measured, strict `--key=value` input, and `executeOpsScript` for a
  guard test on PGlite. Its own doc names "grant access" as the use case.
- The app connects as `softure_app` (DML only, default privileges on new tables), so a new table in
  the `auth` schema is readable and writable by the app without extra grants.
- `checkAuthTables` (health) selects `limit 0` from each table; the ops e2e and `container.mjs`
  expect `auth: "ok"`.

## Answers to the roadmap unknowns

1. **Flat strings or an enum declared by modules?** Flat strings with a fixed shape
   (`^[a-z][a-z0-9_-]{0,31}$`, enforced by a `CHECK`), **declared** in configuration:
   `auth({ roles: ["editor"] })`; `admin` is always declared. Code asking for an undeclared role
   (`requireRole("amdin")`) throws: a typo must fail loudly and closed, never silently deny or
   allow. Granting an undeclared role is refused by the script. Modules that need a role (ID-6
   needs only `admin`) document it; a registry of module-declared roles is not needed yet.
2. **How the first admin is bootstrapped safely.** Both ways the roadmap names, with a clear rule:
   - `auth({ adminEmails: ["owner@example.com"] })`: while an email is listed, the account with that
     email holds `admin`. It is evaluated at check time and never written to the table, so removing
     the email revokes it on the next request. Risk: auth does not verify emails, so whoever
     registers a listed email first becomes admin. The README says to create that account before
     deploying the list (or keep registration closed), and to prefer the script.
   - `grant-role` / `revoke-role` ops scripts (`@softure-ai/auth/scripts`) the app bundles like its
     migrate step: `--email=… --role=admin`, dry run by default, `--commit` writes. They refuse an
     unknown email, an undeclared role, a role already granted (grant) or not granted (revoke). The
     operator runs them with database access, so they are the safe bootstrap.
3. **How this supersedes FIRE_TRACKER's interim allowlist.** ID-9 moves `ADMIN_EMAILS` into
   `adminEmails` (same semantics, no data step) and may then grant rows with the script and drop
   the list. Nothing in this change touches FIRE_TRACKER.

## Further decisions

- **Table.** `auth.user_roles(user_id → users ON DELETE CASCADE, role, granted_at, PK (user_id, role))`.
  Deleting a user deletes its roles. No `granted_by`: the script runs outside any session.
- **Fail closed.** Nothing is granted by default; no admin configured and no rows means every
  `requireRole("admin")` answers "not found". A database failure propagates (error page), never a
  grant. The roles are read per request, never cached across requests or stored in the cookie, so a
  revoke takes effect on the next request.
- **Pages, layouts, route handlers: `requireRole(role)`.** Anonymous visitors and users without the
  role get `notFound()` (the roadmap asks for "not found"; it also hides that the surface exists).
  No login redirect: an admin logs in first. Next 16 supports `notFound()` in route handlers.
- **Server actions: `authorizeRole(role)`.** Returns `Ok<AuthUser>` or `Err<"auth.forbidden">`, so
  the action returns the refusal to its form as a value (AGENTS.md: expected failures are values).
  `requireRole` also works inside an action, but a `notFound()` there surfaces as a client error.
- **UI: `hasRole(role)`.** A boolean for showing a link; never an access check by itself.
- **Request cost.** `getCurrentUserRoles` is wrapped in React `cache`, so a page calling
  `hasRole` and `requireRole` reads the roles once.
- **Scripts depend on `@softure-ai/ops`.** Auth gets ops as a package dependency for the
  `./scripts` entry only; the module manifest does not depend on ops, so an app without the ops
  module still runs auth.
- **Copy.** `errors.auth.forbidden` in en and pl.

## Behaviour baseline (unit tests on PGlite)

- A user without rows and outside `adminEmails` holds no role.
- A granted role is found; a revoked one is not; deleting the user deletes its roles.
- `adminEmails` grants `admin` to the matching account (case-insensitive) and nothing else.
- An undeclared role in a check throws; an invalid role name or admin email in options is refused.
- The scripts: dry run writes nothing; `--commit` writes; refusals for unknown email, undeclared
  role, already granted, not granted; the report shows the user id and roles, never the email.
- Health fails when `auth.user_roles` is missing.

e2e (example app): an anonymous visitor and a non-admin get 404 on the admin page and the admin
route handler; an admin from `adminEmails` sees the page and runs the admin action; the same action
from a non-admin or an anonymous session is refused and changes nothing; a role granted with the
`grant-role` script opens the page.

## Risks

- Email-based bootstrap without email verification (unknown 2); mitigated by documentation and by
  the script being the recommended path.
- `notFound()` inside route handlers depends on Next behaviour; the e2e pins it.
