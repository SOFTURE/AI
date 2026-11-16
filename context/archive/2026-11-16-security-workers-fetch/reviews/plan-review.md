# Plan review: security-workers-fetch

Verdict: proceed.

| # | Finding | Severity | Decision |
| --- | --- | --- | --- |
| 1 | A host check before the request is outside the callers' timers: a hanging resolver would hang the fetch. | warning | Accepted: the callers pass an `AbortSignal` aborted by their timer (Phase 2). |
| 2 | Making `openGuardedRequest` async moves a synchronous header error into a rejection. | suggestion | Accepted: both callers map any rejection other than a block or abort to `security.outbound_failed`, as before. |
| 3 | The roadmap outcome names a `fetch` rewrite and a CIDR matcher that the measurement shows are not needed. | warning | Accepted: the item block is updated to the measured scope, and RP-3 and RP-7 note what the measurement changes for them. |
| 4 | `./jobs` imports `@softure-ai/jobs`, not yet Workers-safe. | suggestion | Accepted: left out of `softure.workers` until RP-4. |
