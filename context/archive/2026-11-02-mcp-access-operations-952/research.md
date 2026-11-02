# Research: long operations as MCP tools (issue #952)

## Findings

- `@softure-ai/jobs/server` (0.1.6 + #951 on master): `enqueueJob(ctx, { queue, payload, dedupKey?, origin? })`
  answers `{ id, isDuplicate }`; `getJob(ctx, id)` answers the `Job` or null (an invalid id is null);
  `requestJobCancel(ctx, id)` cancels a pending job or sets `cancelRequestedAt` on a running one, `jobs.not_found`
  or `jobs.not_cancellable` otherwise. `Job` carries `status` (`pending | running | succeeded | failed | cancelled`),
  `attempts`, `lastError`, `progress` (`{ step, done?, total?, code? }`, codes and counts only), `createdAt`,
  `origin`, `dedupKey`, `cancelRequestedAt`.
- The dedup key is unique only among live jobs (`jobs_dedup_key_idx` is partial on pending/running) and stays on the
  row after it ends; at most 200 characters. `origin` matches `^[a-z][a-z0-9_.-]{0,62}$`.
- Jobs stores no handler result; a run summary is codes and counts only and `listJobRuns` does not filter by job.
- `@softure-ai/mcp-access`: `/jobs` already imports jobs (the prune handler); `/server` does not (jobs is an
  optional peer). Tools answer through `toolResult`/`toolError`/`withToolErrors` (`/server/tools.ts`); the request's
  `McpServerIdentity` carries `userId` and `canWrite` (write scope and the app's write switch already applied by the
  endpoint). `get_server_info` shows the registration style (`registerTool` with annotations, `z.object({})`).
- Copy: `getMcpAccessMessages(config)` gives the merged, locale-selected dictionary (`messages/en.ts`).
- Tests run on PGlite (`tests/support.ts`: `createTestMcp(createConfig(OPTIONS, "en", [jobs(...)]))`), and
  `@softure-ai/jobs/testing` has `runDueJobs` to drive a handler in process. An `McpServer` can be called in tests
  through the SDK's in-memory transport (see `tests/server-info-tool-885.test.ts`).
- The MCP SDK ships experimental task support; the spec marks Tasks experimental (2025-11-25).

## Options

1. A table `mcp.operations (job_id, user_id)` for ownership: a migration, privacy export/delete, prune, the e2e
   migration list.
2. Ownership in the job's own dedup key (`mcp:<userId>:<key>`) and origin `mcp`: no migration, no cleanup; the
   job's retention is the operation's.

## Recommendation

Option 2, in `@softure-ai/mcp-access/jobs`.
