---
change_id: mcp-access-confirmed-calls-953
title: "mcp-access: in-chat confirmation for a priced or irreversible tool call (issue #953)"
status: in_progress
roadmap_item: null
issue: [953]
branch: claude/project-thread-t5a3k4
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #953](https://github.com/SOFTURE/AI/issues/953): a tool that spends money or cannot be undone gets the
`--commit` rule over MCP. The first call only estimates and answers a confirmation token; the person agrees in the
chat; a second call with the same input and the token does the work. The token is bound to the tool, the arguments,
the account and access token, the estimate's total and an expiry, and is single use.

## Context

Labels: `enhancement`, `pkg: mcp-access`. Package: `modules/mcp-access` 0.2.9. Checked first that no other session
shipped it: nothing on master (c9380e5) mentions `withConfirmation` or #953, no branch or pull request for it.
Issues #949 and #961 touch the same package in parallel threads (migrations and `/server` exports may conflict).
No version bump: the coordinator releases the batch.

## Constraints

- Opt-in per tool: a tool without `withConfirmation` behaves as before.
- No consent can be given by the assistant alone: the token comes only from an estimate call, is single use and
  bound to the exact input.
- The adopting app is not changed here; the closing comment says how it adopts.

## Notes

- Framing: skipped. The issue names the problem, the four asks and the API shape.
