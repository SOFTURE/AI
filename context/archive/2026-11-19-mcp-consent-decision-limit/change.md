---
change_id: mcp-consent-decision-limit
title: "mcp-access: rate-limit the OAuth consent decision per signed-in account"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the suggestion QR-833b1c33 of the 2026-11-19 security review of `modules/mcp-access` at 240ca814.

## Context

Asked in chat (no issue). `handleAuthorizationDecision` checked the origin and the session but counted nothing, and
every `allow` inserts an authorization code row that lives 10 minutes, so one account could grow the table in a loop.

## Scope

- `src/server/oauth-http.ts`: `limitDecision`, per `user:<id>` in the `mcp-oauth` bucket, before validation.
- README (rate limits), CHANGELOG (Unreleased).

## Notes

- Frame and research skipped: the finding names its cause and the file; the review is the research.

## Decisions (auto)

- Keyed per account, not per address: the decision needs a session, and people behind one office address must not
  share the room. 429 and 503 answer with an empty body, like the route's other refusals.

## Done

- On master; released with the next mcp-access release.
