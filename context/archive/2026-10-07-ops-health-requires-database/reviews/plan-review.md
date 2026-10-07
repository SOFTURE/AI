---
change_id: ops-health-requires-database
reviewed: plan.md
date: 2026-10-07
verdict: approved with fixes applied
---

# Plan review: ops-health-requires-database

Checked `plan.md` against `change.md`, the issue, `modules/ops/src/next/route.ts`, `src/server/health.ts`,
`src/options.ts`, `foundation/core/src/config.ts` (`checkDatabase`) and every caller of `collectHealthChecks`.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The default flips the behaviour for an app that has no database and enables `ops()`: its route goes from 200 to 503 after the upgrade. No app in the repository does this (the example always has a URL), but a consumer could. | Accepted: the README option row and the response table say so, and the PR names it as a behaviour change for the release notes. |
| 2 | Suggestion | `collectHealthChecks` is public (`@softure-ai/ops/server`); a caller without `ops()` in its config gets the missing check too. That is the safe side and matches the route. | Accepted: pinned by a test. |
| 3 | Suggestion | `withDatabaseOptional` (commands that never connect) turns an empty URL into `null`; the health route never runs under it, so it is unaffected. | No change. |
| 4 | Suggestion | An empty `url` already fails at the open; no test pins it with the new wording. | Out of scope: the existing "cannot be opened" test covers the open path. |

No finding blocks the plan.
