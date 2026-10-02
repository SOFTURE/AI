---
project: "SOFTURE AI"
roadmap: identity
version: 1
status: ready
prd_version: 1
created: 2026-10-02
updated: 2026-10-02
backlog: context/backlog/roadmap-identity/
---

# Roadmap identity: who the user is, what they may do, and how the app runs

> Entries: [`context/backlog/roadmap-identity/`](../backlog/roadmap-identity/). An entry is taken
> (moved to `context/changes/<id>/`) when its item starts.
>
> Promoted by the owner on 2026-10-02 while FD-8 of the foundation roadmap was still open: the owner
> deferred FD-8 (first npm publishes) to a session at the keyboard and ordered identity to start now.
> FD-8 is carried over here. The foundation roadmap is archived in
> [`archive/2026-10-02-roadmap.md`](archive/2026-10-02-roadmap.md).
>
> Run-wide orders (read by orchestrators):
> - Push main branch: at the end. Also push `master` after every merge, so an ephemeral cloud
>   container never holds the only copy. Claude reviews and merges its own changes into `master`
>   (owner, 2026-10-02). Tags and npm publishes stay with the owner.
> - Archive roadmap: at the end.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`).
> - Owner at the keyboard: FD-8 (carried over), ID-8 (first publishes and trusted publishers) and
>   ID-9 (runs in the FIRE_TRACKER repository, started by the owner).
>
> Queued after this one (WORKFLOW §5.1, files in `roadmaps/`, entries in `context/backlog/`):
> 1. [`roadmap-engagement`](roadmaps/roadmap-engagement.md): mailing, waitlist, mcp-access, privacy.
> 2. [`roadmap-monetization`](roadmaps/roadmap-monetization.md): billing, analytics.
> 3. [`roadmap-marketing-kit`](roadmaps/roadmap-marketing-kit.md): video, screenshot and OG generator. Independent, so it can be promoted any time.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **FD-8** | `foundation-release` | core, db and ui 0.1.0 published through FD-2; docs updated; foundation verified end to end | FD-2, FD-7 | owner | blocked (deferred by the owner to a session at the keyboard) |
| **ID-1** | `next-actions-spike` | proven way to ship server actions and route handlers from a package in Next 16, or a decided fallback | FD-3, FD-4 | autonomous | done |
| **ID-2** | `security-rate-limit` | `@softure-ai/security`: configurable rate-limit buckets, pluggable client-IP resolvers, small-body reader | FD-3, FD-4 | autonomous | done |
| **ID-3** | `auth-core` | `@softure-ai/auth`: register with consent hook, login, logout, sessions, change password, route guard, pages and forms | ID-1, ID-2 | autonomous | done |
| **ID-4** | `auth-roles` | roles with `requireRole`; admin-only surfaces fail closed | ID-3 | autonomous | done |
| **ID-5** | `auth-password-reset` | password reset with a single-use, expiring token sent through a sender hook | ID-4 | autonomous | ready |
| **ID-6** | `feature-switches` | `@softure-ai/feature-switches`: declared switches, env overrides, fail mode, admin-only panel | ID-4 | autonomous | done |
| **ID-7** | `ops-health-migrate` | `@softure-ai/ops`: health endpoint with module checks, container migrate step, safe ops script pattern | ID-1 | autonomous | done |
| **ID-8** | `identity-release` | security, auth, feature-switches and ops 0.1.0 published through the FD-2 pipeline | FD-8, ID-2, ID-3, ID-4, ID-5, ID-6, ID-7 | owner | ready |
| **ID-9** | `fire-adopt-identity` | FIRE_TRACKER runs on security, auth, roles, switches and ops and has deleted its own implementation | ID-8 | owner | ready |

## Order

1. **ID-1 ∥ ID-2.** ID-1 is the risk item: if server actions cannot ship from `node_modules`,
   every module's Next adapter changes shape, so it runs first. ID-2 has no Next adapter surface
   to speak of and can go alongside it.
   - ID-1 owns `spikes/next-actions/` (throwaway) and `docs/02-module-standard.md` §8.
   - ID-2 owns `modules/security/`.
2. **ID-3 ∥ ID-7.** Both build on the adapter shape ID-1 decided.
   - ID-3 owns `modules/auth/` (sessions, passwords, register/login/logout, pages).
   - ID-7 owns `modules/ops/`.
3. **ID-4** alone. It extends `modules/auth/` (roles), and ID-5 and ID-6 depend on it.
4. **ID-5 ∥ ID-6.**
   - ID-5 owns the reset files in `modules/auth/` (token table, reset pages, sender hook).
   - ID-6 owns `modules/feature-switches/`.
   - Migrations live in each module's own `migrations/` folder, so parallel items in different
     modules cannot collide on migration numbers. Two items in the **same** module never run in
     parallel.
5. **ID-8** after ID-2…ID-7 and FD-8. Owner item: tags and first publishes.
   - **FD-8** (carried over from foundation) runs whenever the owner is at the keyboard. Only ID-8
     waits for it: the identity packages depend on core, db and ui being on npm.
6. **ID-9** last. Owner item, runs in the FIRE_TRACKER repository.

**Shared hot file:** `examples/next-app/softure.config.ts` (and the example app's route folder).
Each item appends only its own module entry and adds its own e2e file
(`examples/next-app/e2e/<module>.spec.ts`), so merges stay trivial. No item rewrites another
item's entries.

## Items

### FD-8: Foundation release (carried over)
- **Change ID:** `foundation-release`
- **Status:** blocked (deferred by the owner to a session at the keyboard)
- **Outcome:** `@softure-ai/core`, `@softure-ai/db` and `@softure-ai/ui` 0.1.0 published through
  FD-2 (the owner approves each first, staged publish and configures its trusted publisher), README
  status lines updated, docs/02 updated with whatever the foundation changed, and a finish review
  across FD-1…FD-7.
- **Prerequisites:** FD-2, FD-7 (both done in the foundation roadmap).
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### ID-1: Server actions and route handlers from a package
- **Change ID:** `next-actions-spike`
- **Status:** done
- **Outcome:** a minimal package in this monorepo ships a `"use server"` action, a route handler
  and a server component page. The example app consumes it once linked from the workspace and
  once installed from a packed tarball, and all three work in `next dev` and in `next build && next start`.
  The result decides how the config registry from `@softure-ai/core` reaches server actions and
  updates docs/02 §8. If shipped actions are not viable, the fallback (route handlers + client
  hooks, or app-side thin action wrappers generated per module) is chosen and documented.
- **Prerequisites:** FD-3, FD-4 (foundation roadmap).
- **Unknowns:**
  - Does Next 16 bundle `"use server"` files from `node_modules` without `transpilePackages`?
  - How do `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `serverActions.allowedOrigins` behave with
    package-shipped actions across multiple instances?
  - Can a module-level registry set in `instrumentation.ts` / `softure.config.ts` be read inside a
    shipped action?
  - What does `next build` output look like (tree-shaking, duplicate React)?
- **Risk:** high. It shapes the Next adapter of every module.
- **Baseline:** no evidence either way. After: a documented verdict, backed by a reproducible
  spike and an e2e check in the example app.
- **PRD refs:** FR-3, NFR-1.

### ID-2: Rate limiting module
- **Change ID:** `security-rate-limit`
- **Status:** done
- **Input:** [`archive/2026-10-02-security-rate-limit/change.md`](../archive/2026-10-02-security-rate-limit/change.md)
- **Outcome:** `@softure-ai/security`, consisting of:
  - table `security.rate_limits(bucket, identifier, attempts, window_started_at)`;
  - a fixed-window limiter (atomic `INSERT … ON CONFLICT`, probabilistic cleanup);
  - buckets from configuration;
  - client-IP resolvers `cloudflareIp()`, `forwardedForIp({ trustedProxies })` and custom ones;
  - `readSmallBody` (request body size cap);
  - unit tests on PGlite, a README per docs/02 §11, and pl + en messages for the limit-exceeded error.
- **Prerequisites:** FD-3, FD-4.
- **Unknowns:** whether to key on IP only or IP + bucket subject (e.g. email); how resolvers
  behave behind several proxies; what happens without any resolver match (must not collapse all
  clients into one shared bucket).
- **Risk:** low.
- **Baseline:** source behaviour in FIRE_TRACKER (`src/db/auth-attempts.ts` and its test).
  After: the same behaviour tests pass in the module, plus resolver tests.
- **PRD refs:** FR-10, NFR-5.

### ID-3: Authentication core
- **Change ID:** `auth-core`
- **Status:** done
- **Outcome:** `@softure-ai/auth`, consisting of:
  - tables `auth.users` and `auth.sessions`;
  - scrypt password hashing (constant-time compare, dummy verification for unknown emails);
  - opaque DB sessions (32-byte token, only its sha256 stored, configurable TTL, secure cookie);
  - register with a required consent and an `onRegistered` hook (consent persistence is handed to
    `privacy` later through this hook), login, logout, change password (invalidates other sessions);
  - `getCurrentUser` / `requireUser`, and a route-guard piece for the app's `proxy.ts`;
  - the switch `auth.registration_closed`, declared for `feature-switches`;
  - pages and forms built on `@softure-ai/ui` with slots and pl + en messages;
  - rate limits from `@softure-ai/security`;
  - unit tests on PGlite and e2e in the example app.
- **Prerequisites:** ID-1, ID-2.
- **Unknowns:**
  - How the route guard composes with other proxy pieces (channel tagging lives in `analytics` later).
  - Cookie naming and domain options for apex + subdomain setups.
  - How the module reads switches before `feature-switches` exists (declared default + env override).
- **Risk:** high. It is the reference module for the standard and FIRE depends on it.
- **Baseline:** source tests in FIRE_TRACKER (`do-auth.test.ts`, `password`, `session`, `sessions`,
  `proxy`; e2e `auth-boundary`, `konto-haslo`, `login-pending`). After: equivalent tests green in the
  module and the example app.
- **PRD refs:** FR-11, NFR-2, NFR-3, NFR-5, NFR-6.

### ID-4: Roles and admin
- **Change ID:** `auth-roles`
- **Status:** done
- **Outcome:** table `auth.user_roles`, `requireRole(role)` for pages, actions and route handlers,
  and `hasRole` for UI. The admin role is granted by configuration (an initial admin list) or by a
  CLI command. Every admin-only surface fails closed when no admin is configured. Includes tests that
  a non-admin gets "not found" on admin pages and a refusal on admin actions.
- **Prerequisites:** ID-3.
- **Unknowns:** whether roles are flat strings or a small enum declared by modules; how an app
  bootstraps the first admin safely (config list vs. CLI); how this supersedes FIRE_TRACKER's
  interim admin allowlist (see ID-9).
- **Risk:** medium. Security-relevant defaults.
- **Baseline:** the source app has no role concept. After: role checks covered by unit and e2e tests.
- **PRD refs:** FR-13, NFR-5.

### ID-5: Password reset by token
- **Change ID:** `auth-password-reset`
- **Status:** ready
- **Outcome:**
  - table `auth.password_resets` (only the token hash stored, single use, expiring);
  - a request page that never reveals whether the email exists, and a reset page;
  - rate limits on both;
  - existing sessions invalidated on reset;
  - a `sendPasswordReset(link, user)` hook the app implements. A console/dev sender is provided,
    and the `@softure-ai/mailing` adapter plugs in later without changes to auth.
- **Prerequisites:** ID-4 (same module folder, so sequential).
- **Unknowns:** token TTL default; behaviour when a reset is requested while one is pending;
  how the link base URL is configured for multi-host apps.
- **Risk:** medium.
- **Baseline:** the source app resets passwords through a manual owner procedure. After: the
  self-service reset is covered by e2e in the example app.
- **PRD refs:** FR-12, NFR-5.

### ID-6: Feature switches module
- **Change ID:** `feature-switches`
- **Status:** done
- **Outcome:** `@softure-ai/feature-switches`, consisting of:
  - table `features.switches(name, enabled, updated_at, updated_by)`;
  - a registry of switches declared by the app and by modules (name, label, description, default,
    `failMode: open|closed`, env override);
  - `isEnabled(name)` and `setSwitch`;
  - a generic admin panel listing every declared switch, guarded by `requireRole("admin")` from
    ID-4; the module refuses to mount the panel without an authorization hook;
  - pl + en messages, unit tests and e2e.
- **Prerequisites:** ID-4.
- **Unknowns:** caching of switch reads per request; how modules declare switches (manifest vs.
  runtime); audit of who changed what (the `updated_by` column is enough for v1?).
- **Risk:** medium. A wrong default can lock an app.
- **Baseline:** source behaviour in FIRE_TRACKER (`src/db/feature-switches.ts` and its tests).
  After: the same behaviour plus admin-only access, tested.
- **PRD refs:** FR-14, NFR-5.

### ID-7: Health and migrate step
- **Change ID:** `ops-health-migrate`
- **Status:** done
- **Input:** [`archive/2026-10-02-ops-health-migrate/change.md`](../archive/2026-10-02-ops-health-migrate/change.md)
- **Outcome:** `@softure-ai/ops`, consisting of:
  - `GET /health` aggregating a DB check and checks contributed by enabled modules (200 / 503);
  - a documented container recipe that runs `softure migrate` as a one-off step before the app starts
    (bundled script, least-privilege app role);
  - the safe ops script pattern (dry run by default, `--commit` applies, one transaction, SQL guard test),
    as a helper plus docs;
  - unit tests and an e2e health check.
- **Prerequisites:** ID-1.
- **Unknowns:** whether `.env.prod` rendering and release notes belong here or stay app-specific;
  how module checks are registered (manifest vs. runtime registry from core).
- **Risk:** low.
- **Baseline:** source health route and container setup in FIRE_TRACKER. After: the same
  behaviour from the module, verified in the example app's container run.
- **PRD refs:** FR-15.

### ID-8: Identity release
- **Change ID:** `identity-release`
- **Status:** ready
- **Outcome:** `@softure-ai/security`, `@softure-ai/auth`, `@softure-ai/feature-switches` and
  `@softure-ai/ops` 0.1.0 published through the FD-2 pipeline. The owner approves each first
  (staged) publish on npmjs.com and adds a trusted publisher for each package. README status lines
  are updated, and a finish review runs across ID-1…ID-7.
- **Prerequisites:** FD-8, ID-2, ID-3, ID-4, ID-5, ID-6, ID-7.
- **Unknowns:** none beyond the owner's npm steps.
- **Risk:** low.
- **Baseline:** packages absent from npm. After: installable from npm and from GitHub Releases.
- **PRD refs:** FR-2, G-4.

### ID-9: FIRE_TRACKER adopts the identity modules
- **Change ID:** `fire-adopt-identity`
- **Status:** ready
- **Outcome:** following docs/05:
  - FIRE_TRACKER configures security, auth (with roles and reset), feature-switches and ops through
    `softure.config.ts`, with its Polish routes and copy passed as messages and routes;
  - an adoption migration moves `users`, `sessions`, `auth_attempts` and `feature_switches` into
    the module schemas without data loss, and billing/analytics columns move to app-owned 1:1 tables;
  - `softure migrate --adopt` marks the module migrations;
  - FIRE deletes its own implementation (the source files listed in docs/01 for these modules);
  - FIRE's full integration suite is green, and the migration dry run on a production copy passes.

  FIRE_TRACKER currently guards admin surfaces with an interim email allowlist (`ADMIN_EMAILS`,
  from the change `switches-admin-guard`). This item replaces it with roles from ID-4 and the
  switches panel from ID-6, and moves the configured admins into `auth.user_roles`.
- **Prerequisites:** ID-8.
- **Unknowns:** how FIRE's billing and channel columns on `users` are split out before or during
  the move; whether the apex/subdomain cookie setup needs module options; which FIRE integration
  tests need selector updates.
- **Risk:** high. Live production data.
- **Baseline:** FIRE's own implementation and its integration suite. After: same suite green on
  the modules, own code deleted, CHANGELOG notes "verified in: FIRE_TRACKER@<sha>" for each
  module version.
- **PRD refs:** FR-26, G-2.

## Owner decisions and checks

- [ ] **FD-8** (carried over): approve the first (staged) publish of core, db and ui on npmjs.com, then
  add a trusted publisher for each (`SOFTURE` / `AI` / the release workflow file).
- [ ] **FD-2** (carried over): before the first tag of a new package, add the repository secret `NPM_TOKEN` (granular, `@softure-ai` scope, short expiry); after approving its staged version, add the trusted publisher `SOFTURE` / `AI` / `release.yml` (stage only) and remove the token once no new package is pending. Runbook: `scripts/release/README.md`

- [ ] **ID-8**: approve the first (staged) publish of security, auth, feature-switches and ops
  on npmjs.com, then add a trusted publisher for each.
- [ ] **ID-6**: `auth.registration_closed` is still read by auth from its option and env override,
  not through feature-switches (auth cannot import it back); the follow-up in
  `context/backlog/identity-followups.md` (a switch-reader contract in core) must land before ID-9.
- [ ] **ID-9**: start the adoption in the FIRE_TRACKER repository; take a production backup and
  approve the dry-run result before the release that carries the adoption migration.

## Done

- **ID-6** `feature-switches`: `@softure-ai/feature-switches` with switches the app declares (explicit default, fail mode `closed`/`open`, label and description per locale), the derived env override `SOFTURE_SWITCH_<NAME>` over the stored value over the default, table `features.switches` with `updated_at` and `updated_by`, `isEnabled` (one read per request in Next, fresh in scripts), `setSwitch`, an admin-only panel page (`requireRole`) and action (`authorizeRole` first), a health check; auth's own switch is a follow-up; archived in `archive/2026-10-02-feature-switches/`
- **ID-4** `auth-roles`: roles in `@softure-ai/auth`: table `auth.user_roles`, declared role names (`admin` built in), `adminEmails` initial admin list, `requireRole` (404) for pages and route handlers, `authorizeRole` (`auth.forbidden`) for actions, `hasRole` for UI, `grant-role` / `revoke-role` ops scripts; admin-only surfaces fail closed; archived in `archive/2026-10-02-auth-roles/`
- **ID-3** `auth-core`: `@softure-ai/auth` with users, scrypt passwords, database sessions (token hash only), register with a consent hook in one transaction, login (two rate-limit buckets before hashing), logout, password change ending other sessions, `getCurrentUser` / `requireUser`, `createAuthGuard` for `proxy.ts`, pages and forms in pl + en, a health check for ops; `getSharedDatabase` in db; the next-actions spike removed; archived in `archive/2026-10-02-auth-core/`
- **ID-7** `ops-health-migrate`: `@softure-ai/ops` with `GET /api/health` (database plus a check per enabled module through `defineModule({ health })`, 200/503, nothing revealed), the container recipe (one image, one-off `softure migrate` as `softure_migrator`, the app as `softure_app` limited to rows; verified by `npm run e2e:container` in CI) and the safe ops script helper; `.env.prod` and release notes stay app-specific; archived in `archive/2026-10-02-ops-health-migrate/`
- **ID-2** `security-rate-limit`: `@softure-ai/security` with configurable rate-limit buckets, client-IP resolvers that refuse unidentified clients, subject keys and `readSmallBody`; archived in `archive/2026-10-02-security-rate-limit/`
- **ID-1** `next-actions-spike`: modules ship server actions, route handlers and pages from their package (docs/02 §8: one-line re-exports, config registry confirmed with a root-layout import for prerendering, bound arguments not secret, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for stable action ids across builds); `resolveMigrationsDir` in core fixes the Turbopack migrations build; spike package `spikes/next-actions/` with e2e; archived in `archive/2026-10-02-next-actions-spike/`

## Decisions (auto)

- The spike (ID-1) comes first, before any module with a Next adapter. → If package-shipped
  actions fail, the adapter design changes for every module, so it is the cheapest point to learn it.
- Password reset (ID-5) uses a sender hook instead of depending on `@softure-ai/mailing`. → Identity
  ships without waiting for the engagement roadmap, and mailing plugs in later.
- ID-5 runs after ID-4, not in parallel with it. → Both edit `modules/auth/` and its migrations folder.
- ID-7 depends only on ID-1. → Health and migrate need the adapter shape but not auth.
- Identity was promoted with FD-8 open, on the owner's order (2026-10-02). → FD-8 is carried over as
  `blocked` (owner item); ID-8 also waits for it, since the identity packages need core, db and ui
  on npm.
- Entries are taken from the backlog when their item starts, not all at promotion. → Parallel threads
  each move only their own entry, so the promotion does not collide with work in flight.
- The FIRE adoption is one item for all identity modules. → Auth, roles and switches move tables
  that reference each other (`users`), so splitting the adoption would need temporary bridges.
