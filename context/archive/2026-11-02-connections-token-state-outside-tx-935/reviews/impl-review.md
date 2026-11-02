---
change_id: connections-token-state-outside-tx-935
verdict: approved
---

# Implementation review

Reviewed the diff of 50de4e9 against change.md and plan.md.

- Acceptance: both tests of the issue are in `tests/rollback-935.test.ts` (rotated refresh token kept and spent next;
  `invalid_grant` keeps `reconnect_required`, hook once), plus `reportCredentialRejected`. They failed before the fix
  (3 of 4, on Postgres 16) and pass after it. The PGlite case pins the documented exception.
- Scope: `getStateContext` is applied at the two entry points (`readAccessToken`, `reportCredentialRejected`), which
  every token path (`getAccessToken`, `replaceRejectedToken`, `requestWithConnection`, `downloadWithConnection`)
  goes through; the API key read and the app's own writes are untouched.
- Compatibility: a context whose `db` is not a transaction returns unchanged; a `pglite://` or empty URL opens
  nothing. The whole existing suite (171 tests) passes without a change.
- Found and fixed in review: the README edit dropped sections 5 to 9 (restored); the Postgres test helper left the
  pool open when no call resolved it (now closed unless already ended).
- Noted, accepted: with only `database.url` set, a call inside a transaction opens the process-wide shared pool for
  that URL, as the module's adapters do. A failing `database.handle` propagates, like everywhere else.

Verdict: approved.
