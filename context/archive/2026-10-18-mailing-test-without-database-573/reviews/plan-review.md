---
change_id: mailing-test-without-database-573
reviewed: 2026-10-18
verdict: approved
---

# Plan review: mailing-test-without-database-573

Checked plan.md against change.md, research.md, issue #573 and `send-mail.ts`, `run.ts`, `command.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The unchecked send stays internal to the package and its only caller fixes the recipient to `testAddress`, so no app code can skip the suppression list for a real recipient. | No change. |
| 2 | Check | The skip is tied to `database: null`, not to a failed connection: a config with a URL whose database is down still fails (fail closed). | No change. |
| 3 | Check | Loading `dns` with the database optional widens nothing: `dns` never reads `config.database`. | No change. |
| 4 | Major | An app script that loads its config itself (`runMailCli`) still gets a refused config without a URL; the plan must document `withDatabaseOptional` for that case. | Added to Phase 2 (README and CHANGELOG). |
| 5 | Check | The secret is read from `process.env` on the unchecked path, like `sendMail`; the README split (preview from `env`, send from `process.env`) stays true. | No change. |

No Critical findings.
