# 05 — Playbook: an application replaces its own code with a SOFTURE module

Instructions for the application's agent (FIRE_TRACKER first). One module is one change
(e.g. `context/changes/<id>/`) and one branch.

## Input

- A published module version `@softure-ai/<module>@x.y.z` with its README (sections from
  [02-module-standard](02-module-standard.md) §11).
- The "application file → module counterpart" map from [01-module-assessment](01-module-assessment.md).

## Steps

1. **Inventory.** Find every file, table, route, environment variable, script and test of the
   application that the module covers. List the behavioral differences: what the module does
   differently and what the application must supply through a hook or configuration.
2. **Configuration.** Add the module to `softure.config.ts`. Pass the application's copy and
   routes (e.g. localized slugs) through `messages`/`routes`, so users notice no change.
3. **Database adoption (no data loss).** First pass the application's own migrations to the migrate
   step as `app: { before, after }` ([db README](../foundation/db/README.md) §4) and to
   `createTestDatabase`, so dev, unit tests, integration and the image run them in one order:
   `before`, the module files, `after`. Then:
   1. Write an application migration that moves the existing tables into the module's schema
      (`ALTER TABLE … SET SCHEMA`, column renames, domain columns into a 1:1 table in `public`).
   2. Run `softure migrate --adopt <module>@<version> --plan`, then without `--plan`; that run
      applies `before` first, so the migration from step 1 and the adoption are one command. It
      applies the pending migrations of the modules the module depends on first. When the app's
      tables match only the module's first files (later files add tables the app never had), add
      `--through <n>`: files 1..n are adopted, the rest is applied by the next migrate. The
      migrator builds the schema the module's migrations create on a scratch PGlite, compares it with the
      database (names of constraints and indexes included) and only on an exact match marks the
      module's migrations as `adopted`. Every difference is printed as `missing in database: …` or
      `unexpected in database: …`; align it in the application's migration and run again. A
      dependency whose tables the application created too is adopted first. A module whose SQL
      references the application's own tables (a foreign key to `public.app_users`) adopts the
      same way: the scratch database gets stubs of those tables, copied from the live database
      after `before` ran. PGlite must be installed where this runs, also in an
      image that otherwise uses `pg`.
   3. Declare the baseline next to the hooks, `app: { before, baseline: { <module>: n } }` with the
      same n. The application's history still creates the moved tables on every fresh database (unit
      tests, integration, a reset dev database); with the baseline, plain `migrate` adopts files 1..n
      there and applies the rest, and on a database already adopted it does nothing extra. Keep n
      when the module ships new files. With the baseline the deploy's plain migrate also adopts
      production by itself; `--adopt … --plan` stays the way to read the differences first.
   4. Set the application's `drizzle.config.ts` to `schemaFilter: ["public"]` and remove the
      module's tables from `schema.ts`. Domain tables now reference the tables the module exports:
      import them, never re-export them from `schema.ts` (`drizzle-kit generate` ignores
      `schemaFilter` and would emit their `CREATE TABLE`).
4. **Mounting.** Add route handlers, pages and middleware as the module README describes.
5. **Code removal.** Delete the application's own implementation and its unit tests (the module
   has its own). **The application's integration tests stay.** They are the proof that the switch works.
6. **Verification.** The full application integration suite, the unit tests, and a dry run of the
   migrations against a copy of the production database must all pass.
7. **Feedback to SOFTURE.** Report anything the module did not cover (a missing hook, slot or
   message) as an issue in the SOFTURE/AI repo. Do not work around it locally in the application.

## Definition of done

The application no longer contains code within the module's scope, production data is intact,
CI is green, and the module version gets a "verified in: FIRE_TRACKER@<sha>" note in its CHANGELOG.
