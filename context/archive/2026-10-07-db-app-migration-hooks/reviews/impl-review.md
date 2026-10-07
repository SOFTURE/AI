# Implementation review: db-app-migration-hooks

Reviewed: the branch diff against `plan.md` (both phases), `change.md`, issue #153 point by point, and the project
conventions (AGENTS.md). Mode: autonomous.

Verdict: **approve** after the fixes below (applied before the last commit).

## Issue #153, point by point

| Point | Where |
| --- | --- |
| `migrate` takes `app: { before, after }` | `migrator.ts` `MigrateOptions.app`, `tests/app-migrations.test.ts` (both drivers) |
| the same in `runMigrateCli` | `cli/run.ts` `RunMigrateCliOptions.app`, `tests/cli.test.ts` (migrate, plan, failure, adopt) |
| `createTestDatabase(modules, { … })` with the hooks in the template key | `testing.ts` (`app`, key per hook object), `tests/testing.test.ts` |
| order documented, drizzle recipe | db README §4-5, docs/02 §4, docs/05 step 3; the recipe is the one `app-migrations.test.ts` runs |
| CJS bundles | README "ESM only"; `resolveMigrationsDir` throws naming the CJS bundle (`core/tests/module.test.ts`; also measured on a real esbuild `--format=cjs` bundle) |
| `drizzle-kit generate` ignores `schemaFilter` | docs/02 §4 and docs/05 step 3.3: import module tables, never re-export them |
| reserve `drizzle` | `RESERVED_SCHEMAS`, `describeProblem`, README §5, docs/02 §4; tested |

## Findings

### I1 (Warning, fixed): the ledger ran after `before`

**Evidence:** the first implementation ran `before` ahead of every pending step, the ledger's own file included. A
failing `before` on a fresh database left no `softure.migrations` at all (the "before fails" test read
`relation "softure.migrations" does not exist`), and a hook could not rely on the ledger existing.

**Fix:** the ledger's steps run first, then `before`, the module files, `after`. README §5 states the order.

### I2 (Suggestion, fixed): `migrate`'s doc comment omitted the ledger

Fixed to name the full order.

### Checked, no finding

- **Tests seen red first:** `app-migrations.test.ts` 16 of 18 red before the code; the CLI and test-database cases
  6 red with the source stashed; the CJS guard red before the check.
- **Both drivers:** the hook tests run on PGlite and on Postgres 16 (`SOFTURE_TEST_POSTGRES_URL`), including drizzle's
  real migrators and the cause chain of a broken drizzle file.
- **No silent swallow:** a hook's throw becomes a result value with the whole cause chain; nothing else is caught.
- **Scope:** `adopt.ts`, `core/src/config.ts` and the bin untouched (#152, #155); the bin reads only the config, which
  the README says.
- **Language gate:** English only; no Polish in the diff.
