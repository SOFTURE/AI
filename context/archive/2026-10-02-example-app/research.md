# Research: example-app

Input: change.md, roadmap FD-7, research.sources (`docs/`, `../../FIRE_TRACKER/`). Depth: normal.
Snapshot: 50c4484 on claude/fd-7-example-app-uknuk7, 2026-10-02 15:10 Europe/Warsaw.
Method: one researcher, no subagents. The packages' public surface (`foundation/{core,db,ui}`), the
repository gates, and FIRE_TRACKER's Next and Playwright setup were read directly; the roadmap
unknown was settled by a throwaway spike (a Next 16 app installing the packages, built and served
against Postgres 16 in Docker), whose measurements are quoted below.

## Summary

Nothing in the repository runs the packages inside an app yet: every test imports sources through
the `@softure-ai/source` condition (`vitest.config.mts:16-20`, `tsconfig.base.json:8`), so a wrong
`files` list, a missing `"use client"` in `dist/` or a broken `softure migrate` against a real
config would reach users first. The example app must therefore consume built packages. npm's
`install-links` turns `file:` dependencies into packed copies (measured: `node_modules/@softure-ai/ui`
is a directory holding `README.md, dist, package.json, src`, the `files` list, and the lockfile
records `resolved: file:../../foundation/ui` without an integrity hash, so rebuilding a package does
not break `npm ci`). The app cannot be a workspace: `findWorkspaces` feeds the package-shape tests
and the release scripts (`scripts/build-workspaces.mjs:47-71`, `tests/repo/packages.test.ts:54`), and
the root `tsconfig.json` and ESLint config type the whole tree with NodeNext and the source
condition. One integration bug surfaced: Turbopack fails `next build` on the documented
`migrations: { dir: new URL("../migrations/", import.meta.url) }` (details under Risks).

## Current state

- **Config and registry.** `defineSoftureConfig({ database, locale, timezone, appOrigin, modules })`
  (`foundation/core/README.md` §3); `registerSoftureConfig` in `@softure-ai/core/next`, imported from
  `instrumentation.ts` (`foundation/core/README.md` §4, `foundation/core/src/next/index.ts:3`).
- **Modules.** `defineModule({ manifest, messages, options?, migrations?, privacy? })`; a `dbSchema`
  requires `migrations` with a `file:` URL (`foundation/core/src/module.ts`, `checkMigrations`).
- **Database.** `createDatabase(url, { max })` returns a pg or PGlite handle by URL scheme
  (`foundation/db/README.md` §3). The `softure` bin (`foundation/db/package.json` `bin`) loads
  `softure.config.{ts,mts,js,mjs}` with a dynamic import, so a `.ts` config needs Node type stripping
  and `.ts` extensions on relative imports (`foundation/db/src/cli/command.ts:1-4`). Node here is
  22.22.0; type stripping is on by default from 22.18.
- **Ledger.** `softure.migrations (module, version, name, checksum, module_version, method, applied_at)`
  (`foundation/db/README.md` §5). Measured: a fresh database gets `softure 1 ledger` and the module's
  file, `guestbook 1 create_entries`, both `applied`.
- **UI.** One barrel (`foundation/ui/src/index.ts:3-5`); client files carry `"use client"`, which
  `tsc` keeps (measured: `foundation/ui/dist/ui/modal.js:1`). `SoftureThemeProvider` and
  `ThemeScript` are server-safe (`foundation/ui/src/ui/softure-theme-provider.tsx:15-19`). Wiring:
  `@import "@softure-ai/ui/styles.css"`, `ThemeScript` in `<head>`, `suppressHydrationWarning` on
  `<html>` (`foundation/ui/README.md`, "Install and wire up"). The theme choice is the cookie
  `sft-theme`; System removes `data-theme` (`foundation/ui/src/theme/theme-cookie.ts:78-88`).
- **Gates.** CI runs typecheck, lint and tests in `ci.yml`; tests run with a `postgres:16` service
  (`.github/workflows/ci.yml:31-50`). `integration.local` is `null` (`context/workflow.json`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Example app | `examples/next-app/**` (new) | the app, its module, its e2e |
| CI | `.github/workflows/e2e.yml` (new) | the e2e job |
| Root tooling | `tsconfig.json`, `eslint.config.mjs`, `package.json` | keep the app out of the root typecheck; lint it once installed; `npm run e2e` |
| Workflow | `context/workflow.json` | `integration.local` |
| Backlog | `context/backlog/next-integration.md` (new) | the Turbopack finding |

`examples/` is outside the `workspaces` patterns (`package.json`), so npm treats the app as its own
project and the package tests do not see it.

## Data

The app's own module `guestbook` owns schema `guestbook`, table `entries (id identity, message
text 1..200, created_at)`. The ledger is read-only for the app. Tests create and delete their own
rows; nothing else writes.

## Tests

- Today: no app-level or browser tests; Vitest only (`vitest.config.mts:27-31`).
- Playwright 1.63 is current on npm; this container ships Chromium build 1194 under
  `/opt/pw-browsers`, so local runs need `executablePath`; CI installs Playwright's own Chromium
  (FIRE: `npx playwright install --with-deps chromium`, `FIRE_TRACKER/.github/workflows/integration-tests.yml:80`).
- FIRE drives the theme switch by clicking the visible label text, because the radios are
  visually hidden (`FIRE_TRACKER/integration/theme-switch.test.ts:63-75`); measured here: `check()`
  on the radio times out with "label intercepts pointer events".
- The modal focuses its panel on open and returns focus to the opener
  (`foundation/ui/src/ui/modal.tsx:113`, `:388-391`).

## Patterns to follow

- Next config: `serverExternalPackages: ["@electric-sql/pglite", "pg"]`, `poweredByHeader: false`
  (`FIRE_TRACKER/next.config.ts`).
- Playwright: Chromium project, `trace: "retain-on-failure"`, `forbidOnly` in CI
  (`FIRE_TRACKER/playwright.config.ts`); FIRE starts its stack outside Playwright, here
  `webServer` runs `next start` because the subject is the packages, not an image.
- Errors as values with `safeError` and `errorLogLabel` (`foundation/core/README.md` §9).
- Copy in `messages/{en,pl}.ts`, exempt from the language gate (`scripts/check-language.mjs:49`).

## Prior work

- FD-4 archive: "No cached connection for Next.js dev reloads yet; the Next adapter (identity ID-1,
  FD-7) adds it" (`foundation/db/README.md` §12). The app keeps one handle on `globalThis`; the
  package-level adapter stays with ID-1.
- FD-6 archive: manual screenshots of the primitives (`context/archive/2026-10-02-ui-primitives/reviews/`);
  FD-7 turns the theme and modal checks into automated ones.
- `context/backlog/packaging.md`: packages ship `src/` beside `dist/`, so maps resolve.

## SOFTURE modules

Covered: the app uses `@softure-ai/core`, `db` and `ui` only. Auth, rate limits and switches are
not applicable to a test fixture (no users, never deployed).

## Risks

- **Turbopack and module migrations (found, HIGH for module authors).** Measured: `next build`
  fails with "Module not found: Can't resolve './migrations/'" on
  `new URL("./migrations/", import.meta.url)`, also with `/* turbopackIgnore: true */` and with
  `import.meta.url` in a `const` (Turbopack follows constants); `String(import.meta.url)` builds and
  the module still receives a `file:` URL at runtime. Mitigation here: the `String()` form in the
  app's module. The contract fix belongs to core (out of this change's ownership): backlog entry.
- **Resolution above the app (found in implementation).** The app sits inside the repository, whose
  `node_modules` links the workspace packages. With `dist` removed from ui's `files`, `next build`
  still passed and `tsc` resolved `/home/claude/AI/foundation/ui/dist/index.d.ts`: both walked up past
  the packed copy. Mitigation: `turbopack.root` set to the app folder (measured: the same break then
  fails the build with "Can't resolve '@softure-ai/ui'"). TypeScript keeps walking up; Node (the
  `softure` bin, `next start`, Playwright) stops at the first package found.
- **Stale packed copies.** After a package rebuild the app keeps old copies until `npm ci`. The
  e2e script always reinstalls.
- **Port clash** with a developer's own Postgres: compose maps 5433.
- **Lint without install.** Typed ESLint rules cannot type the app before its `npm ci`; lint it only
  when installed, and always in the e2e job.

## Relevant lessons

- L-001: packages build with `tsc` so `"use client"` survives; the app is the first consumer that
  would break if it did not (measured: it does not).

## Answers to unknowns

- **Workspace linking vs. packed tarballs (roadmap).** Packed, through `install-links=true` on
  `file:` dependencies: closest to a registry install, keeps a lockfile for third-party packages,
  and needs no tarball bookkeeping. Workspace linking would put the app under the package tests
  and resolve sources instead of `dist/`.
- **Postgres in Docker.** Local: `compose.yaml` (`postgres:16`); CI: a `postgres:16` service, the
  same image `ci.yml` uses. Measured locally: both migrate and serve.
- **Next 16 and React 19 with the barrel import.** Measured: server components import
  `Card`, `ThemeSwitch` and friends from `@softure-ai/ui`; the build and hydration work.

## Open questions

- Turbopack vs. the migrations URL contract: decided (auto): work around in the app, file the
  contract fix in `context/backlog/next-integration.md` for FD-8 or identity ID-1, since
  `foundation/core` is outside this change's ownership.
- Run e2e on every push or only on PRs: decided (auto): every push and PR, like `ci.yml`; the job
  is a few minutes.

## Decisions (auto)

- Depth `normal`: no money, auth or irreversible data; the database is a disposable test fixture.
- The demo module lives in the app (`modules/guestbook/`) rather than as a workspace package: a
  package would need the twelve-section README and release shape for a fixture nobody installs.
