---
change_id: connections-module-634
reviewed: 2026-10-21
verdict: approved
---

# Plan review: connections-module-634

Checked plan.md against change.md, research.md, issue #634 and the module standard (docs/02).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A refresh inside a transaction holding `FOR UPDATE` would keep a connection open across a slow provider call. | Planned: a lease column with a conditional update; the HTTP timeout (10 s) is shorter than the lease (30 s). |
| 2 | Major | A rotated refresh token stored by a worker whose lease expired would overwrite a newer one. | Planned: the store is conditional on the lease id; a lost lease logs and still returns the access token it got. |
| 3 | Major | The callback could be completed in another admin's browser (login CSRF of the connection). | Planned: the state is bound to the starting user; a different session gets `connections.state_invalid`. |
| 4 | Major | A ciphertext copied between rows would decrypt as another provider's token. | Planned: AAD = `<provider>/<account>` (and the state hash for the verifier). |
| 5 | Minor | The hook must fire once per transition, not on every failed call. | Planned: the status update is conditional on `status = 'connected'`; only the call that flips it fires the hook; hook failures are logged, never thrown. |
| 6 | Minor | GitHub answers token errors with `200` and an `error` field. | Planned: the token client reads `error` on any status. |
| 7 | Minor | `next build` must not need the key or client secrets. | Planned: read at use time; missing ones are codes on the page. |
| 8 | Check | Every user-visible string in messages, ui classes only. | Architecture test, as in feature-switches. |

No Critical findings.
