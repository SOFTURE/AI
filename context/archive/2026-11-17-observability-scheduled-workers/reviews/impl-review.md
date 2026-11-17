---
change_id: observability-scheduled-workers
verdict: approved
---

# Implementation review

- Drift: none.
- Correctness: no export and no `waitUntil` without an endpoint; a throw is logged, marked on the span and thrown on.
- Gates: typecheck, ESLint and the observability tests green.

Verdict: approved.
