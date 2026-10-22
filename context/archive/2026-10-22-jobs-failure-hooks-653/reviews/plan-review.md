---
change_id: jobs-failure-hooks-653
reviewed: 2026-10-22
verdict: approved
---

# Plan review: jobs-failure-hooks-653

Checked plan.md against change.md, research.md, issue #653, `claim.ts`, `process.ts`, `schedules.ts`,
`run-job-worker.ts` and the `onReconnectRequired` hook of connections.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A hook fired inside the completion transaction would run before the commit and could alert for a write that rolls back. | Plan step 5: fire after the transaction returns, only when the fenced write happened. |
| 2 | Major | Several workers check schedule states at once; without stored state each would alert. | Conditional update of `reported_state`; plan step 1 tests a race of two checks. |
| 3 | Minor | `failing` and `late` usually come together; separate alerts would double up. | One state with precedence (change.md Decisions). |
| 4 | Minor | A slow hook holds a worker slot while it runs (awaited). | Accepted, same as connections; README says to keep hooks short or enqueue a job. |
| 5 | Check | Existing rows get `healthy`; a schedule failing at upgrade time alerts once at the first check. | Intended; CHANGELOG says so. |
| 6 | Check | No hook configured: no extra writes or reads. | Plan step 4. |

No Critical findings.
