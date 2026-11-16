# Plan review: example-on-workers

Verdict: approve with two fixes applied.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The plan did not say whether `./next-config` is Workers-safe; listing it would fail the RP-1 guard (it imports `node:module`). | Applied: Node-only, not in `softure.workers`. |
| 2 | Warning | `closeAfterBody` wraps the body in a TransformStream; a client that disconnects must still close the handle. | Applied: a cancel test in Phase 1. |
| 3 | Suggestion | The Workers job doubles e2e minutes. | Accepted: runs only when the example area changes, like `e2e`. |
