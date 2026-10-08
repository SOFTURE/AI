# Plan: privacy-copy-account

Input: change.md, research.md. Framing skipped: the issue states the problem, the traps and the shape of the fix.
Complexity: medium (one phase, one package, one new server file).

## Goal

`copyAccount` in `@softure-ai/privacy/server` copies one account and every row it owns from a source to a target
database: dry run by default, exact values, verified, all-or-nothing. README, CHANGELOG `## 0.1.9`.

**Out of scope:** a CLI (an app script is a few lines, shown in the README); moving (deleting from the source is
`eraseUserData`'s job, a separate decision); a core contract change.

## Approach

Option 1 of research.md: walk the source database's foreign keys from `auth.users`. Rejected: a contributor hook
(core + six modules, precision rules repeated per module); manifest tables filtered by `user_id` (misses child
tables, confuses mentions with ownership).

## Key decisions

- **D1 API.** `copyAccount(input: CopyAccountInput): Promise<CopyAccountResult>`, input
  `{ from: Queryable; to: Queryable; userId: string; commit?: boolean; exclude?: readonly string[];
  include?: readonly CopyAccountInclude[]; onMissingReference?: "refuse" | "null" }`. No module context: the
  function needs two databases and no config. Named `copyAccount`, not `importAccount`: it copies, the source keeps
  the account.
- **D2 Which rows.** The account row `auth.users WHERE id = userId`. A table is reached when it has a foreign key
  with ON DELETE CASCADE, RESTRICT or NO ACTION to a reached table (not SET NULL / SET DEFAULT: those are mentions);
  its rows are those whose key columns match a selected row of that table (OR over its owning keys), as nested
  `(cols) IN (SELECT refcols FROM parent WHERE <parent predicate>)`. Built in: `privacy.consents` rows with
  `email_key = getEmailKey(account email)`. `include` adds a table's rows by `{ table, column, matches: "userId" |
  "email" }` (README example: `waitlist.signups` by `email`); included tables are walked further like reached ones.
  `exclude` drops tables (`"auth.sessions"`); a table reached only through an excluded one is dropped too. System
  schemas (`pg_catalog`, `information_schema`, `pg_toast`) are never read.
- **D3 Exact values.** Source: one `repeatable read`, `read only` transaction with `SET LOCAL TimeZone = 'UTC'`,
  `DateStyle = 'ISO, YMD'`, `IntervalStyle = 'postgres'`, `extra_float_digits = 3`; every column selected as
  `col::text`. Target: the same settings; rows go in as one JSON array parameter per table,
  `INSERT INTO t (cols) SELECT (r->>0)::type0, ... FROM json_array_elements($1::json) r`, so NULL stays a JSON null
  and an SQL NULL, and no parameter limit applies. Generated columns (`attgenerated`) are not written. Identity and
  `nextval` keys that no foreign key references are left to the target (insert order follows the source key);
  others are written (`OVERRIDING SYSTEM VALUE` for identity) and their sequence is moved past the copied maximum.
- **D4 Order.** Tables are inserted in dependency order over every foreign key between copied tables (owning or
  not), so `billing.payment_requests` goes before `billing.manual_grants`. A cycle among copied tables (other than a
  table referencing itself) is refused.
- **D5 Checks before writing**, each an `Err` with `detail` naming what failed:
  - `privacy.copy_account_missing`: no `auth.users` row with that id in the source (or the id is not a uuid);
  - `privacy.copy_account_exists`: the target already has that id or that email;
  - `privacy.copy_schema_mismatch`: a copied table, or one of its source columns, is missing in the target, or a
    column's type (`format_type`) differs; a target-only column without a default fails the insert, mapped below;
  - `privacy.copy_unsupported`: a cycle;
  - `privacy.copy_reference_missing`: a copied row references a row outside the copy that the target lacks. With
    `onMissingReference: "null"`, a SET NULL key is written as NULL instead (counted in the report, the same thing
    deleting that row in the target would do); other keys still refuse.
  - `privacy.copy_conflict`: a unique or other constraint of the target rejects a row (Postgres error code class 23,
    with its constraint and table).
  Other thrown errors (connection) propagate after the rollback.
- **D6 Verify.** Inside the target transaction, after the inserts: read every copied table back with the same
  predicates (as text, same settings) and check each source row is present in the target as a multiset, over the
  written columns. A mismatch is `privacy.copy_verification_failed` and rolls back.
- **D7 Report.** `ok({ committed, userId, tables: [{ table, rows, nulledReferences }] })` in insert order, every
  reached table listed, also with zero rows. Dry run: the transaction is rolled back after D6 by a private sentinel
  error, so the dry run proves the copy would succeed.
- **D8 Docs.** JSDoc; README section "Copying an account to another database" with an app script (two
  `createDatabase` handles, `--commit` flag, printing the report); CHANGELOG `## 0.1.9` bullet. Version stays 0.1.9.

## Phase 1: copyAccount (TDD)

**Discipline:** TDD. **Files:** `modules/privacy/src/server/copy-account.ts` (new), `src/server/index.ts`,
`tests/copy-account.test.ts` (new), `README.md`, `CHANGELOG.md`.

Tests (two `createTestDatabase` of the privacy test app, `support.ts` config, `public.profiles` app table in both):

1. Dry run copies nothing and reports every reached table with its row count (users 1, user_roles, consents by
   user id and by email key, profiles, notes, sessions), `committed: false`.
2. `commit: true` writes every row; a `timestamptz` with microseconds (`.421579`) and a NULL in a nullable column
   arrive exactly (read back as text); the email-keyed consent arrives with a new id; another account's rows and
   another email's consents are not copied.
3. A child table without a user column (a table referencing an owned table) is copied; a SET NULL mention
   (`granted_by`-like) to an account missing in the target refuses with `copy_reference_missing`, and with
   `onMissingReference: "null"` is written as NULL and counted.
4. Unknown user → `copy_account_missing`; target with the same id or email → `copy_account_exists`; target missing a
   column → `copy_schema_mismatch`; a unique conflict → `copy_conflict` naming the constraint; nothing written.
5. `exclude: ["auth.sessions"]` leaves sessions out; `include` with `matches: "email"` copies a table keyed by email.
6. The identity sequence of a written identity key is moved past the copied maximum (a later insert succeeds).

Done when: the tests were seen red, then green; gates green (typecheck, lint, test, build).

## Risks and rollback

- A large account: one JSON parameter per table holds all its rows in memory; fine for one account.
- Rollback: the function is new and additive; reverting the commit removes it.

## Decisions (auto)

- Name `copyAccount` vs the issue's `importAccount` → `copyAccount` (the source keeps the account; "import" in
  privacy already means bringing outside history into the ledger, `importConsent`).
- Ownership rule → foreign keys whose ON DELETE is CASCADE, RESTRICT or NO ACTION (the deletion's own set).
- Missing referenced rows → refuse by default (no silent change); NULL only on request and only for SET NULL keys.
- `waitlist.signups` → not built in (privacy does not depend on waitlist); `include` covers it, README shows how.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: copyAccount

#### Automated
- [x] 1.1 New tests seen red, then green — 73e7dc6
- [x] 1.2 Gates green (typecheck, lint, test, build) — 73e7dc6
- [x] 1.3 README and CHANGELOG — 73e7dc6
