---
change_id: connections-change-hook-945
verdict: approved
---

# Implementation review

Reviewed the diff of 55cf60b against plan.md and the issue's proposal.

- Proposal: `onConnectionChanged(event, ctx)` with `provider`, `accountId`, `kind`, `change`, `code` (on
  `connect_failed` only), `actorId` and `at`; run after the state is stored (the tests read the rows inside the hook);
  never a credential (a test searches the events and lines for the code, state, password, username and client
  secret); the provider of a failed callback comes from the consumed pending authorization; a throwing hook is
  logged by kind and the call still succeeds. The info log line is added as well.
- `completeAuthorization` was split: the consumed-state part stays, `exchangeCode` returns a result, and one place
  reports it, so no failure path after the state is consumed can skip the event.
- `disconnect` now revokes through `revokeDeleted` and reports with `revoked`; `disconnectAction` passes the admin's
  id (asserted in `tests/next.test.ts` with the real role check).
- Log safety: provider and account ids are validated patterns, the kind, change and code are module values, an
  actor id that is not a plain token is JSON-quoted (tested).
- No existing test was loosened; `tests/next.test.ts` restores its spies after each test.
- Recorded limit: `reconnected` comes from a read before the upsert, so two admins connecting the same account at the
  same moment may both see `connected`; no event is lost.

Verdict: approved, no changes.
