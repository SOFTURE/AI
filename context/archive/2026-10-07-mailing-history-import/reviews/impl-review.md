# Implementation review: mailing-history-import

Reviewed: the branch diff against plan.md, change.md and issue #212 (`migrations/0004`, `schema.ts`,
`server/import-deliveries.ts`, `server/deliveries.ts`, `server/campaigns.ts`, `options.ts`, `contract.ts`,
`cli/run.ts`, the tests, README, CHANGELOG, docs/05). Mode: autonomous (`--auto`), findings decided here.

## Plan conformance

| Plan item | State |
|---|---|
| Migration 0004 (`imported_at`, relaxed message-id rule) | Done. Constraint name `deliveries_check1` read from a migrated database first (plan review #1); new constraints are named. Rollback in the header. |
| `importDeliveries` / `checkImportedDeliveries` | Done as planned; result is a discriminated union (`ok` / `problems`), since core's `Result` carries error codes, not lists. |
| `maxAttempts` module option, `null` | Done; per-call value (also `null`) wins. |
| `listCampaignRecipients` | Done, plus `listConfiguredCampaignRecipients` for scripts. |
| `softure-mail import`, stdin, recipients from the option | Done. |
| README, docs/05, CHANGELOG, 0.1.9 | Done. |

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `softure-mail import` first validated rows inside `importDeliveries`, i.e. after opening the database: a bad file cost a connection, and the test "writes nothing" saw the handle opened. | Fixed: rows are checked with `checkImportedDeliveries` before the database is opened; the test asserts no connection. |
| 2 | Warning | Red first: the import tests must fail without the migration, else they prove nothing. | Checked: with `0004` removed all nine import tests fail; with it, they pass. The `maxAttempts: null` tests cannot pass on master (the strict options schema refuses the key). |
| 3 | Suggestion | A throw from the app's `listCampaignRecipients` is reported with the hint "did softure migrate run?", which fits database failures only. | Kept: the app's own message comes first; the hint is a suffix and the README says a throw stops the campaign. Not worth a second catch path. |
| 4 | Suggestion | The README intro still named the app the code was first ported from. | Fixed in the touched paragraph (neutral wording). Source-file comments outside this change keep their history notes. |
| 5 | Suggestion | `historyRowSchema` in the CLI and `findRowProblems` both validate. | Kept on purpose: the schema shapes untyped JSON (types, unknown keys), the function checks values for every caller, including the typed API. |

Security and data: imported rows store only recipient keys, as before; problem messages never carry an address
(tested); SQL goes through drizzle parameters; the migration only relaxes one rule for rows marked imported and adds
two checks.

Gates: see plan.md `## Progress`.

Verdict: ready to merge.
