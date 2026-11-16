---
change_id: mcp-access-mcp-apps
status: archived
---

# Plan: mcp-access MCP Apps helpers

Input: change.md. Complexity: small (one new file, one test file).

## Phase 1: server helpers and bridge (TDD)

Files: `modules/mcp-access/src/server/apps.ts`, `src/server/index.ts`, `tests/mcp-apps.test.ts`, README, CHANGELOG,
version files.

- Tests first: `appToolMeta` gives `ui.resourceUri` and the legacy key and refuses a non-`ui://` URI; `tools/list`
  carries the meta; `resources/list` and `resources/read` carry the MIME type and `_meta.ui`; `renderAppDocument`
  orders the bridge before the app's script and escapes closing tags; the bridge (run in `node:vm` against a fake
  host) initializes, applies the theme, reports its size, hands over input and results (structured, JSON text,
  error → null), ignores other windows, and resolves or rejects `callTool`.
- Then `apps.ts` and the exports.

## Decisions (auto)

- Own inline bridge instead of `@modelcontextprotocol/ext-apps`: no bundler in the page, no new dependency.
- Version 0.7.6, not 0.8.0: additive, and `agent-ready`'s dev range and adopting apps' `^0.7` take it unchanged.
- Version bump in the same pull request (the auto-release on master tags it).

## Progress

- [x] Phase 1: see the pull request (`npx vitest run modules/mcp-access/tests/mcp-apps.test.ts`: 10 passed; typecheck green)
