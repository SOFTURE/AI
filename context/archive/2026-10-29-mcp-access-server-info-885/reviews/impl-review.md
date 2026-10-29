---
change_id: mcp-access-server-info-885
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and master (6e688f8).

- Acceptance of #885: `serverInfoTool` on `createMcpServerFactory` registers `get_server_info` (no input fields,
  `readOnlyHint`, `idempotentHint`) for read and write tokens; it answers the app's build info (the test passes
  `readBuildInfo` of `@softure-ai/ops/server` and reads the environment it sets), the optional changelog and the served
  name and version, measured or fixed, per access level. Off unless the option is set.
- Bundling: `src/server/server-info.ts` imports neither `@softure-ai/ops` nor anything that does; only the test does.
- Consistency: the tool is registered on the recording server too, so the measured version describes the served list
  (the version-changes test pins it); the placeholder version on the recording server is never answered, since its
  handler does not run there.
- Strict input: the tool declares an empty object schema, so the factory's strict option refuses an unknown field with
  the module's message (tested); without strict input, zod strips extras as for every other tool.
- Failure: a failing changelog provider gives `changelog: null` and logs only the error class (tested, message not
  logged); a failing `buildInfo` answers a tool error (tested).
- Gates: typecheck, ESLint and the language gate clean; mcp-access tests 361 passed; the repository tests pass.
- Docs: README section and `## Unreleased` changelog entry; no version bump (batch release).

Verdict: approved.
