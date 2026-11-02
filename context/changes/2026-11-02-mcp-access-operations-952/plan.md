---
change_id: mcp-access-operations-952
status: in_progress
---

# Plan: long operations as MCP tools (issue #952)

Input: change.md, research.md. Complexity: medium (one new file, copy, tests, docs).

## Phase 1: operations in `/jobs`

Files: `modules/mcp-access/src/jobs/operations.ts` (new), `modules/mcp-access/src/jobs/index.ts`,
`modules/mcp-access/src/messages/en.ts`, `modules/mcp-access/tests/operations-952.test.ts` (new).

1. `startOperation(ctx, identity, { queue, payload, dedupKey?, statusToolName? })`: enqueue with origin `mcp` and
   the owner's dedup key; a new job answers `queued`, a duplicate answers the live job's status. The answer is JSON
   `{ operationId, status, pollAfterSeconds, message }`. A dedup key over 150 characters is a bug (throws).
2. `getOperation(ctx, identity, operationId, options)` and the mapping: `pending` with no attempt → `queued`,
   `pending` retrying or `running` → `running`, else the job's status; `progress` while running; `pollAfterSeconds`
   while not finished (age / 4, clamped to `poll.minSeconds` 2 and `poll.maxSeconds` 30); `result` from
   `readResult` on success; `errorCode` (`lastError`, `jobs.cancelled` for a cancelled job); `cancelRequested`.
3. `registerOperationStatusTool(server, { ctx, identity, name = "get_operation", description?, readResult?, poll? })`,
   read-only and idempotent; `registerOperationCancelTool(server, { ctx, identity, name = "cancel_operation", ... })`
   registers nothing without `identity.canWrite`; both answer through `withToolErrors` with the module's hints for
   `mcp-access.operation_not_found` and `mcp-access.operation_finished`.
4. Copy under `operations` in `en.ts`: tool descriptions, the start sentence (naming the status tool), one sentence
   per status, the two error texts.
5. Tests: start answers queued with the sentence and a job of origin `mcp`; dedup per account (same key joins,
   another account's same key starts its own); status maps queued, running with progress, succeeded with result,
   failed with code, cancelled; poll grows and is clamped; another account's id, a non-operation job and a malformed
   id are not found; cancel pending and running (cancel requested), finished refused; no cancel tool for read-only
   identities; through an `McpServer` and the in-memory client once.

## Phase 2: docs

Files: `modules/mcp-access/README.md`, `modules/mcp-access/CHANGELOG.md`.

1. README: a section on long operations (wiring, answers, ownership, polling, what the handler reports) and §12 note
   that MCP Tasks is not used.
2. CHANGELOG `Unreleased` entry.

## Progress

- [ ] Phase 1: operations in `/jobs`
- [ ] Phase 2: docs
