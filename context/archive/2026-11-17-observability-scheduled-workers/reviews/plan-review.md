---
change_id: observability-scheduled-workers
verdict: approved
---

# Plan review

- Contracts: the wrapper returns the handler's result unchanged, so `createScheduledHandler`'s report still reaches the caller.
- Risk: records of work handed to `waitUntil` without being awaited are not exported; documented as a limitation.

Verdict: approved.
