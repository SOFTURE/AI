---
change_id: mcp-access-adopter-helpers
title: "mcp-access: tool helpers, stdio entry, catalog parity, route constants, issue gate, scheduled pruning (issue #315)"
status: archived
roadmap_item: null
issue: 315
branch: claude/project-thread-rjjoum
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #315](https://github.com/SOFTURE/AI/issues/315): transport and auth come from `createMcpEndpoint`, but an
adopting app still writes its own tool result helpers and error boundary, a server-action bridge for write tools, a
stdio entry, a catalog parity check, route strings, a whole copy of `issueTokenAction` for a billing gate, and inline
pruning. After the change the package ships each of them, with the safe path (no SQL or raw error text reaching the
assistant) as the default.

A reviewer checks `modules/mcp-access/tests/adoption-gaps-315.test.ts` (one `describe` per point of the issue) and the
README sections "Writing tools", "Stdio", "Catalog parity", "Gating token issue" and "Scheduled pruning".

## Context

Issue #315, filed by an adopting app. No roadmap item; the PR closes the issue. `@softure-ai/mcp-access` 0.1.12 is
unreleased (#311 merged it); this change folds into that version. #316 (agent-ready MCP factory contract) runs in
parallel: this change keeps `McpServerFactory(identity)` unchanged, so agent-ready can adopt it.

## Constraints

- Nothing existing changes behaviour: `issueTokenAction`, `McpAccessPage` (no props) and the endpoint answer as before.
- No function enters the module options: a hook in `softure.config.ts` would pull the app's billing code into every
  script and the proxy that read the config (the problem #316 reports for agent-ready).
- English-only code and docs; new user-facing copy (two refusal messages) goes to `messages/en.ts` and `messages/pl.ts`.

## Process notes

- Research: kept in plan.md's "Today" section; every unknown was answered by reading the package, the MCP SDK 2.3
  typings and the mailing CLI it mirrors. No separate research.md.
- Framing: skipped. The issue names each gap and its proposal.

## Decisions (auto)

See plan.md "Decisions". Version: fold into the unreleased 0.1.12.
