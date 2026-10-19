---
change_id: jobs-worker-heartbeat-610
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: jobs-worker-heartbeat-610

Checked the diff (c81f1c3, 92b4d84, 61dffb6) against plan.md, plan-review.md and issue #610.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `--health` returns before any database is opened or signal handler installed; tested with `database: null`. | No change. |
| 2 | Check | A round whose queues are all at their concurrency claims nothing and still touches the file: the loop runs, the slots are busy. | Intended; the README's rule ("every claim reached the database") holds vacuously. |
| 3 | Check | The rendered compose and `scripts/worker.ts` carry no template markers for both branches; the pre-0.1.3 output is byte-for-byte PR #611's. | No change. |
| 4 | Minor | The deploy gate names `0.1.3` before jobs is released. | Every jobs release after 0.1.2 is cut from a master with this change; nine packages pin `^0.1.x`, so the next one is 0.1.3 or later. Recorded in plan.md. |
| 5 | Minor | `init` now warns for every app on jobs 0.1.2 or older until it upgrades. | Intended: it names what the check proves and how to get the stronger one. |

No Critical or Major findings.
