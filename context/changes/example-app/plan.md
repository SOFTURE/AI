# Plan: example-app

Input: change.md, research.md. Complexity: medium.

## Goal

`examples/next-app` is a Next 16 app that installs `@softure-ai/core`, `db` and `ui` as packed
packages, configures them in `softure.config.ts`, migrates one module on Postgres, and passes a
Playwright suite (theme switch, a modal with a server-action form, the migration ledger) locally
through `npm run e2e` and in CI through `.github/workflows/e2e.yml`. `integration.local` in
`context/workflow.json` is `npm run e2e`.

**Out of scope:** changes to `foundation/*` (the Turbopack finding goes to the backlog); auth, rate
limits or a deployable image; a Next adapter package (identity ID-1).

## Approach

**Starting point:** packages are tested only from sources (`vitest.config.mts:16-20`); nothing
installs their `dist/`. `integration.local` is `null`.

**Chosen:** a standalone npm project under `examples/` with `file:` dependencies and
`install-links=true`, so `npm ci` installs packed copies - closest to a registry install with no
tarball bookkeeping (research, Answers to unknowns).
Rejected: a workspace - it would fall under the package-shape tests and resolve sources;
`npm pack` tarballs in the lockfile - their integrity changes on every rebuild.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Demo module | `modules/guestbook` inside the app, one table | exercises `defineModule`, the migrator and the ledger without a fixture package | research |
| Migrations dir | `new URL("./migrations/", String(import.meta.url))` | the literal form fails `next build` under Turbopack | research (measured) |
| Postgres | `compose.yaml` on 5433 locally, a `postgres:16` service in CI | same image as `ci.yml`; no clash with a local 5432 | research |
| Server | Playwright `webServer` runs `next start` after `next build` | tests the production build of the packages | plan |
| Root gates | root `tsconfig` excludes `examples`; ESLint lints the app once installed; the e2e job lints it | the app has its own resolution (Bundler) and dependencies | research |
| Resolution | `turbopack.root` is the app folder | the repository's `node_modules` would stand in for a file a packed copy lacks (found by the W1 check) | implement |
| Browsers | `PLAYWRIGHT_CHROMIUM_PATH` overrides Playwright's Chromium | cloud sessions ship their own; CI installs Playwright's | research |

## Phase 1: App on packed packages

**Discipline:** test-after. **Files:** `examples/next-app/{package.json,package-lock.json,.npmrc,.gitignore,tsconfig.json,next.config.ts,softure.config.ts,instrumentation.ts,compose.yaml,.env.example}`, `examples/next-app/{app,lib,messages,modules}/**`, root `tsconfig.json`, `eslint.config.mjs`

1. `package.json`: `file:../../foundation/{core,db,ui}`, Next 16.3, React 19, drizzle, zod;
   scripts `dev`, `build`, `start`, `typecheck`, `migrate` (`softure migrate`), `e2e`.
2. `.npmrc`: `install-links=true`, `include=dev`.
3. `modules/guestbook`: manifest (`dbSchema: guestbook`, `tables: [entries]`), migration
   `0001_create_entries.sql` with a Rollback comment, drizzle tables for `entries` and the ledger,
   queries returning `Result` through `safeError`.
4. `softure.config.ts` registers the config; `instrumentation.ts` imports it on Node only.
5. `app/`: layout with `ThemeScript`, `SoftureThemeProvider`, `ToastHost`; page with `ThemeSwitch`,
   the guestbook card and the ledger card; `AddEntry` (`Modal` + `ActionForm`); server action
   `addGuestbookEntry` validated with zod.
6. `messages/{en,pl}.ts`: all copy, including error codes.
7. Root `tsconfig.json` excludes `examples`; `eslint.config.mjs` ignores the app until it is installed
   and always ignores `.next`, `next-env.d.ts` and Playwright output.

**Tests:** none new in this phase; the build is the check.

**Done when:**
- Automated: `npm ci`, `npm run migrate` and `npm run build` succeed in `examples/next-app` against Postgres.
- Automated: `npx eslint examples --max-warnings 0` passes with the app installed.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: E2e harness and CI

**Discipline:** test-after. **Files:** `examples/next-app/{playwright.config.ts,e2e/**,scripts/e2e.mjs,README.md}`, `.github/workflows/e2e.yml`, root `package.json`, `context/workflow.json`, `context/backlog/next-integration.md`

1. `playwright.config.ts`: Chromium, `webServer` `next start` on 3100, no retries, traces on failure.
2. `e2e/theme.spec.ts`: Dark applies at once and changes the body background, survives a reload,
   System removes `data-theme`.
3. `e2e/guestbook.spec.ts`: Escape closes the modal and returns focus; Cancel closes it; a saved
   entry is listed with a toast (and deleted afterwards); a blank entry returns a field error.
4. `e2e/migrations.spec.ts`: the page lists `guestbook 1 create_entries (applied)` and
   `softure 1 ledger (applied)`.
5. `scripts/e2e.mjs` + root `npm run e2e`: build packages, `npm ci`, compose Postgres unless
   `DATABASE_URL`, migrate, build, Playwright.
6. `.github/workflows/e2e.yml`: the same steps, Postgres service, lint of the app, traces uploaded on failure.
7. `context/workflow.json`: `integration.local: "npm run e2e"`.
8. README of the app; backlog entry for the Turbopack finding.

**Tests:** the six Playwright tests above.

**Done when:**
- Automated: `npm run e2e` at the root passes against the compose Postgres.
- Automated: the `e2e` workflow is green on the pull request.
- Automated: Gates green (typecheck, lint, test).

## Risks and rollback

- Turbopack rejects the documented migrations URL → app uses the `String()` form; backlog entry.
- A Playwright or Next update breaks the suite → both are locked in the app's lockfile.
- Rollback: delete `examples/`, `.github/workflows/e2e.yml`, the root `e2e` script, and restore
  `integration.local: null` and the two root config lines. Nothing else depends on them.

## Decisions (auto)

- Two phases, test-after: the subject is an integration, measurable only once the app builds.
- `retries: 0` in CI: a test that passes on a retry is reported, not hidden.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: App on packed packages

#### Automated
- [ ] 1.1 `npm ci`, `npm run migrate` and `npm run build` succeed in `examples/next-app` against Postgres
- [ ] 1.2 `npx eslint examples --max-warnings 0` passes with the app installed
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: E2e harness and CI

#### Automated
- [ ] 2.1 `npm run e2e` at the root passes against the compose Postgres
- [ ] 2.2 The `e2e` workflow is green on the pull request
- [ ] 2.3 Gates green (typecheck, lint, test)
