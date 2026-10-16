---
change_id: observability-probe-547
reviewed: 2026-10-16
verdict: approved
---

# Implementation review: observability-probe-547

Reviewed: the branch diff against plan.md, change.md and issue #547.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | 200 gives exit 0; 401 and 404 give exit 1 with `HTTP <status>` per signal, as the issue's tests ask. | No change. |
| 2 | Check | The auth header and URL credentials never reach the output (tested). | No change. |
| 3 | Check | Private providers: the global tracer provider stays unset after a probe (tested). | No change. |
| 4 | Minor | A retryable status (429, 503) is retried until the timeout and then reported as `no response`. | Accepted: the exporter's own retry; documented in the README as a timeout. |
