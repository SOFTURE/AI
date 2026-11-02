---
change_id: connections-token-state-outside-tx-935
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (2f4bddb).

- Scope: both acceptance tests of the issue are in Phase 1, plus the 401 path (`reportCredentialRejected`), which the
  issue names through `callWithConnection`.
- Compatibility: a non-transaction `ctx.db` keeps exactly today's path; PGlite inside a transaction too, so no test or
  dev setup starts hanging.
- Safety: no new secret handling; the lease semantics are unchanged and now visible to other workers at once (before,
  a lease taken inside a transaction was invisible until commit).
- Risk noted for the docs: a second pool connection per call inside a transaction; a row the caller's transaction
  already locked would make the outside write wait. Both go in the README.
- The resolution must never open a new database for a `pglite://` or empty URL; covered by the existing PGlite suite.

Verdict: approved, no changes.
