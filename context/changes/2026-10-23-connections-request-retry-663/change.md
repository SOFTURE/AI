---
change_id: connections-request-retry-663
title: "connections: call an API with a stored credential, refresh once on a 401 (issue #663)"
status: in_progress
roadmap_item: null
issue: 663
branch: claude/project-thread-2y67t3
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #663](https://github.com/SOFTURE/AI/issues/663): every API client an app writes on top of
`@softure-ai/connections` repeats the same token, header, `requestJson`, 401 block, and a single early-refused OAuth
access token moves the connection straight to `reconnect_required` although the refresh token still works. Add
`getAccessToken({ forceRefresh: true })` and a `requestWithConnection` helper (`/server` and `/next`) that sets the
authorization header for any credential kind, refreshes once and retries on a 401 with OAuth, and only then reports
the credential rejected. Cover it with the fake OAuth provider in `/testing`.

## Context

Labels: `enhancement`, `pkg: connections`. No release in this change: the coordinator releases connections in the
next combined release.

## Constraints

- One forced refresh still runs under the row's lease; `invalid_grant` stays terminal.
- Overlapping callers that all saw a 401 for the same token refresh once, not once each.
- No secret reaches an error, a log line or a thrown message.
- Existing calls (`getAccessToken` without the flag, `requestJson` used directly) behave exactly as before.
- Out of scope: provider-specific clients (README §12).

## Notes

- Framing: skipped. The issue names the problem and the API.
