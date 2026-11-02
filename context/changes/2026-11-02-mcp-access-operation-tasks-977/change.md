---
change_id: mcp-access-operation-tasks-977
title: "mcp-access: long operations answered as MCP Tasks when the client declares the extension (issue #977)"
status: in_progress
roadmap_item: null
issue: 977
branch: claude/project-thread-gepwjl
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #977](https://github.com/SOFTURE/AI/issues/977), the optional item 4 of #952: when a client declares
support for MCP Tasks, a long tool answers as a task instead of an operation id, and the client follows it through
`tasks/get` and stops it through `tasks/cancel`. Clients without the capability keep the polling tools
(`get_operation`, `cancel_operation`), which stay the default.

1. Opt-in per tool: `startOperation(ctx, identity, { ..., taskRequest })` with the tool handler's request context.
2. `registerOperationTasks(server, { ctx, identity, readResult?, poll? })`: the server's Tasks capability and the
   `tasks/get`, `tasks/update` and `tasks/cancel` handlers over the operation's job.
3. Status mapping from the operation, the result from `readResult`, cancel through `requestJobCancel`.

## Context

- Labels: `enhancement`, `pkg: mcp-access`. Follow-up of #952 (on master, PR #979, merge b356dcf).
- The MCP SDK on master (`@modelcontextprotocol/server` 2.3) has no Tasks runtime: Tasks left the core protocol in
  revision 2026-07-28 and became the extension `io.modelcontextprotocol/tasks` (SEP-2663). The SDK passes a tool's
  `resultType: "task"` through and routes `tasks/get` and `tasks/cancel` to handlers registered with a schema.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- `/server` must not load `@softure-ai/jobs`: everything lives in `@softure-ai/mcp-access/jobs`.
- English only; copy in the messages dictionary.
- New migration `0006`; the e2e migration list follows.

## Notes

- Framing: skipped. The issue names the mapping and the opt-in; the spec fixes the wire shapes.

## Decisions (auto)

- Implement the Tasks extension of revision 2026-07-28 (the one the SDK on master routes), not the 2025-11-25 core
  Tasks: the SDK has no runtime for the old vocabulary, and the issue's "wait until the SDK is stable" is met by the
  extension's published spec and the SDK's routing of its methods. 2025-era clients never declare the per-request
  capability, so they keep the polling tools.
- A task id is a random 32-byte value (base64url) in a new table `mcp.operation_tasks` (task id, owner, job id,
  expiry), not the job's id: the spec requires unguessable task ids, and job ids are a sequence. Every task request
  checks the owner as well (auth binding). The same account joining the same job gets the same task id.
- A failed job is a `completed` task whose result is the `get_operation` answer with `isError: true`, not a `failed`
  task as the issue writes: the spec reserves `failed` for JSON-RPC errors and requires a tool-level failure to be
  `completed` with `isError`.
- `tasks/cancel` is a write, like `cancel_operation`: a read-only identity gets `-32600` with a sentence. A finished
  operation is acknowledged (cancellation is cooperative in the spec).
- `tasks/update` acknowledges an owned task (operations never ask for input) and answers `-32602` for any other id.
- Tasks expire a day after creation by default (`taskTtlSeconds`); `pruneMcpAccess` deletes expired rows; an expired
  or unknown task is `-32602`. Account deletion removes the account's task rows (they hold ids and dates only and are
  not part of the export).
