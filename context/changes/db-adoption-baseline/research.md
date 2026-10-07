# Research: db-adoption-baseline

Input: [change.md](change.md), issue #152. Read: `foundation/db/src/migrations/{adopt,migrator,ledger,problems}.ts`,
`foundation/db/src/{cli/run,testing}.ts`, `foundation/db/tests/{adopt,app-migrations,cli,testing}.test.ts`,
`modules/auth/migrations/`, `modules/security/migrations/`, docs/05 step 3, db README §4–5.

## 1. How it works today (master after #153 and #155)

- `migrate` (`migrator.ts`): `prepareUnits` → under the advisory lock `compareJournal` (applied rows vs files, a
  flat `pending` list in unit order) → the ledger → `app.before` → every pending module file → `app.after`. There
  is no notion of "this module's tables already exist".
- `adoptModule` (`adopt.ts:44-87`): version must equal the enabled one; builds the **full** reference schema
  (all files of the target, plus its dependencies) on a scratch PGlite; `checkAdoptable` refuses when the ledger
  knows the module (`db.adopt_already_applied`) or when a dependency has pending steps
  (`db.adopt_dependency_pending`); `writeAdoption` records **every** file as `adopted`.
- `createTestDatabase` (`testing.ts`) runs `migrate` with the app hooks on a template, cached per module set and
  hook identity.

## 2. The issue's cases against the code

| Case | Why | Confirmed in code |
|---|---|---|
| fresh DB, app history → `migrate` | the module's file 0001 runs `CREATE TABLE` on a table `before` already moved in | `migrate` applies every pending file |
| fresh DB → `adoptModule` after the module ships 0002 | reference = all files, the app history only has 0001's shape | `describeReference` runs every file |
| adopt while a dependency is new | `checkAdoptable` refuses; plain migrate fails on the target's 0001 | `adopt.ts:98-101` |
| all-or-nothing | `writeAdoption` records `unit.files` | `adopt.ts:150-160` |

## 3. Decisions

**Where the baseline lives: on the app's migrations object, not in the core config.** The baseline is a fact about
the app's own history ("my migrations already create auth's files 1..N"), it changes only when that history does,
and every place that runs the history already receives `app`: `runMigrateCli({ app })`, `migrate(handle, { app })`,
`createTestDatabase(modules, { app })`. A config key would need `foundation/core/src/config.ts` (owned by #154 now)
and would still not reach `createTestDatabase`, which takes no config. So: `AppMigrations.baseline?:
Readonly<Record<string, number>>`. The `softure` bin (config only) cannot carry it, as it cannot carry the hooks;
the README already sends apps with their own migrations to the `runMigrateCli` script.

**Adopt-or-migrate in `migrate`.** For a baseline module the ledger has never seen, after `before` and after its
dependencies' pending files: an empty schema (no object `describeSchema` lists) → migrate normally; otherwise build
the reference from files 1..N, compare, record 1..N as `adopted` in one transaction, then apply N+1.. normally. A
mismatch is `db.schema_mismatch` and stops the run like a failing file (earlier units stay applied, `after` does not
run). A module the ledger already knows is migrated normally, so the baseline is inert after the first run.

**Only a prefix 1..N can be adopted.** The ledger refuses a pending file numbered below an applied one
(`db.migration_out_of_order`), so "adopt 0001 and 0004, migrate 0002–0003" would be refused by the next migrate. The
issue's auth case works with a prefix: auth's 0002/0003 create new tables (`user_roles`, `password_resets`) and 0004
is a plain `CREATE INDEX` on `users`, so `through: 1` adopts the app's `users`/`sessions` and migrates 0002–0004.
An app whose table already carries a later file's change aligns that object in its own move migration (as today) or
adopts through that file.

**Dependencies first, also in `adoptModule`.** `migrate` gets this for free by working unit by unit in dependency
order. `adoptModule` applies the pending files of the target's dependencies (transitively, in order) before the
comparison, under the same lock; a dry run lists them as "would apply". When one fails (its tables exist too, so it
should have been adopted), the result carries the failure and `db.adopt_dependency_pending` naming the dependency to
adopt first. `--adopt-if-new` from the issue is not added: a plain `migrate` with a baseline is that idempotent
command.

**Scratch PGlite only when needed.** The reference is built lazily, only when a baseline module is actually
adopted, so an image whose databases are already adopted needs no PGlite for `migrate`.

## 4. Risks

- A baseline N larger than what the app's history creates → `db.schema_mismatch` listing the missing objects; never
  a wrong ledger. N outside 1..files → a refusal before anything runs.
- A baseline for a module that is not enabled or has no schema → refused before anything runs.
- Template cache in `createTestDatabase` must include the baseline in its key.
