---
change_id: billing-usage-limits
reviewed: 2026-10-14
verdict: approved
---

# Implementation review: billing-usage-limits

Reviewed: the branch diff against plan.md, change.md and issue #474.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Issue ask 1: `plans[].limits`, `trial.limits`, `paid.limits`, `readOnly.limits` with kebab-case meters, integer limits or `null`, all defaulting to `{}`; existing configs parse unchanged apart from the added empty blocks (module defaults test). | No change. |
| 2 | Check | Issue ask 2: the plan is resolved from recorded grants (`findCurrentPlanId`), so `getLimits` answers per plan without a migration of `billing.entitlements`; refunds and revokes drop the plan (tests). | No change. |
| 3 | Bug found and fixed | `resolveLimit` turned an explicit `null` (no limit) of `paid.limits` or a state block into 0 through `?? 0`. Caught by the ledger test; `readLimit` now returns 0 only for a meter the block leaves out, with unit tests for both nulls. | Fixed in p2. |
| 4 | Deviation | Plan phase 1 said "the period containing `now`". A plan bought during the trial starts where the trial ends, so at `now` the account is `paid` with no period holding `now`; the rule is now the earliest period grant that has not ended (it is the containing one whenever one exists). | Recorded; README states the rule. |
| 5 | Check | Issue ask 3: `consumeUsage` is one conditional upsert per account, meter and month; the race tests on a real Postgres (row held, first insert held, a burst of 12) never pass the limit. Inside the app's transaction it rolls back with it (PGlite test). | No change. |
| 6 | Check | GDPR: export lists the ledger, deletion removes it (privacy tests); the foreign key cascades too. Health probe, manifest `tables` and `module.json` include `usage`. | No change. |
| 7 | Warning | A consumption inside a long app transaction holds the account's row for that meter until it ends. | Accepted; README says to keep the transaction short. |
| 8 | Warning | Rows of past months are kept until the account is deleted; no cleanup job. | Accepted: one small row per account, meter and month; a retention job can follow if an app needs it. |
| 9 | Check | Docs: README §1, §3 (options, plan shape), §4 "Usage limits", §5 table, §11 GDPR; CHANGELOG `## Unreleased` with the migration for an app that counts usage itself. The version bump happens at release (`npm run release:version`). | No change. |

Gates: see plan.md Progress.
