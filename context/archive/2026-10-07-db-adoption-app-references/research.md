# Research: db-adoption-app-references

## 1. Reproduction

`foundation/db/tests/fixtures/linked/migrations/0001_create_links.sql` creates `links` with
`user_id integer NOT NULL REFERENCES public.app_users (id)`. On a live database where the app created
`public.app_users` and moved its own `links` table into the `linked` schema, `adoptModule(…, { module: "linked" })`
fails with `db.adopt_reference_failed` (`relation "public.app_users" does not exist`), because
`buildReferenceSchema` (`src/migrations/reference.ts`) applies only the ledger, the target's dependencies and the
target's files to a fresh `pglite://` database. `migrate` with `app.baseline: { linked: 1 }` fails the same way in
`adoptBaseline` (`src/migrations/migrator.ts`).

## 2. The two directions in the issue

| | stubs copied from the live catalog | a separate `reference` hook from the app |
|---|---|---|
| app work | none | write and maintain DDL that mirrors its own tables |
| drift | none: copied at comparison time from the database being compared | the hook's DDL can drift from the real tables, and a drifted FK target silently changes nothing in the comparison while a missing column breaks it |
| availability | the live tables exist at both call sites: `migrate` builds the reference after `before`, `--adopt` runs `before` first | always |
| API | none | new `app.reference`, CLI and `createTestDatabase` plumbing |

Decision: **stubs**. Both call sites already hold a live session at the moment the reference is needed
(`adoptBaseline` gets one; `adoptModule` opens one under the lock), so the catalog read costs one query set.
`adoptModule` builds its reference before taking the lock today; it moves inside the locked section, after the
journal checks (it was the first expensive step anyway, and a refused adoption now skips it).

Running `before` on the scratch database is ruled out by the issue itself: the app's history would also recreate the
tables it moved into the module's schema.

## 3. What a stub must carry

- **Which tables:** ordinary and partitioned tables in every schema except `pg_*`, `information_schema`, the ledger
  schema, every enabled module's schema (they come from their files) and `drizzle`. Extension-owned tables are left
  out (as `introspect.ts` does). Copying all of them rather than parsing module SQL for references keeps the rule
  simple; a stub outside the target's schema never appears in the comparison, which describes the target schema
  only.
- **Columns:** an FK target needs its referenced columns and a PK / unique constraint or a non-partial unique index
  on them. A module data migration may also `SELECT` other columns, so every column is copied with its
  `format_type` (schema-qualified under `search_path = pg_catalog`). Defaults, NOT NULL, checks and FKs are left out:
  they can reference sequences, functions or tables the scratch database lacks, and nothing in the target schema
  depends on them.
- **Types:** enum types in the copied schemas are created first (columns use them). Domains, extension types and
  other user types are not copied; a column whose type cannot be created is skipped and noted. A table that has
  only such columns is still created (empty), so an FK to it fails with the real Postgres error.
- **Robustness:** every stub statement runs on its own. A failing statement is recorded, not fatal: a module that
  does not reference that table must still adopt as before. When the module files then fail, the reason names the
  skipped stub objects, so a missing type is visible.

## 4. What stays the same

- The comparison (`describeSchema` of the target schema) is unchanged; an FK line prints
  `FOREIGN KEY (user_id) REFERENCES app_users(id)` qualified per `search_path = pg_catalog`, i.e.
  `REFERENCES public.app_users(id)` on both sides, so a module FK that differs from the app's (e.g. `ON DELETE`)
  still shows as a mismatch.
- No new problem code: a failure still reports `db.adopt_reference_failed` with a richer reason.
- `planMigrations`, `createTestDatabase` and the CLI need no change: they reach the reference only through
  `migrate` / `adoptModule`.
