# Research: long operations as MCP Tasks (issue #977)

## Findings

- `@modelcontextprotocol/server` 2.3.0 (master's lockfile): the 2025-11-25 task methods have "no SDK runtime"; the
  types stay importable for interoperability only. Revision 2026-07-28 removed Tasks from core; SEP-2663 re-defines
  `tasks/get` and `tasks/cancel` for the extension `io.modelcontextprotocol/tasks`, and the dispatcher accepts them
  on the 2026 era only when a handler was registered with an explicit schema (`setRequestHandler(method, { params,
  result }, handler)`). `tasks/update` is outside the spec registry, so it is an ordinary extension method.
- On the 2026 era a `tools/call` result may carry a handler-provided `resultType` other than `complete`
  (`EXTENDED_RESULT_TYPE_METHODS`); McpServer adds `content: []` to a result without content (harmless: the extension's
  `CreateTaskResult` schema is a plain, non-strict object).
- Per-request client capabilities arrive in `ctx.mcpReq.envelope["io.modelcontextprotocol/clientCapabilities"]`, whose
  `extensions` is a record. `server/discover` reports the server's `capabilities.extensions`, which
  `server.server.registerCapabilities` sets before connect (createMcpHandler connects after the factory).
- A spike through `createMcpHandler` in JSON mode confirmed: discover lists the extension, a tool's task result passes
  through, a `tasks/get` handler runs with the envelope, `ProtocolError(-32602)` reaches the client as is, and
  `MissingRequiredClientCapabilityError({ requiredCapabilities })` gives `-32021`.
- `@modelcontextprotocol/ext-tasks` 0.2.2 is the requester side and a 2025 receiver for sampling/elicitation; it has no
  server-side tool task support. Its V2 schemas define `Task { taskId, status, statusMessage?, createdAt,
  lastUpdatedAt, ttlMs (int | null), pollIntervalMs? }`, `CreateTaskResult = Task & { resultType: "task" }` and
  `DetailedTask` with `result` (completed) or `error` (failed).
- Spec rules that shape the design: never answer a task to a client that did not declare the extension on that
  request; `tasks/get` from a non-declaring client is `-32021`; unknown or expired task `-32602`; the task must be
  durable before the answer; task ids unguessable, every task request authorised; `failed` only for JSON-RPC errors,
  a tool error is `completed` with `isError: true`; `tasks/cancel` and `tasks/update` acknowledge with an empty result.
- mcp-access: operations (#952) live in `src/jobs/operations.ts` (`startOperation`, `getOperation`, `cancelOperation`,
  `describeOperation`, poll seconds); tables in `src/schema.ts`, migrations up to `0005`; prune in
  `src/server/prune.ts`; privacy in `src/server/privacy.ts`; health probe in `src/server/health.ts`; the module's
  table list in `module.json` and `src/index.ts`; the e2e list in `examples/next-app/e2e/migrations.spec.ts`.

## Options

1. Task id = job id: no table, but job ids are a guessable sequence (spec MUST against).
2. Task id = HMAC over the job id: no table, but a new required secret for every app that wants tasks.
3. A table of random task ids per owner and job, with expiry: a migration, prune and account deletion.

## Recommendation

Option 3, with the task handlers in `/jobs` next to the operations and the opt-in on `startOperation`.
