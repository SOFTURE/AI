---
change_id: mcp-access-tool-contract-1078
status: archived
---

# Plan: get_server_info answers the served tool contract (issue #1078)

Input: change.md, research.md. Complexity: small.

## Phase 1: code and tests (TDD)

Files: `src/server/server-info.ts`, `src/server/server-factory.ts`, `src/server/tool-list.ts`, `src/messages/en.ts`,
`tests/server-info-tool-1078.test.ts`.

- `ServerInfoToolOptions.tools?: boolean`. With it on the input is `{ name?: string }` (strict input still refuses
  other fields), and the answer adds `toolsHint` (dictionary) and `tools: [{ name, description, inputSchema }]`.
- `name` given: only that tool; unknown: `tools: []` plus `toolNames` (sorted).
- `RegisterServerInfoToolOptions.servedTools?: () => Promise<readonly ServedTool[]>`; the factory passes its cached
  measurement for the identity's access level (measured even with a fixed `version`). A hand-built server passes
  `() => listServedTools(createServer)`. With `tools` on and no `servedTools`, registration throws (setup bug).
- Tests: both access levels equal `tools/list` (with strict input on), the version stays the fingerprint, `name`
  narrowing, unknown name, no identity in the answer, option off keeps the empty schema and version.

## Phase 2: docs

README (`get_server_info` section, hosted clients section), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Contract fields are exactly the issue's `name`, `description`, `inputSchema`, to keep the answer small.
- The issue's optional item 3 (schema on a refusal) is left out: the hint plus the in-band contract already lets the
  model correct a call, and changing every refusal message is a separate change.
- An unknown `name` is a normal answer, not a tool error, so the model reads the names and retries.

## Progress

- [x] Phase 1: code and tests
- [x] Phase 2: docs
- [x] Implementation review
