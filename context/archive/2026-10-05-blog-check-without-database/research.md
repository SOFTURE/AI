# Research: blog-check-without-database

Input: change.md (BF-6). Mode: autonomous.

## Current state

- The failure is not in the loader. `loadConfig` (`foundation/core/src/cli/load-config.ts`) imports the
  app's `softure.config.*`; the file itself calls `defineSoftureConfig`, which throws while the module
  is imported when the database is unusable:
  - `database: { url: process.env.DATABASE_URL ?? "" }` (core README §3) → `database.url: must not be empty`;
  - `database: { url: process.env.DATABASE_URL! }` (auth README, module standard §7) → zod "expected string";
  - `database: null` with `blog()` listed → `database: required because module "blog" has a database schema`
    (`checkDatabase`, `foundation/core/src/config.ts:169`).
  The loader then reports `cannot load <path>: … call runBlogCli from an app script`.
- `runCheck` (`modules/blog/src/cli/run.ts:273`) never reads `config.database`; only `runPublish`
  (`run.ts:228`) does, and it already refuses `database: null` with its own message.
- `.github/workflows/blog-links.yml` has a `database-url` input (default
  `postgres://unused:unused@localhost:5432/unused`) and sets `DATABASE_URL` from it for the whole job.
  No workflow in this repository calls it; the BL-6 README points apps at it.

## Options

1. **The blog bin builds a check-only config.** Impossible without the app's file: the throw happens
   inside the app's own module while it is imported, before the bin sees any value. The bin would have
   to parse the config file itself, or ask the app for a second config. Rejected.
2. **Core lets a command opt out of the database requirement while it loads the config.** The bin
   says "database optional" before the import; `defineSoftureConfig` then reads a missing or empty
   `database.url` as `database: null` and skips the "required because module … has a database schema"
   check. The signal must reach the copy of core the app's file imports, which can be another instance
   than the bin's (two installs, a bundled bin), so it lives on `globalThis` under `Symbol.for`, not in
   a module variable. An environment variable would work too but leaks into child processes and can be
   set by accident in a shell; a scoped global is set and restored around one import.
   Chosen.

Shape: `withDatabaseOptional(load)` in `@softure-ai/core` (no `node:` import, so the root entry: an app
script that imports its config itself can wrap the import too), and `loadAppConfig({ database:
"optional" })` / `loadConfig(path, appScript, { database })` in `@softure-ai/core/cli` using it.

## Risks

- ESM caches a module: a config imported once in a process keeps the result of its first import. A bin
  imports it once; an app script imports it once. Documented, not handled.
- A config with a real URL is unchanged in optional mode (the URL is kept), so a mistyped variable name
  is not hidden from `publish`, which loads in required mode.

## SOFTURE modules

None covers this; it extends core's config contract and the BF-1 loader.

## Open questions

None.
