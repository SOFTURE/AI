---
change_id: mcp-access-mcp-apps
title: "mcp-access: MCP Apps helpers (interactive views next to a tool's answer)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: null
branch: claude/mcp-apps-widgets
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Let an app's MCP server open an interactive HTML view next to a tool's answer in hosts that support MCP Apps (the
`io.modelcontextprotocol/ui` extension, protocol 2026-01-26: Claude, ChatGPT, VS Code). The server half is the tool
`_meta` (`ui.resourceUri`) and a `ui://` resource with the MIME type `text/html;profile=mcp-app`; the page half is a
small postMessage JSON-RPC bridge (initialize, tool input and result, tools/call, size, theme).

## Context

An adopting app wants dashboards in its remote MCP connector. The owner's standing order: a generic gap is fixed in the
package, released and bumped in the app, without an issue. `@modelcontextprotocol/ext-apps` exists, but its `App`
needs a bundler in the page; a dependency-free inline bridge keeps every page one self-contained HTML string.

## Scope

- `/server`: `appToolMeta`, `registerAppResource`, `renderAppDocument`, `MCP_APP_BRIDGE_SCRIPT` and constants.
- README section, CHANGELOG 0.7.6, version 0.7.6 (additive, so every `^0.7` range takes it).

## Constraints

- No dependency added; nothing changes for a tool without `appToolMeta`.
- The bridge accepts messages only from `window.parent`.

## Notes

- Research: skipped. The protocol is read from `@modelcontextprotocol/ext-apps` 2.0.4 (`constants`, `spec.types`); the
  SDK's `registerResource` and `registerTool` already take `_meta`.
- Framing: skipped. A missing building block with one obvious shape.

## Done

- `@softure-ai/mcp-access` 0.7.6: MCP Apps helpers in `/server` (README "Interactive views: MCP Apps").
