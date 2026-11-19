---
change_id: mcp-endpoint-limit-per-token
title: "mcp-access: MCP endpoint rate limit per verified token, body peeks counted while they stream"
status: archived
archived_at: 2026-11-19
roadmap_item: null
issue: null
branch: claude/project-thread-amoubq
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the two warnings of the 2026-11-19 control run of the security review of `modules/mcp-access`.

## Context

Asked in chat (no issue). QR-5f7c7786: `POST /api/mcp` counted every request per client address before verification,
so one caller behind a hosted platform's shared address (or a flood of bad tokens from it) locked out every other
account there. QR-f6141c3a: the request diagnostics and the `initialize` check read `request.clone().text()` when no
`Content-Length` came, so a chunked body was buffered whole before the SDK refused it.

## Scope

- `src/server/endpoint.ts`: verify first; key the counter `token:<id>` for a valid token, the address otherwise.
- `src/server/peek-body.ts` (new): a capped JSON read of a clone; used by `request-diagnostics.ts` and
  `tool-list-session.ts`.
- `src/index.ts` (bucket doc), README (rate limits, limitations), CHANGELOG (Unreleased).

## Constraints

- No migration; `MCP_RATE_LIMIT_BUCKETS` keeps its shape and numbers.

## Notes

- Frame and research skipped: each finding names its cause and the files; the review is the research.
- Two tiny items of one package share this change (AGENTS.md: very similar tiny items may share).

## Decisions (auto)

- A request without a valid token stays counted per address; it runs one indexed token lookup (a value without the
  token's shape runs none) before it is counted, which the address counter still bounds.
- Not `readSmallBody` from `@softure-ai/security`: it awaits the cancel of the clone, and the cancel of one branch of a
  teed stream settles only when the other branch is cancelled too, so a body over the cap hung the request (seen in the
  existing 413 test). The helper cancels without waiting.

## Done

- On master; released with the next mcp-access release.
