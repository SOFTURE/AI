---
change_id: mcp-access-operations-952
title: "mcp-access: long operations as tools (start, status with progress, cancel) on top of jobs (issue #952)"
status: archived
roadmap_item: null
issue: 952
branch: claude/project-thread-vdrg81
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #952](https://github.com/SOFTURE/AI/issues/952): a tool whose work takes minutes cannot hold the MCP
call open, so every app invents its own "start returns an id" and "status" tools. Ship them once, on top of
`@softure-ai/jobs` and the progress and running-job cancel of #951:

1. `startOperation` for a tool handler: enqueue a job and answer `{ operationId, status: "queued", pollAfterSeconds }`
   with a fixed sentence (call the status tool, do not call start again).
2. `registerOperationStatusTool` (`get_operation`): status, progress, a growing `pollAfterSeconds`, the app's
   `result` on success, `errorCode` on failure; scoped to the caller's account.
3. `registerOperationCancelTool` (`cancel_operation`) over `requestJobCancel`, registered only for write access.
4. MCP Tasks (optional in the issue): not in this change, see Decisions.

## Context

- Labels: `enhancement`, `pkg: mcp-access`. Depends on #951 (on master, merge 35b8fae).
- Other threads change jobs in parallel (#955, #958): this change adds no jobs migration and does not edit jobs.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- `/server` must not load `@softure-ai/jobs` (an optional peer): the operations live in `@softure-ai/mcp-access/jobs`.
- English only; copy in the messages dictionary.

## Notes

- Framing: skipped. The issue names the functions, their answers and the scoping rule.

## Decisions (auto)

- Entry point `@softure-ai/mcp-access/jobs`, not `/server` as the issue writes: `/server` never imports the optional
  `jobs` peer, and `/jobs` already does (the prune handler).
- Ownership rides on the job itself, no new table or migration: an operation's job has origin `mcp` and the dedup key
  `mcp:<userId>:<key>` (the app's `dedupKey`, else a random UUID). The jobs table keeps the key after the job ends, so
  the status and cancel tools check the prefix; any other job, or another account's, is "not found". The app's dedup
  key is thus scoped to the account, which is what a per-user tool wants.
- `pollAfterSeconds` grows with the operation's age: a quarter of the seconds since it was started, between 2 and 30
  (both options). Absent once the operation is finished.
- A pending job with attempts already used (waiting for a retry) is `running` to the assistant: the operation has not
  ended.
- `result` comes from the app's `readResult(job)` on success (jobs stores no result); without it there is none.
- MCP Tasks (item 4, optional and experimental in the spec): left out; the polling tools work with every client. A
  follow-up issue tracks it (#977).
