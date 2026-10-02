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
- A module points at its folder with
  `migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") }` (`@softure-ai/core`).
  Never `new URL("../migrations/", import.meta.url)`: Turbopack takes that literal form for an asset
  import and fails `next build` on a folder, also inside `node_modules` (identity ID-1).
- Migrations are **plain SQL, forward only**, in `migrations/NNNN_description.sql`. Each file starts
  with a comment describing the rollback plan (as FIRE does: "Rollback: …").
- Table names are **fixed**; only the schema is configurable. Configurable table names hurt the
  predictability of SQL and of agents.
- The `@softure-ai/db` migrator (decided in FD-4, `db-migrator`; full rules in the
  [db README](../foundation/db/README.md) §4-5):
  - ledger `softure.migrations(module, version, name, checksum, module_version, method, applied_at)`,
    created by the package's own migration; the id `softure` and the schemas `softure`, `public`,
    `information_schema` and `pg_*` are reserved;
  - order follows the `dependsOn` graph, and within a module the numbering (1..n, no gaps);
  - each file runs in its own transaction with its ledger row, inside the module schema
    (`SET LOCAL search_path TO <schema>, public`), so no top-level statement may begin, end or
    abort a transaction (`BEGIN`, `COMMIT`, `END`, `ROLLBACK`, `ABORT`);
  - the run holds a session `pg_advisory_lock`; every applied file is checked first (edited,
    renamed, deleted or out of order refuses the whole run before anything is applied);
  - CLI: `softure migrate` (bin, or an app script calling `runMigrateCli`, which esbuild bundles
    for an image), `--plan` (dry run), `--adopt <module>@<version>`, and for bundles
    `--export-migrations <dir>` (build stage) with `--migrations-dir <dir>` (run stage);
  - unit tests: `createTestDatabase(modules)` from `@softure-ai/db/testing`.
- **Adoption** (moving an existing app onto a module): the app writes *its own* migration that
  moves the data into the module schema (`ALTER TABLE users SET SCHEMA auth` + column alignment),
  then `--adopt` marks the module migrations as applied after checking that the schema in the
  database matches the expected one: the module's migrations are applied to a scratch PGlite and
  both schemas are compared through `pg_catalog` (relations, columns, constraint and index names
  and definitions, sequences, triggers, functions and types); any difference refuses. Details in
  [05](05-adoption-playbook.md).
- Domain columns never land in module tables. The app keeps them in its own 1:1 table
  (`public.user_profiles(user_id → auth.users.id)`).

## 5. Appearance: tokens, slots, overrides

Three levels, from the most global:

1. **Tokens (global theme).** `@softure-ai/ui` defines a contract of CSS variables prefixed with `--sft-`:
   - semantic colors: `--sft-color-{background,surface,surface-raised,foreground,muted,border,border-strong,accent,accent-fill,accent-fill-hover,on-accent,danger,success,warning,focus}`;
   - typography: `--sft-font-{sans,mono,heading}`, `--sft-text-{xs,sm,base,lg,xl,2xl,3xl,display}`;
   - shape: `--sft-radius-{control,card,pill}`, `--sft-space-{1…8}`, `--sft-shadow-{1,2}`;
   - motion: `--sft-duration-{fast,base,slow}`, `--sft-ease-{out,in-out}`.

   Defaults cover a light and a dark theme (`[data-theme]` + `prefers-color-scheme`); colours and
   shadows have a value per scheme, the rest is shared. The app can override them in three ways: in
   CSS, through `<SoftureThemeProvider theme={{ light: {...}, dark: {...}, shared: {...} }}>`, or by
   passing a `design.json` (Impeccable, `schemaVersion: 2`) as `design`. The mapping onto the app's
   Tailwind 4 is a ready-made file, `@softure-ai/ui/tailwind.css`
   (`@theme inline { --color-accent: var(--sft-color-accent) … }`). Decided in FD-5 (`ui-tokens-theme`);
   the token list lives in `foundation/ui/src/theme/tokens.ts`.
2. **Slots (a single instance).** Every composite component accepts
   `classNames={{ root, header, field, label, input, error, actions, … }}`; the slot list is typed.
3. **`unstyled`.** The component renders only structure, ARIA and behavior; the app styles the rest.

The primitives every module builds on (Button, Modal, Toast, Select, Switch, Checkbox,
SegmentedControl, the form fields, Card, Stat, Hint, ActionForm, icons) live in `@softure-ai/ui` and
follow all three levels; built-in copy comes through `locale` and partial `messages`. Decided in FD-6
(`ui-primitives`); the list and usage are in
[`foundation/ui/README.md`](../foundation/ui/README.md#primitives).

**Decision:** components are written in Tailwind 4 on the `--sft-*` tokens, but we
**publish compiled CSS** (`@softure-ai/<module>/styles.css`, `sft:` prefixed classes such as
`sft:bg-surface`, `@layer softure`). The app does not need Tailwind or to scan `node_modules`,
and an app class always wins: `styles.css` opens with
`@layer theme, base, softure, components, utilities;`, so softure sits above the app's resets and
below its components and utilities. The app imports `styles.css` before its own Tailwind. How the
build works: [`foundation/ui/README.md`](../foundation/ui/README.md#how-the-css-is-built).

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

Decided by identity ID-1 (`next-actions-spike`, spike package `spikes/next-actions/`, e2e
`examples/next-app/e2e/next-actions.spec.ts`). Measured on Next 16.3 with Turbopack, in `next dev`
and in `next build && next start`, with the package installed as a packed copy (`install-links`,
what a registry install gives) and linked from the workspace.

**Verdict: modules ship their server actions, route handlers and pages from the package.** No
`transpilePackages`, no app-side wrappers. The fallbacks (route handlers + client hooks, generated
thin actions) are not needed.

- **Mounting is one line per file**, a re-export the app owns:
  - page: `app/login/page.tsx → export { LoginPage as default } from "@softure-ai/auth/next"`;
  - route handlers: `app/api/auth/[...path]/route.ts → export { GET, POST } from "@softure-ai/auth/next"`;
  - server actions need no mounting: a `"use server"` file in the package's `dist/` (tsc keeps the
    directive) is registered when a page or client component imports it.
  The app can still compose its own page from the module's components (`<LoginForm/>`).
- **Config:** package code calls `getSoftureConfig()` from `@softure-ai/core/next`. The app calls
  `registerSoftureConfig(config)` in `softure.config.ts` and imports that file from
  `instrumentation.ts`. Measured: the registry is filled in actions, route handlers and server
  components, at request time and while `next build` prerenders a static page.
- **Bound arguments are not secret.** `action.bind(null, value)` sends `value` to the browser in
  plain text and the server accepts whatever comes back (measured: a tampered bound value reached
  the action). A module never binds an identity, a role or a price: the action derives them again
  from the session and the database. Only closures of inline `"use server"` functions are
  encrypted, and module actions live in top-level `"use server"` files, so they have none.
- **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`:** without it, every build gets new action IDs (measured:
  two builds of the same code, different IDs), so a page from one build cannot call an action on an
  instance from another build (rolling deploys, several containers built separately). With the key
  set to the same value for every build, the IDs are equal. Apps that run more than one instance or
  build per container set it (32 random bytes, base64) as a secret; instances started from one build
  share IDs anyway.
- **Origins:** Next refuses an action whose `Origin` does not match the host (`x-forwarded-host`
  first). It treats package actions exactly like app actions. An app behind a proxy that changes the
  host lists the public origin in `experimental.serverActions.allowedOrigins`.
- **Packaging:** React and Next are `peerDependencies` of a module. The app router uses Next's own
  React, so a package resolved from another folder (a workspace link) does not get a second copy.
  Client components keep `"use client"` in `dist/` (L-001). A module that must be bundled as-is goes
  to the app's `serverExternalPackages`; none of ours needs it.
- **Workspace links** (`npm install --install-links=false`) work once Turbopack may read the linked
  folders: `turbopack.root` must be the repository root. The example app keeps the root at its own
  folder on purpose, so it only ever tests packed copies.
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
  instructions. Version bumps: `npm run release:version -- <package> <bump>` (`npm version -w`, keeps
  `module.json` in step, commits and tags `<package>@x.y.z`); no Changesets. Release notes are
  generated per tag on the GitHub Release. Decided in FD-2 (`release-pipeline`); runbook:
  [scripts/release/README.md](../scripts/release/README.md).
- **Releases are tag-driven, one tag per package** (`<package>@x.y.z`, e.g. `core@0.1.0`), in three places,
  exactly like SOFTURE/SKILLS (`.github/workflows/release.yml` there is the reference):
  1. npmjs.com: `@softure-ai/<package>` through trusted publishing (OIDC) with provenance, as a
     **staged** version that goes live when the owner approves it with 2FA;
  2. GitHub Packages: `@softure/<package>` (GitHub requires the scope to equal the org);
  3. GitHub Release for the tag, with generated notes and the package tarball attached.
- A brand-new package's first stage authenticates with an `NPM_TOKEN` secret (npm binds a trusted
  publisher only to an existing package): the owner approves it once, then configures the trusted
  publisher (`SOFTURE` / `AI` / `release.yml`, stage only). Agents never tag or publish
  (`release.owner: true`).
- A tarball ships `dist/` and `src/` (without tests), `migrations/`, `module.json` and the repository
  `LICENSE`; shipping `src/` keeps source maps and the `@softure-ai/source` export condition valid.
- Build: `tsc -p tsconfig.build.json` per package (ESM + `.d.ts` per source file, so `"use client"`
  and `"use server"` directives survive; a bundler such as tsup drops them), and the Tailwind CLI for
  `styles.css`. `npm run build` at the root builds the workspaces in dependency order. Decided in FD-1
  (`monorepo-tooling`); the package template is [`templates/package/`](../templates/package/).
