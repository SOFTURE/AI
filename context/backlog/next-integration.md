# Backlog: Next.js integration

Loose findings from running the packages inside a Next.js app (`examples/next-app`). Entry format:
WORKFLOW §3.

- [x] 2026-10-02 example-app (FD-7): `next build` (Next 16.3, Turbopack) fails on a module defined as
  core documents it, `migrations: { dir: new URL("../migrations/", import.meta.url) }`: Turbopack
  treats a literal `new URL(<string>, import.meta.url)` as an asset reference and cannot resolve a
  folder ("Module not found: Can't resolve './migrations/'"); `/* turbopackIgnore: true */` does not
  apply to `new URL`. The example passes `String(import.meta.url)` instead
  (`examples/next-app/modules/guestbook/index.ts`). Measured for a module inside the app; a module
  package in `node_modules` is bundled the same way unless listed in `serverExternalPackages`
  (inferred, not measured). The module contract or docs/02 should give module authors a form that
  builds; candidates for identity ID-1: a core helper (`migrationsDir(import.meta.url,
  "../migrations/")`), or `dir` accepting a path string (HIGH: every module with tables hits it)
  `foundation/core/README.md` §3, `docs/02-module-standard.md` §4
  Resolved in identity ID-1 (`next-actions-spike`): `resolveMigrationsDir(import.meta.url,
  "../migrations/")` in `@softure-ai/core`, documented in core README §3 and docs/02 §4; measured
  that the literal form fails from `node_modules` too, and that the helper builds.
