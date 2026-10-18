---
change_id: mailing-test-without-database-573
---

# Research: mailing-test-without-database-573

Sources: `modules/mailing/src/cli/run.ts` (`runTest`), `src/cli/command.ts` (`runMailCommand`, `needsConfig`),
`src/server/send-mail.ts` (`sendMail`, `previewMail`, `checkListMail`, `composeMessage`, `callProvider`),
`foundation/core/src/cli/load-config.ts` (`database: "optional"`), `foundation/core/src/database-requirement.ts`,
README "Test send", tests `cli.test.ts` (`softure-mail test`).

- `runTest` today: transactional mail goes through `sendMail({ config })`; list mail with `config.database === null`
  is refused ("list mail needs the database"); otherwise it opens the database and calls `sendMail({ config, db })`.
- `sendMail` throws for list mail without `db` and refuses it without the secret (`unavailable`), then checks the
  suppression list. The provider call (`callProvider`: timeout, outcome narrowing) and the failure mapping are
  private to `send-mail.ts`.
- `previewMail(config, mail, { env })` composes exactly the provider message (footer, RFC 8058 headers) without a
  database, refusing list mail without the secret.
- `defineSoftureConfig` refuses `database: null` when a module has a `dbSchema` (mailing has one), unless loaded
  inside `withDatabaseOptional`; `loadAppConfig({ database: "optional" })` does that. `runMailCommand` always loads
  with the default (`required`), so today a CI job without `DATABASE_URL` cannot even load the config for `test`.
- `sendMail` reads the secret from `process.env`; the preview reads it from `runMailCli({ env })` (README documents
  the split). The new send path should read `process.env` like every send.
- Tests: `cli.test.ts` covers the test command with a database (footer, ledger untouched, suppressed address,
  preview without secret); no case with `database: null`.
