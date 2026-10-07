# Plan review: mailing-history-import

Reviewed: plan.md against change.md, issue #212 and the code on master `88fc13c` (`deliveries.ts`, `campaigns.ts`,
`cli/run.ts`, `options.ts`, migrations `0002`/`0003`, README). Mode: autonomous (`--auto`), findings decided here.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | Migration `0002` declares the table checks without names; Postgres names them `deliveries_check`, `deliveries_check1`, … by position. Guessing the name of the message-id check would drop the wrong constraint (or fail) on adopters' databases. | Accepted: read the names from a migrated PGlite database before writing `0004`, and the import test asserts the old rule still holds for non-imported rows. |
| 2 | Warning | Imported campaign rows carry no `campaign_id`. Anything that later counts a campaign by `campaign_id` would miss them. | Accepted as designed: today nothing reads `campaign_id` except the partial index; `deliverOnce` and `planCampaign` match by scope. The README states that imported rows are matched by scope. |
| 3 | Warning | A problem message that quotes the address would put personal data into logs and CI output. | Accepted: problems name the row index (CLI: line number) and the field, never the value of `address`. |
| 4 | Warning | The plan's reason for the default 5 blames "the recipient's server answered as 5xx"; `mailing.unavailable` is the provider's API failing (timeout, 5xx, rate limit), not the recipient. | Accepted: the README explains 5 as "a provider that keeps failing on one mail does not keep it open forever, while a short outage across a few runs is ridden out"; `null` for apps that retry on their own schedule. |
| 5 | Suggestion | A history row whose key is already in the ledger with another outcome is silently kept. | Accepted: counted as `alreadyPresent`; the ledger wins, documented. Overwriting would break the fence of a live claim. |
| 6 | Suggestion | `finishedAt` in the future (clock skew between hosts) is refused. | Accepted: the check uses the module clock; the problem names the row, the operator fixes the data. |
| 7 | Suggestion | `--dry-run` for `import` could also count rows already present. | Rejected: validation and the row count answer "will this file go in"; the real run reports `already present` and is idempotent. |

No Critical findings. Lessons checked: `context/foundation/lessons.md` (L-001…) has nothing against the plan; phase 1 is
TDD. Plan updated by these decisions (items 1, 3, 4 are implementation notes for phases 1 and 3).

Verdict: ready to implement.
