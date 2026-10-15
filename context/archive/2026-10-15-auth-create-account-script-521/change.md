---
change_id: auth-create-account-script-521
title: "auth: create-account ops script for an app with registration closed (issue #521)"
status: archived
roadmap_item: null
issue: 521
branch: claude/project-thread-c9w4i2
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

Close [issue #521](https://github.com/SOFTURE/AI/issues/521): an app with one owner account and registration closed
has no supported way to create that account in production, so it inserts into `auth.users` itself and adds its own
unique index to keep "at most one account". The module gets a `create-account` ops script with an optional
`maxAccounts` limit.

## Context

auth is at 0.2.2 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- A safe ops script (`@softure-ai/ops/scripts`): dry run by default, `--commit` writes, reports the user id, never the
  email, the password hash is a secret argument.
- The password follows `set-temporary-password`: drawn (at least 20 and `password.minLength` characters) or a given
  `hashPassword` hash.
- Refuses an existing email, an invalid email and, with `maxAccounts`, a table that already holds that many accounts,
  also against a concurrent run.

## Notes

- Framing: skipped. The issue names the gap and the script's shape.

## Decisions (auto)

- Only the script (`createCreateAccountScript(config, { clock?, alphabet?, maxAccounts? })`). The optional
  `auth({ maxAccounts })` with a module-owned constraint is left out: with registration closed the script is the only
  writer, and a count limit cannot be a plain unique constraint; the table lock inside the script's transaction makes
  the check race-free for the script. Recorded under the README's known gaps.
- The script does not run the app's `onRegistered` hook: no consent was given and no registration fields exist.
  The README says so; an app that needs its own rows creates them in its own script.
- The drawn-or-given password logic moves to a shared helper used by both scripts.
