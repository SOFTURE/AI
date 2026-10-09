# Plan review: deploy-release-0-1-7

Reviewed plan.md against change.md, issue #307 and the #292 bump (`f80d346`). Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Suggestion | Between the merge and the publish the workflows on master default to a CLI version npm does not have yet; a caller on `master` deploying in that window fails at `npx`. | Accepted as in #292: the release is started right after the merge; callers that pin a SHA are unaffected. |

No finding blocks the plan.
