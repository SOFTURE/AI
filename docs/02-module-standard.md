# 02 — SOFTURE AI module standard (draft v0)

Goal: an AI agent adds a feature to an app in a few steps (install the package, add it to the
configuration, mount the routes, run the migrations) and does not have to write anything from scratch.

> Decisions approved on 2026-10-02: one Postgres schema per module, compiled CSS on tokens, `pl` + `en` dictionaries from the start, npm scope `@softure-ai`.

## 1. Target stack

- TypeScript, ESM, Node ≥ 22, React 19, **Next.js (App Router) as the first adapter**.
- Postgres as the target database, PGlite in tests and dev mode. Drizzle ORM as the query layer.
- The module core (`server/`) does not import `next/*`. The Next adapter lives in `next/`. This keeps
  the door open for other frameworks (e.g. React Router/Hono) without rewriting the logic.

## 2. Module folder layout

```
modules/<name>/
  package.json          @softure-ai/<name>; exports: ".", "./server", "./next", "./ui", "./styles.css"
  README.md             usage for humans and agents (fixed sections, see §11)
  module.json           machine-readable manifest (see §3)
  migrations/           0001_<description>.sql … (forward only, see §4)
  src/
    index.ts            public API: defineXModule(config), types, error codes
    contract.ts         result types and error codes (no UI copy)
    schema.ts           Drizzle tables in pgSchema('<name>')
    server/             server-only logic; every function receives { db, clock } and never touches request scope
    next/               server actions, route handlers, pages ready to mount
    ui/                 React components (styled, overridable; see §5)
    messages/           pl.ts, en.ts (complete default dictionaries)
  tests/                vitest + PGlite (unit/contract) and e2e scenarios for the example app
```

## 3. The `module.json` manifest

What agents and `softure doctor` read. It is the JSON projection of the TS manifest the module
passes to `defineModule` (`@softure-ai/core`), which is the source of truth at runtime; the module's
test checks `module.json` against `toModuleJson(...)` (decided in FD-3, `core-contract`):

```jsonc
{
  "id": "auth",
  "version": "0.1.0",
  "dependsOn": { "security": "^0.1.0", "mailing": "^0.1.0?" },  // "?" = optional
  "dbSchema": "auth",
  "tables": ["users", "sessions", "password_resets", "user_roles"],
  "env": [
    { "name": "SOFTURE_AUTH_INSECURE_COOKIES", "required": false, "description": "dev without HTTPS" }
  ],
  "switches": ["auth.registration_closed"],
  "routes": { "login": "/login", "register": "/register", "forgotPassword": "/forgot-password", "changePassword": "/account/password", "afterLogin": "/" },
  "mount": [
    { "kind": "route-handler", "path": "app/api/softure/auth/[...path]/route.ts" },
    { "kind": "page", "path": "app/login/page.tsx", "export": "LoginPage" }
  ],
  "privacy": { "exports": true, "deletes": true }
}
```

## 4. Database and migrations

**Decision: every module gets its own Postgres schema** (`auth.users`,
`mailing.deliveries`) rather than a prefix in `public`. Reasons:
- app tables and module tables never collide; the app's `drizzle-kit` gets
  `schemaFilter: ["public"]` and does not see module tables;
- permissions are granted per schema (e.g. `GRANT USAGE ON SCHEMA auth`);
- domain tables can still reference `auth.users(id)`, because the module exports its Drizzle table.

Rules:
- Migrations are **plain SQL, forward only**, in `migrations/NNNN_description.sql`. Each file starts
  with a comment describing the rollback plan (as FIRE does: "Rollback: …").
- Table names are **fixed**; only the schema is configurable. Configurable table names hurt the
  predictability of SQL and of agents.
- The `@softure-ai/db` migrator:
  - table `softure.migrations(module, version, name, checksum, applied_at)`;
  - order follows the `dependsOn` graph, and within a module the numbering;
  - every migration runs in a transaction under `pg_advisory_lock`, with checksum verification
    (editing an applied migration is an error);
  - CLI: `softure migrate` (dev and Docker image, bundleable with esbuild, like today's `migrate.cjs`),
    `softure migrate --plan` (dry run), `softure migrate --adopt <module>@<version>`.
- **Adoption** (moving an existing app onto a module): the app writes *its own* migration that
  moves the data into the module schema (`ALTER TABLE users SET SCHEMA auth` + column alignment),
  then `--adopt` marks the module migrations as applied after checking that the schema in the
  database matches the expected one. Details in [05](05-adoption-playbook.md).
- Domain columns never land in module tables. The app keeps them in its own 1:1 table
  (`public.user_profiles(user_id → auth.users.id)`).

## 5. Appearance: tokens, slots, overrides

Three levels, from the most global:

1. **Tokens (global theme).** `@softure-ai/ui` defines a contract of CSS variables prefixed with `--sft-`:
   - semantic colors: `--sft-color-{background,surface,surface-raised,foreground,muted,border,accent,accent-fill,on-accent,danger,success,warning,focus}`;
   - typography: `--sft-font-{sans,mono,heading}`, `--sft-text-{xs…display}`;
   - shape: `--sft-radius-{control,card,pill}`, `--sft-space-{1…8}`, `--sft-shadow-{1,2}`;
   - motion: `--sft-duration-{fast,base,slow}`, `--sft-ease-{out,in-out}`.

   Defaults cover a light and a dark theme (`[data-theme]` + `prefers-color-scheme`).
   The app can override them in three ways: in CSS, through
   `<SoftureThemeProvider theme={{ light: {...}, dark: {...} }}>`, or by importing a `design.json`
   (Impeccable format). The mapping onto the app's Tailwind 4 is a ready-made file,
   `@softure-ai/ui/tailwind.css` (`@theme inline { --color-accent: var(--sft-color-accent) … }`).
2. **Slots (a single instance).** Every composite component accepts
   `classNames={{ root, header, field, label, input, error, actions, … }}`; the slot list is typed.
3. **`unstyled`.** The component renders only structure, ARIA and behavior; the app styles the rest.

**Decision:** components are written in Tailwind 4 on the `--sft-*` tokens, but we
**publish compiled CSS** (`@softure-ai/<module>/styles.css`, `sft-*` classes,
`@layer softure`). The app does not need Tailwind or to scan `node_modules`,
and an app class always wins, because `@layer softure` has lower precedence.

Forbidden (enforced by an architecture test, as in FIRE):
- a raw color or size outside a token;
- `next/*` in `ui/` (links go through an injected `LinkComponent`);
- user-visible text outside `messages` (including `aria-label`).

## 6. Copy and localization

- Every module ships complete `pl` and `en` dictionaries from the start (decision); an architecture
  test checks that both have every key. The app picks a `locale` and passes partial overrides:
  `auth({ messages: { en: { login: { title: "Sign in to Acme" } } } })`.
- Errors from `server/` are **codes** (`auth.invalid_credentials`); the UI translates them through `messages`.
- `locale` and `timezone` come from `defineSoftureConfig`, not from module code (FIRE currently has
  `Europe/Warsaw` even in SQL).

## 7. Configuration and switches

The app has one `softure.config.ts` file:

```ts
import { defineSoftureConfig } from "@softure-ai/core";
import { security, cloudflareIp } from "@softure-ai/security";
import { auth } from "@softure-ai/auth";
import { featureSwitches } from "@softure-ai/feature-switches";
import { mailing, resend } from "@softure-ai/mailing";

export default defineSoftureConfig({
  database: { url: process.env.DATABASE_URL! },
  locale: "pl", timezone: "Europe/Warsaw",
  appOrigin: process.env.APP_ORIGIN!,
  modules: [
    security({ clientIp: cloudflareIp(), buckets: { login: { limit: 50, windowMinutes: 15 } } }),
    auth({ routes: { afterLogin: "/dashboard" }, password: { minLength: 12 }, requireConsent: true }),
    featureSwitches({ switches: [{ name: "auth.registration_closed", default: false, failMode: "closed" }] }),
    mailing({ provider: resend({ apiKey: process.env.RESEND_API_KEY! }), from: "Acme <hello@…>" }),
  ],
});
```

- **A module is enabled by being listed in `modules`.** No entry means no routes, no migrations
  in the plan and no entry in the GDPR export.
- **Runtime switches** belong to the `feature-switches` module. Every module declares its own
  (`module.json → switches`), and they appear in the admin panel automatically.
- Configuration is validated (zod) at startup, and `softure doctor` checks environment variables,
  dependencies, migrations and route mounting.

## 8. Next.js adapter

- Route handlers are mounted with one line:
  `app/api/softure/[...path]/route.ts → export const { GET, POST } = createSoftureHandlers(config)`.
- Pages are ready-made server components:
  `app/login/page.tsx → export { LoginPage as default } from "@softure-ai/auth/next"`.
  The app can also compose its own page from `<LoginForm/>`.
- Server actions: `"use server"` files in the package read the configuration from a registry set in
  `instrumentation.ts` / `softure.config.ts`: `registerSoftureConfig(config)` and
  `getSoftureConfig()` from `@softure-ai/core/next`, kept on `globalThis` (provisional, FD-3).
  **Technical risk:** server actions from `node_modules` and their encryption
  (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `allowedOrigins`) must be confirmed with a spike on `auth`
  in wave 1.
- Route guard: `softureMiddleware(config)`, composed into the app's `proxy.ts`. FIRE currently mixes
  auth and channel tagging in `proxy.ts`, so these become two separate pieces.

## 9. Server code contract (from FIRE, generalized)

- `server/` functions take `ctx: { db: Queryable; clock: Clock; config }` and read nothing from
  request scope. Request scope (cookies, headers) is handled only in `next/`.
- The result is `Result<T, ErrorCode>` from `@softure-ai/core`. Exceptions are for programming errors only.
- Extension hooks: `onRegistered`, `onDeleted`, `authorize(user, action)`. The module calls them,
  the app supplies them.

## 10. Tests (a publishing requirement)

- **Unit/contract:** vitest + `createTestDatabase()` (PGlite with the migrations of the module and its
  dependencies), random order, injected clock, test time zone ≠ UTC (FIRE uses America/New_York).
- **Architecture test** in every module checks: no `next/*` in `server/` or `ui/`, no raw colors,
  no copy outside `messages`, and every table has a migration.
- **E2E:** `examples/next-app` in the repo mounts all modules, and Playwright runs the scenarios
  from `tests/e2e`. The final verification is moving a real app (FIRE) onto the module.
- A version is marked "verified" only after FIRE_TRACKER's CI is green on that version.

## 11. Module README (fixed sections, read by agents)

1. What it provides (one sentence) · 2. Installation · 3. Configuration (full type + example) ·
4. Mounting (routes, pages, middleware) · 5. Migrations and tables · 6. Environment variables ·
7. Switches · 8. Appearance (slots, tokens) · 9. Copy (keys) · 10. Hooks ·
11. GDPR (what it exports and deletes) · 12. Limitations / known gaps.

## 12. Versioning and publishing

- npm workspaces monorepo; every package is versioned independently (SemVer). A database schema
  change requires at least a `minor` version; a breaking change a `major` with migration
  instructions. Version bumps and changelogs: Changesets or `npm version -w`, chosen in FD-2.
- **Releases are tag-driven, one tag per package** (`<package>@x.y.z`, e.g. `core@0.1.0`), in three places,
  exactly like SOFTURE/SKILLS (`.github/workflows/release.yml` there is the reference):
  1. npmjs.com: `@softure-ai/<package>` through trusted publishing (OIDC) with provenance;
  2. GitHub Packages: `@softure/<package>` (GitHub requires the scope to equal the org);
  3. GitHub Release for the tag, with generated notes and the package tarball attached.
- A brand-new package's first publish lands in npm staged publishing: the owner approves it once,
  then configures the trusted publisher. Agents never tag or publish (`release.owner: true`).
- Build: `tsc -p tsconfig.build.json` per package (ESM + `.d.ts` per source file, so `"use client"`
  and `"use server"` directives survive; a bundler such as tsup drops them), and the Tailwind CLI for
  `styles.css`. `npm run build` at the root builds the workspaces in dependency order. Decided in FD-1
  (`monorepo-tooling`); the package template is [`templates/package/`](../templates/package/).
