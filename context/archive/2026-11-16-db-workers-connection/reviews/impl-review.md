# Implementation review: db-workers-connection

Verdict: approve.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | Without `waitUntil`, a failing `close()` after a handler that threw replaces the handler's error. | Accepted: on Workers `waitUntil` is always given; on Node a scope is only used by tests and scripts, and a close failure there is worth seeing. |
| 2 | Suggestion | `getConfiguredDatabase` with the app's own `database.handle` on Workers outside a scope is not refused (only the shared path is). | Accepted: an app that supplies its own handle owns its lifetime; the README says Workers apps use the scope. |
| 3 | Suggestion | No test runs the scope inside workerd itself. | Deferred to RP-10, which runs the example app's e2e in workerd against Postgres. |

Evidence: `foundation/db/tests/request.test.ts` 8 passed; skipping the close turns 2 red; planting a
`migrations/files.ts` re-export in the request entry turns the guard red; repo typecheck clean; ESLint clean on
`foundation/db/src`.
