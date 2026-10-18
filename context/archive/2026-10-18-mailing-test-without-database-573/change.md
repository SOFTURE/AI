---
change_id: mailing-test-without-database-573
title: "mailing: softure-mail test sends a list-kind test mail without the app database (issue #573)"
status: archived
roadmap_item: null
issue: 573
branch: claude/project-thread-01xw7b
created: 2026-10-18
updated: 2026-10-18
archived_at: 2026-10-18
---

## Intent

Close [issue #573](https://github.com/SOFTURE/AI/issues/573): `softure-mail test` refuses a list-kind test mail
when the config has no database, because it wants the suppression list. A test mail goes only to `testAddress`, the
operator's own address, so the check guards nothing there, and the refusal makes the command unusable in a CI job or
on an operator machine that has the provider key and the unsubscribe secret but no app database.

## Context

Labels: `enhancement`, `pkg: mailing`. mailing 0.2.2 is the latest on npm and on master. Releases are batched by the
coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- With a database, the current behaviour stays: an unsubscribed test address answers `suppressed`.
- Without the unsubscribe secret, a list-kind test mail is still refused.
- `sendMail` keeps failing closed for list mail without a database handle; only the test command, whose recipient is
  fixed to `testAddress`, may skip the check.

## Notes

- Framing: skipped. The issue states the problem, two proposals and the acceptance.

## Decisions (auto)

- Proposal 1 without a flag: the check is skipped when the config has no database (`database: null`), and the
  output says the suppression list was not checked. A flag would be a second way to say "no database".
- The bin loads the config with the database optional for `test` and `dns` (neither needs a connection), so a
  missing or empty `DATABASE_URL` loads as `database: null` instead of refusing the config. An app script gets the
  same with `withDatabaseOptional` from `@softure-ai/core`.
- No public `sendTestMail` in `/server` (proposal 2): `runMailCli({ config, argv: ["test", file] })` already is the
  one call for an app script, and a public send that skips the suppression list is a footgun.
