---
change_id: privacy-copy-account-target
title: "privacy: copy-account script with --to, a new email in the target, and a migration ledger check (issue #376)"
status: archived
roadmap_item: null
issue: 376
branch: claude/project-thread-0bbbn4
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

An adopting app filed [#376](https://github.com/SOFTURE/AI/issues/376) (labels `enhancement`, `adoption`,
`pkg: privacy`): `createCopyAccountScript` (privacy 0.1.11) always copies into the app's own database, cannot give
the account a new email in the target, and does not notice when the two databases run different migrations (a
nullable column only the target has silently takes NULL). The app keeps its own operator script on `copyAccount`.

After this change:

1. `--to=<target database URL>` (or `--to-file`) copies between two named databases, neither of which is the app's;
   without it the target stays the app's database. Dry run and `--commit` behave the same in both modes.
2. `--new-email=<address>` gives the account a new email in the target, in the same transaction as the copy,
   refusing when the target already has an account with that address. `copyAccount` takes the same as `newEmail`.
3. `copyAccount` refuses (`privacy.copy_ledger_mismatch`) when the two databases' migration ledgers
   (`softure.migrations`) differ, naming the difference; `ledger: "ignore"` opts out.

A reviewer checks `modules/privacy/src/server/copy-account.ts`, `src/scripts/copy-account-script.ts`,
`modules/ops/src/scripts/ops-script.ts`, the tests, the READMEs and the CHANGELOGs (`## Unreleased`, no version bump).

## Context

- `@softure-ai/ops/scripts` runs a script in one transaction on the app's database and decides commit or rollback
  itself; `run(tx, args)` does not see `--commit`, so a script writing to another database cannot honour a dry run.
- The ledger is `softure.migrations` (`foundation/db/src/migrations/ledger.ts`), keyed by `(module, version)` with a
  checksum.
- Email-keyed consents (`privacy.consents.email_key`) are copied with the account and keyed by its email.

## Constraints

- Existing calls of `copyAccount` and `createCopyAccountScript` keep working; the ledger check is the one new refusal.
- Reports carry no email.
- Releases are batched: CHANGELOG entries go under `## Unreleased`, no version bump.
