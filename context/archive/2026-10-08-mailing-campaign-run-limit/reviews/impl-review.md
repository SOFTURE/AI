---
change_id: mailing-campaign-run-limit
reviewed: d610cda
date: 2026-10-08
verdict: approved
---

# Implementation review: mailing-campaign-run-limit

Checked the diff against `plan.md`, `change.md` and the three points of issue #238; read every caller of
`sendCampaign`, `planCampaign` and `CampaignSummary` in the repository (the CLI and the tests; no other module builds a
summary).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The cut is checked before the filter and the ledger, so a recipient past the limit is never claimed or filtered by `deliverOnce`; `remaining` must still apply the filter and suppression list to them. | Checked: past-limit recipients go through `countPending`, the same helper `planCampaign` uses; the test "does not spend the limit on done, unsubscribed or filtered recipients" covers the counting on the reached side, the instalment test on the past side. |
| 2 | Suggestion | A run whose limit is reached exactly at the last recipient reports `remaining: 0`, with no hint that the limit was the reason it stopped. | As designed: nothing is left, so there is nothing to tell the operator. |
| 3 | Suggestion | `retry-later` recipients use a slot and are not in `remaining` (they were reached). The CLI already says "have no outcome yet; run the same command again later" for them and exits 1. | As designed and documented ("mails handed to the provider"); a test pins `remaining: 3` for that case. |

Plan drift: none. The limit is validated before the campaign is registered, so an invalid limit writes nothing.

Tests: the 18 new or changed cases failed before the implementation (missing `remaining`, no `--limit` flag) and pass
after; mailing suite 443/443; typecheck, ESLint and the language gate clean (pre-commit). Full `npm test` runs in
`pre-push`.
