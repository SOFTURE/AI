# Plan: db-adoption-app-references

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: small (one phase).

## Goal

- New `src/migrations/stubs.ts`:
  - `readAppTables(session, excludedSchemas): Promise<AppCatalog>` reads, from the live database, the enum types and
    the tables (columns with `format_type`, PK / unique constraint definitions, non-partial non-expression unique
    indexes that back no constraint) of every schema outside `pg_*`, `information_schema` and `excludedSchemas`,
    extension-owned objects left out. Read-only transaction with `search_path = pg_catalog` (as `describeSchema`).
  - `createAppStubs(session, catalog): Promise<string[]>` runs, statement by statement outside a transaction:
    `CREATE SCHEMA IF NOT EXISTS`, each enum, each table (empty), each column (`ALTER TABLE … ADD COLUMN`), each key
    constraint, each unique index. Returns one line per statement that failed (`<object>: <error>`).
- `buildReferenceSchema` gains `appTables?: AppCatalog`; stubs are created after the ledger files and before the
  modules; when a module file fails and stubs were skipped, the reason ends with
  `(app table stubs skipped: …)`.
- `migrate` (`adoptBaseline`) and `adoptModule` read the catalog from their live session, excluding the ledger schema,
  every enabled module's schema and `drizzle`. `adoptModule` builds the reference inside the lock after the journal
  checks.
- README (§ adoption), docs/02 §4 and docs/05 step 3: one paragraph each saying module SQL may reference app tables;
  the reference copies their stubs from the database being adopted, so `before` must have created them (the CLI and
  `migrate` already run it first); what a stub carries and what it does not.

**Out of scope:** an app-provided `reference` hook (research §2), copying domains, functions, views or sequences,
any release.

## Key decisions

- **Stubs, not a hook** (research §2): no new API, no drift.
- **Copy every app table, not only the referenced ones**: parsing module SQL is fragile; the comparison describes the
  target schema only, so extra stubs cannot leak into it.
- **Non-fatal stub statements**: a stub failure must not break a module that never references that table; the
  skipped list goes into the failure reason when the module files fail.
- **Exclusion by schema list**: one helper `listOwnedSchemas(units)` in `reference.ts` returns the ledger schema,
  every enabled module's schema and `drizzle`; both call sites pass it to `readAppTables`.
- **Identifiers quoted by Postgres**: the catalog query returns `quote_ident` / `format('%I.%I')` names, so the
  generated DDL never concatenates raw identifiers.
- **A dry run reads what is there**: `--adopt --plan` runs no `before`, so stubs exist only for app tables the
  database already has; the README says so.

## Phase 1: stubs in the reference build (TDD)

- `tests/reference-stubs.test.ts` (both drivers), all on the `linked` fixture or a copied folder:
  - `adoptModule` adopts `linked` whose live schema was built by the app (`public.app_users`, `links` moved into
    `linked`); ledger shows `linked/1/adopted`. Fails on master with `db.adopt_reference_failed`.
  - `migrate` with `before` building the same history and `baseline: { linked: 1 }` adopts; second run is a no-op.
  - a live FK with `ON DELETE CASCADE` while the module has none → `db.schema_mismatch` naming the FK line on both
    sides (stubs do not hide differences).
  - module SQL referencing an app table in a non-public schema (`app.accounts (code)`) through a unique index, with a
    composite unique key, and an app column of an app enum type used in a data migration (`INSERT … SELECT`) →
    adopts.
  - an app table with a column of a domain type (not copied) and a key column → stub keeps the key, the reference
    builds, adoption succeeds; and a module referencing a table whose only column is of a domain type → fails with
    `db.adopt_reference_failed` whose reason names the skipped column.
  - app tables only: no app table (master behaviour) still adopts `notes` (regression guard exists in
    `adopt.test.ts`).
- `tests/adopt.test.ts`: none beyond the existing cases (they keep passing).
- Code: `stubs.ts`, `reference.ts`, `adopt.ts`, `migrator.ts`; docs.
- Done when: the new tests fail on master for the stated reasons and pass after; `npm run typecheck|lint|test|build`
  green with `SOFTURE_TEST_POSTGRES_URL` set.

## Progress

- [x] Phase 1: stubs in the reference build (7a3a65a; gates green: typecheck, lint, test 4449 passed with Postgres, build)
