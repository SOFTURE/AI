---
change_id: mcp-registration-window-520
title: "mcp-access: keep dynamic client registration closed and open it for N minutes (issue #520)"
status: in_progress
roadmap_item: null
issue: 520
branch: claude/project-thread-4yppm4
created: 2026-10-15
updated: 2026-10-15
---

## Intent

Close [issue #520](https://github.com/SOFTURE/AI/issues/520): with `oauth.enabled`, `POST /api/oauth/register`
(RFC 7591) is always open. An adopting app with a single owner wants registration closed by default and opened only
for the minutes in which the owner adds the connector in an assistant. Today it wraps `registerOAuthClientRoute` with
its own gate and its own "open until" table.

## Context

mcp-access is at 0.2.1 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- Opt-in: without the new option registration stays open, as today.
- Closed, the route answers an RFC 7591-shaped error (`403`, `error` + `error_description`) before reading the body;
  the discovery document keeps `registration_endpoint`.
- The window is opened and closed by safe ops scripts (`@softure-ai/ops/scripts`: dry run by default, `--commit`).
- An open window is bounded: at most 24 hours.

## Notes

- Framing: skipped. The issue names the gap, the option shape and the script.

## Decisions (auto)

- Option `oauth.registration: "open" | "closed"`, default `"open"`. `"closed"` means closed except while a window
  opened by the script lasts. The function form from the issue is left out: the stored window covers the use case and
  an app can still wrap the route.
- State lives in a one-row table `mcp.oauth_registration_window` (migration 0003), not in a switch: a switch is a
  boolean and cannot expire on its own.
- Closed answer: `403 { "error": "access_denied", "error_description": "Client registration is closed." }`.
  `invalid_client_metadata` would tell the client its metadata is wrong.
- Scripts `open-client-registration --minutes=<1-1440>` and `close-client-registration`, exported from a new
  `@softure-ai/mcp-access/scripts` entry; `@softure-ai/ops` becomes an optional peer like in auth.
- A failing read of the window fails closed: `503 temporarily_unavailable`.
