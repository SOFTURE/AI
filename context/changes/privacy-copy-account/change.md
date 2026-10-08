---
change_id: privacy-copy-account
title: "privacy: copy one account with its whole history from one database to another (issue #250)"
status: plan_reviewed
roadmap_item: null
issue: 250
branch: claude/project-thread-kwh9ba
created: 2026-10-08
updated: 2026-10-08
archived_at: null
---

## Intent

An app moves one account, with every row that belongs to it, from one database to another by calling one function
of `@softure-ai/privacy/server` instead of keeping its own 650-line script (FIRE_TRACKER
`scripts/migrate-account.mts`) that has to learn every new module table.

When this change is done:

- `copyAccount({ from, to, userId })` finds the account's rows in the source database without a table list: the
  account row in `auth.users`, every row that references an account row through a foreign key that deleting the
  account would cascade to or be blocked by, transitively, and the account's email-keyed consents in
  `privacy.consents`. A new module or app table is covered by its foreign key.
- It is a dry run by default: the whole copy runs in one target transaction, is verified, and is rolled back.
  `commit: true` keeps it.
- The two silent traps of the script are built in: every value is read and written as text with its column type, so
  `timestamptz` keeps its microseconds, and NULL stays NULL (never zero or empty).
- After the insert, the copy is read back from the target and compared value by value with the source; any
  difference fails the copy and rolls it back.
- Expected failures (no such account, the account already in the target, a target table or column missing or of
  another type, a conflicting or missing referenced row) are returned as values naming the table, never thrown.

A reviewer checks `modules/privacy/tests/copy-account.test.ts`, the README section, the CHANGELOG and version.

## Context

Issue [#250](https://github.com/SOFTURE/AI/issues/250), quoted:

> `scripts/migrate-account.mts` (657 lines) copies one account with all its rows from one database to another
> (`--from`, `--to`, `--user`, optional `--email`), dry run by default, write only with `--commit`. Two rules it
> learned the hard way, both silent if missed:
>
> - `pg` returns `timestamptz` as `Date` (milliseconds), so a naive copy truncates `.421579` to `.421` with matching
>   row counts and amounts. Time columns must be read as `::text`.
> - NULL is not zero (e.g. "not recorded" vs "paid nothing").
>
> Privacy already knows, per module, which tables hold an account's data (export contributors). An import
> counterpart (`importAccount(contributors, from, to, { userId })` with the precision rules built in, plus module
> tables like `auth.*`, `billing.*`, `privacy.consents`) would make this reusable instead of each app keeping a
> 650-line script that must learn every new module table.

No roadmap: issues are the tracker (project rule 2026-10-07). The FIRE_TRACKER script itself is not available in
this workspace; the issue text is the specification.

## Constraints

- Only `modules/privacy` changes (code, tests, README, CHANGELOG, version). No change to `@softure-ai/core`'s
  `PrivacyContributor` contract: a core release is handled elsewhere.
- English-only code, comments and commits.
- Never writes to the source database; writes to the target only in one transaction, only with `commit: true`.
- privacy 0.1.9 is not published yet (npm has 0.1.8): the entry joins `## 0.1.9`.
