---
change_id: mcp-access-operation-tasks-977
status: in_progress
---

# Plan: long operations as MCP Tasks (issue #977)

Input: change.md, research.md. Complexity: medium (one migration, one new file, copy, tests, docs).

## Phase 1: task store and handlers

Files: `modules/mcp-access/migrations/0006_create_operation_tasks.sql` (new), `src/schema.ts`,
`src/jobs/operation-tasks.ts` (new), `src/jobs/operations.ts`, `src/jobs/index.ts`, `src/messages/en.ts`,
`src/server/prune.ts`, `src/server/privacy.ts`, `src/server/health.ts`, `src/cli/run.ts`, `src/index.ts`,
`module.json`, `examples/next-app/e2e/migrations.spec.ts`, `tests/operation-tasks-977.test.ts` (new).

1. Migration `mcp.operation_tasks (task_id text pk, user_id uuid fk auth.users cascade, job_id bigint, created_at,
   expires_at)`, unique `(user_id, job_id)`, index on `expires_at`; rollback comment.
2. `startOperation` takes `taskRequest` (the handler's request context) and `taskTtlSeconds`; when the request's
   envelope declares the extension, it stores (or reuses) the task row in the same flow and answers the
   `CreateTaskResult`; otherwise the polling answer as today.
3. `registerOperationTasks(server, { ctx, identity, readResult?, poll? })`: capability, `tasks/get` (DetailedTask:
   working with `pollIntervalMs`, completed with the `get_operation` answer as a tool result, `isError` when the job
   failed, cancelled), `tasks/update` (ack), `tasks/cancel` (write only; ack). `-32021` without the capability,
   `-32602` for an unknown, foreign or expired task.
4. Prune expired task rows (`pruneMcpAccess`, the CLI line); delete the account's rows on deletion; health probe
   reads the table; table lists.
5. Tests through `createMcpHandler` on the 2026 era: discover lists the extension; a declaring client gets a task with
   a 43-character id, a non-declaring one the polling answer; a 2025-era call stays the polling answer; get maps
   queued/running (progress in statusMessage), succeeded with result, failed as completed with `isError`, cancelled;
   joins reuse the task id; foreign, unknown and expired ids are `-32602`; get without capability `-32021`; cancel
   pending and running, finished acknowledged, read-only refused; update acknowledges; prune and account deletion.

## Phase 2: docs

Files: `modules/mcp-access/README.md`, `modules/mcp-access/CHANGELOG.md`.

1. README: Tasks wiring under long operations; replace the "MCP Tasks is not used" note.
2. CHANGELOG `Unreleased` entry.

## Progress

- [ ] Phase 1: task store and handlers
- [ ] Phase 2: docs
