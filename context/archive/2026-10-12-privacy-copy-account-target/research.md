# Research: privacy-copy-account-target

## Questions

1. How can the script honour dry run / `--commit` on a database the ops helper did not open?
2. Where does a new email have to be applied so the copy stays verified and consistent?
3. What does a ledger comparison compare?

## Findings

1. `executeOpsScript(db, script, args, { commit })` (`modules/ops/src/scripts/ops-script.ts`) wraps `script.run(tx,
   args)` in `db.transaction` and throws to roll back a dry run. `run` gets no commit flag. A script that opens its
   own database must know the flag to roll that one back too. Options: (a) pass a run context `{ commit }` as a third
   argument of `run`; (b) let the script choose the database the helper opens (needs parsing before opening, a
   larger change of `runOpsScript`); (c) always dry-run the external target (useless). (a) is additive: a `run` with
   two parameters still type-checks, older ops versions pass `undefined`.
2. `copyAccount` reads the source in one read-only repeatable-read transaction, then in one target transaction
   checks existence (`refuseExistingAccount` by id or the copied email), inserts, verifies every table by reading it
   back with the source predicate, and advances sequences. Verification compares against the source values, so the
   rename has to come after it. The existence check has to use the new address instead of the old one (the old one
   may legitimately exist in the target). Copied email-keyed consents (`email_key = getEmailKey(old)`, `user_id IS
   NULL`) would otherwise point at an address the account no longer has; they move to the new key. Rows the target
   already had under the old key belong to that address, not to the copy, and stay.
3. `softure.migrations` holds `(module, version, name, checksum, ...)`; `readJournal` treats a missing table as an
   empty ledger. Comparing `(module, version) -> checksum` catches a migration only one side ran and a file changed
   after it ran. `applied_at`, `method` and `module_version` legitimately differ between databases.

## Sources

- `modules/privacy/src/server/copy-account.ts`, `src/scripts/copy-account-script.ts`, tests.
- `modules/ops/src/scripts/ops-script.ts`.
- `foundation/db/src/migrations/ledger.ts`.
- `context/archive/2026-10-09-privacy-document-history-copy-script/plan.md` (D2 chose no `--to`).
