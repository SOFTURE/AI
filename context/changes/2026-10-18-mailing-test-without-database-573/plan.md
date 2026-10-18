---
change_id: mailing-test-without-database-573
status: in_progress
---

# Plan: softure-mail test without the database (issue #573)

Input: change.md, research.md. Complexity: small (one send path, a load option, tests, docs).

## Phase 1: list-kind test mail without the database (TDD)

Files: `modules/mailing/src/server/send-mail.ts`, `src/cli/run.ts`, `src/cli/command.ts`, `tests/cli.test.ts`.

1. Tests first (`softure-mail test` with a config loaded with `database: null`):
   - a list-kind test (`test launch.md`) sends to `testAddress` with the footer and the RFC 8058 headers, exit 0,
     never opens a database, and the output says the suppression list was not checked;
   - without the secret it is refused (`unavailable`), nothing sent;
   - with a database, an unsubscribed test address still answers `suppressed` (existing test);
   - the bin loads a config whose database URL is empty for `test` (fixture app with an empty `DATABASE_URL`-style
     URL) and still refuses it for `campaign`.
2. `send-mail.ts`: move the provider call and failure mapping of `sendMail` into a private `deliver`; add an
   internal (not re-exported from `/server`) `sendMailUnchecked(config, mail, options)` that validates, refuses list
   mail without the secret, composes the message and delivers it, without the suppression lookup.
3. `run.ts`: with `config.database === null` a list-kind test goes through `sendMailUnchecked`; the success line adds
   "; no database, the suppression list was not checked".
4. `command.ts`: load the config with `database: "optional"` for `test` and `dns`.

## Phase 2: docs

`modules/mailing/README.md` (Test send), help text in `run.ts`, `CHANGELOG.md` `## Unreleased` with the migration
for an app that kept its own preview-then-send path.

## Progress

- [x] Phase 1: list-kind test mail without the database (4 tests written first; 621 mailing tests pass)
- [ ] Phase 2: docs
