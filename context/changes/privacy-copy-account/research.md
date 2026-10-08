# Research: privacy-copy-account

Input: change.md (issue #250).

## Findings

- **Contributors cannot copy.** `PrivacyContributor` (`foundation/core/src/module.ts`) has `exportUserData` (a JSON
  shape of the module's choosing, not rows) and `deleteUserData`. Neither names tables or rows, so "privacy knows per
  module which tables hold an account's data" holds only as the manifests' `dbSchema` + `tables` lists. A list says
  which tables, not which rows of them belong to an account.
- **The foreign keys do say which rows.** Every module table with account data references `auth.users` or a table
  that does, and the ON DELETE action separates ownership from mentions:
  - owned (CASCADE): `auth.sessions`, `auth.user_roles`, `auth.password_resets`, `billing.entitlements`,
    `billing.payments` (and `billing.refund_failures` through `payments`), `billing.payment_requests`,
    `billing.manual_grants.user_id`, `billing.trial_extensions.user_id`, `mcp.access_tokens`,
    `mcp.oauth_authorization_codes`, `mcp.oauth_grants`, `privacy.consents.user_id`;
  - owned (RESTRICT / NO ACTION): an app table whose contributor deletes it first, like the privacy tests'
    `public.profiles (user_id ... ON DELETE RESTRICT)`;
  - mentions (SET NULL): `billing.manual_grants.granted_by` / `revoked_by` and `billing.trial_extensions.extended_by`
    (the admin who acted), `billing.manual_grants.request_id`.
  Following CASCADE, RESTRICT and NO ACTION edges from the account row gives exactly the rows that deleting the
  account removes or is blocked by: the same set `eraseUserData` must clear. SET NULL edges are references to keep.
- **Not reachable by a foreign key:** `privacy.consents` rows keyed by `email_key` (a consent given before the account
  existed, e.g. on the waitlist; `consents-contributor.ts` exports them with the account) and `waitlist.signups`
  (one row per email, no user id). Privacy owns the first; the second belongs to waitlist, which privacy does not
  depend on.
- **Rows referencing shared rows:** `mcp.oauth_grants.client_id` and `mcp.oauth_authorization_codes.client_id`
  reference `mcp.oauth_clients`, which no account owns. The target must already hold that client, or the insert
  fails its foreign key.
- **Generated keys:** `privacy.consents.id` is `bigint GENERATED ALWAYS AS IDENTITY`. Copying it would collide with
  the target's own consents; nothing references it. Every other key is a `uuid` (global, safe to copy).
- **Precision:** node-postgres parses `timestamptz` into `Date` (milliseconds); PGlite does the same. Selecting
  `col::text` and inserting `$text::<type>` keeps every type exact (timestamps, numeric, jsonb, arrays). The text form
  of `timestamptz` depends on the session `TimeZone` and `DateStyle`, so both sessions set them (`SET LOCAL`).
- **Tools:** `Queryable` from `@softure-ai/db` (drizzle over node-postgres or PGlite) runs `db.execute(sql)` and
  `db.transaction(fn, { isolationLevel, accessMode })`, already used by `collect.ts`. `createTestDatabase(modules)`
  gives two independent migrated databases for a test.
- **Version:** npm has `@softure-ai/privacy` 0.1.8; 0.1.9 is in `## 0.1.9` of the CHANGELOG, unpublished.

## Options

1. **Catalog walk (chosen).** Read the foreign keys of the source database (`pg_constraint`), walk the owning edges
   from `auth.users`, select rows with nested `IN (SELECT ...)` predicates in one repeatable-read read-only
   transaction, insert in dependency order in one target transaction. Covers every module and app table with no
   list to maintain; uses nothing outside privacy.
2. **A `copyUserData` hook on `PrivacyContributor`.** Each module implements its own copy. Changes core and six
   modules, and every module would re-learn the precision rules: the problem the issue wants gone.
3. **Copy the manifests' tables filtered by a `user_id` column.** Misses `billing.refund_failures` (no `user_id`) and
   treats `granted_by` like ownership.

## Risks

- A cycle among owning edges (a table owning itself) cannot be ordered: refused with a message naming the tables.
- An owning foreign key used for a mention (NO ACTION by accident) would pull in rows of the mentioned account's
  table. That is also what blocks deleting the account, so the export/delete contract already treats it as owned.
  `exclude` lets the caller leave a table out.
