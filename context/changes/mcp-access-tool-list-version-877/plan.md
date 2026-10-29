---
change_id: mcp-access-tool-list-version-877
status: in_progress
---

# Plan: server version that follows the tool list (issue #877)

Input: change.md, research.md. Complexity: small (one new server file, a shared lister, a testing helper, docs).

## Phase 1: measurement and factory (TDD)

Files: `modules/mcp-access/src/server/tool-list.ts` (new), `src/server/server-factory.ts` (new),
`src/server/index.ts`, `src/testing/catalog.ts`, `src/testing/index.ts`, `tests/tool-list-version-877.test.ts` (new).

- `listServedTools(createServer)`: the `tools/list` request the catalog check makes, returning the full tool objects;
  the catalog check maps it to names.
- `fingerprintToolList(tools)`: sha256 over canonical JSON (keys sorted at every level, tools sorted by name), first
  12 hex digits.
- `measureToolList(registerTools, { release?, name?, serverOptions? })` → `{ toolListVersion, toolCount }`: registers on
  a recording `McpServer` built with the same name and options, lists it, returns `<release>-tools-<hash>`. Release
  default `1.0.0`; a release that is not `MAJOR.MINOR.PATCH` throws (a setup bug).
- `createMcpServerFactory({ name, release?, title?, serverOptions?, registerTools(server, identity) })` →
  `McpServerFactory`: measures once per access level (`canWrite`), caches the promise, serves
  `serverInfo.version = toolListVersion`; `version` overrides it with a fixed value.
- `measureServedToolLists(createServer)` in `/testing`: `{ read, write }` measured through the app's factory, for an
  inline snapshot next to the catalog check.
- Tests: same registrations same version; a changed description, schema field or name changes it; tool order does not;
  read and write levels differ and the count follows; `initialize` answers the version through the endpoint handler;
  measurement is cached per level; a bad release is refused; a fixed `version` wins; the testing helper.

## Phase 2: docs

`modules/mcp-access/README.md` (the factory and why the version follows the tool list), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- A factory helper instead of changing `createMcpEndpoint`: the module never built the server, and a factory returning
  `McpServerFactory` serves the endpoint, stdio and the catalog check alike. #876 can add its strict input to it.
- Cache per `canWrite` only: the endpoint's contract lets the tool list vary by access level; documented that a list
  depending on the account needs `measureToolList` per call instead.
- Tools sorted by name before hashing: clients key tools by name, so a reordering is not a schema change.
- Default release `1.0.0`: any valid semver core; apps pass their own release when they want it visible.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: measurement and factory
- [ ] Phase 2: docs
- [ ] Implementation review
