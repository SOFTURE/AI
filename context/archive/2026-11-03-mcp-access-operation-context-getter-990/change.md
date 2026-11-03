---
change_id: mcp-access-operation-context-getter-990
title: "mcp-access: operation tool registrars take a context getter (issue #990)"
status: archived
roadmap_item: null
issue: 990
branch: claude/project-thread-rcnkz7
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #990](https://github.com/SOFTURE/AI/issues/990): an app whose MCP server factory resolves its database
context per call (a `() => Promise<Context>` getter) can register `get_operation` and `cancel_operation` without
opening the database at registration, and an app that wraps `getOperation` or `cancelOperation` itself can answer
with the module's sentences.

1. `getContext: () => Promise<JobsContext>` as an alternative to `ctx` in `OperationStatusToolOptions` and
   `OperationCancelToolOptions`, resolved inside each call.
2. The module's messages come from the config the call resolves; the tool description at registration from an
   optional `config`, else the built-in English dictionary.
3. Export the operation error hints for `withToolErrors`.

## Context

- Labels: `enhancement`, `pkg: mcp-access`. Follows #952 (operation tools) and #977 (MCP Tasks), both in 0.3.0.
- `@softure-ai/agent-ready` has a devDependency on `@softure-ai/mcp-access`; no version bump here, so its range stays.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- Backward compatible: `{ ctx, identity }` keeps working unchanged.
- `/server` must not load `@softure-ai/jobs`: everything stays in `@softure-ai/mcp-access/jobs`.

## Notes

- Framing: skipped. The issue names the problem and the three asks.

## Decisions (auto)

- The options are a discriminated union: either `ctx` or `getContext` (with an optional `config`), never both, so the
  compiler rejects an ambiguous call.
- `registerOperationTasks` takes the same alternative: an app with a per-call context needs it for the same reason,
  and its handlers already read `ctx` only inside each request.
- The tool description at registration with only `getContext` comes from `config` when given, else from the built-in
  English dictionary (`mcpAccessMessages.en`); the error hints always come from the config the call resolves, so an
  app's overrides still apply to them.
- The hints are exported as a function, `getOperationErrorHints(config)`, because they depend on the app's dictionary.
