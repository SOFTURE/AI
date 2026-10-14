# Plan review: billing-usage-limits

Reviewed 2026-10-14 against `change.md`, `research.md`, issue #474 and `modules/billing` on `62fb006`.

| # | Finding | Severity | Decision |
|---|---|---|---|
| F1 | Two period grants can both contain `now` only if dates overlap, which the chaining in `getPlanGrant` prevents; a `grant { until }` by hand has no row. | Suggestion | Pick the containing grant with the latest `granted_from`; no row → `paid.limits`. |
| F2 | A consumption inside the app's transaction holds the usage row lock until that transaction ends; long app transactions serialise the account's consumers. | Warning | Documented in the README: keep the consuming transaction short. |
| F3 | The account may be deleted between the limits read and the upsert, failing the foreign key. | Warning | Account row `for key share` inside the same transaction, as `changeEntitlement` does. |
| F4 | `amount` must be a positive safe integer; `used` as `bigint` with `mode: "number"` stays exact below 2^53 since limits are at most 1e9. | Check | Validate `amount` 1..1e9; throw otherwise (a bug, not user input). |
| F5 | `getBillingErrorMessage` takes a union of code types; a new code type must join it so `quota_exhausted` has copy. | Check | Add `UsageErrorCode` to the union and the messages test. |
| F6 | The plan id of a plan removed from the config still resolves from old grants. | Suggestion | `getLimits` reports the stored plan id; its limits fall back to `paid.limits` when the plan is gone. |

Verdict: ready to implement.
