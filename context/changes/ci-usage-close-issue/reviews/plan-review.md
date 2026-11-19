# Plan review: ci-usage-close-issue

Reviewed: plan.md against change.md, research.md, `tools/ci-usage/src/publish.ts` and the reusable workflow.
Mode: autonomous. Verdict: approve after the fix below (applied to plan.md).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `findIssue` keeps an open issue the app opened before turning `close-issue` on; it must be closed too, not left. | Already covered: the close runs on whichever issue was updated or created. |
| 2 | Suggestion | `state_reason` must be `completed` so the issue does not read as "not planned". | Applied: the test asserts the exact PATCH body. |
| 3 | Suggestion | The README's "agents read that issue" must say the newest issue, closed included. | Applied in Phase 2. |

The contracts hold: the default stays the rolling open issue; `PublishResult` only gains a field.
