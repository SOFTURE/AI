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
3. **Database adoption (no data loss):**
   1. Write an application migration that moves the existing tables into the module's schema
      (`ALTER TABLE … SET SCHEMA`, column renames, domain columns into a 1:1 table in `public`).
   2. Run `softure migrate --adopt <module>@<version> --plan`, then without `--plan`. The migrator
      compares the schema and marks the module's migrations as applied.
   3. Set the application's `drizzle.config.ts` to `schemaFilter: ["public"]` and remove the
      module's tables from `schema.ts`. Domain tables now reference the tables the module exports.
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
