---
change_id: mcp-access-operations-952
reviewed: 2026-11-02
verdict: approved
---

# Plan review: mcp-access-operations-952

Checked plan.md against change.md, research.md, issue #952, `jobs/src/server/admin.ts`, `enqueue.ts` and
`mcp-access/src/server/tools.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | An app dedup key shared across accounts would hand one account another's operation id. | The owner's id is part of the key (`mcp:<userId>:<key>`), so keys never meet across accounts; a test pins it. |
| 2 | Major | A `get_operation` that reads any job id would leak other jobs (schedules, other modules). | Only origin `mcp` with the caller's prefix is found; tests for a foreign job and another account. |
| 3 | Minor | The dedup key column holds 200 characters; the prefix takes 42. | App keys over 150 characters throw (a bug in the caller), documented. |
| 4 | Minor | `/server` must stay free of the optional jobs peer. | Everything lives in `/jobs`; change.md Decisions records the deviation from the issue text. |
| 5 | Minor | A retrying job shown as `queued` would look like it never started. | Pending with attempts is `running`. |

Verdict: approved.
