---
change_id: connections-refresh-failure-detail-936
title: "connections: a failed token refresh carries the HTTP status and the OAuth error code (issue #936)"
status: archived
roadmap_item: null
issue: 936
branch: claude/project-thread-mnowyt
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #936](https://github.com/SOFTURE/AI/issues/936): a token-endpoint answer that is not `invalid_grant`
maps to `connections.refresh_failed` (or `connections.client_rejected`) and nothing says what the provider answered.
After this change the failure value, one warn log line and the stored row carry the HTTP status and the OAuth `error`
code (both nullable; null status = no answer: network failure or timeout).

## Context

Labels: `enhancement`, `pkg: connections`. Issue #935 changes the same refresh path (writes outside the caller's
transaction) in parallel; fresh master is merged before the merge. No release in this change: the coordinator
releases the batch.

## Constraints

- Never the response body, an error description or a token in the result, the log or the database.
- Additive: callers that read only `error` keep working; apps run one new forward-only migration.
- No change to any app repository.

## Notes

- Framing: skipped. The issue names the problem, the proposal and the acceptance tests.
