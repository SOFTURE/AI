# Research: mcp-access-tool-contract-1078

- `createMcpServerFactory` measures the tool list once per access level (`measureToolList` on a recording server,
  same strict-input wrapping) and registers `get_server_info` on both the recording and the served server, so the
  tool's own schema is part of the measured list.
- `measureToolList` already holds the listed tools (`listServedTools`) and drops them after fingerprinting; keeping
  them gives exactly what `tools/list` answers, at no extra cost.
- `registerServerInfoTool` is public for hand-built servers; those can list themselves with
  `listServedTools(createServer)`.
- Option 3 of the issue (schema on a strict-input refusal) touches `strict-input.ts` and every refusal message; it is
  optional in the issue.
