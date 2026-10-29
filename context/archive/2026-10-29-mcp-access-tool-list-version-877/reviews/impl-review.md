---
change_id: mcp-access-tool-list-version-877
verdict: approved
---

# Implementation review

Reviewed 282c78c against plan.md and issue #877.

- `measureToolList` registers on a recording `McpServer` with the served name and options and lists it through
  `createMcpHandler`, the same path the endpoint serves; the fingerprint is sha256 over canonical JSON of the tools in
  name order, 12 hex digits, behind `<release>-tools-`. Tests cover equal registrations, a changed description, input
  field and name, reordering, the release part, zero tools and a bad release.
- `createMcpServerFactory` caches the measurement promise per `canWrite`, drops a rejected one, honours a fixed
  `version`, and passes `title` and `serverOptions` to the served server. Tests read `serverInfo` from `initialize`
  through the handler for both levels, count registrations under parallel first requests and retry after a failure.
- The catalog check now shares `listServedTools`; its existing tests pass unchanged. A server with no tools answers
  `Method not found` to `tools/list` (no tools capability); both callers read that as an empty list, noted in the
  changelog.
- `measureServedToolLists` in `/testing` matches what the factory serves (test).
- Gates: typecheck, ESLint on the package, language gate, `vitest modules/mcp-access` (23 files) green. README §4 and
  the changelog describe the API and the per-level limitation.

Verdict: approved.
