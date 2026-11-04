---
change_id: mcp-access-operation-tasks-977
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: mcp-access-operation-tasks-977

Reviewed commits 4ea0e21 and a58f8bc against plan.md, issue #977 and the Tasks extension spec (2026-07-28).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A task must exist before the answer (spec: durable creation). | `storeTask` inserts (or refreshes) the row before the answer is built; a test reads the row behind the returned id. |
| 2 | Major | Joining a running operation after its task row expired would answer a dead task. | The upsert keeps the later expiry (`greatest`), so a join revives it; one row per account and job. |
| 3 | Minor | `/server` gained a reference to `mcp.operation_tasks` (prune, privacy, health). | Plain table access through `schema.ts`; `/server` still loads no jobs code (architecture test green). |
| 4 | Minor | The task code needed the operation's state helpers from `operations.ts`, which would import it back. | The state (types, status, poll, describe, owner lookup) moved unchanged to `operation-state.ts`; `operations.ts` re-exports the public part, so the `/jobs` surface of #952 is unchanged. |
| 5 | Minor | A 2025-era client that sends `tasks/get` gets `-32021`, a 2026 code. | It never receives a task id from this server; documented under limitations. |
| 6 | Minor | Progress counts are not in the task. | `statusMessage` names the phase; counts stay with `get_operation` (README). |

Gates: typecheck green; ESLint and the language gate green on commit; mcp-access and repository tests green (the
deploy workflow test needs `ssh-keygen`, installed in the container). Verdict: approved.
