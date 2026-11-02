---
change_id: mcp-access-operation-tasks-977
reviewed: 2026-11-02
verdict: approved
---

# Plan review: mcp-access-operation-tasks-977

Checked plan.md against change.md, research.md, issue #977, the Tasks extension spec (2026-07-28), the SDK's
dispatcher (`isExtensionReusedRequestMethod`, `stampResultType`) and `src/jobs/operations.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A task answered to a client that did not declare the extension breaks it (spec MUST NOT). | The task answer depends on the envelope of that very request; tests for a non-declaring 2026 client and a 2025 client. |
| 2 | Major | Job ids as task ids are guessable. | Random 32-byte ids in `mcp.operation_tasks`, plus the owner check on every task request. |
| 3 | Major | The issue's `failed → failed` contradicts the spec. | Failed job → `completed` with `isError: true`; recorded in Decisions. |
| 4 | Minor | A task row without cleanup grows forever. | Expiry with a default of a day, pruned by `pruneMcpAccess`; account deletion removes rows. |
| 5 | Minor | A new migration breaks the exact e2e migration list. | The list gains `mcp-access 6 create_operation_tasks`. |
| 6 | Minor | A tool that passes `taskRequest` on a server without `registerOperationTasks` would hand out tasks nobody can poll. | Documented as a pair in the README and the option's doc comment; the polling tools still work for the operation. |

Verdict: approved.
