---
change_id: agent-ready-webmcp-script-tools-437
title: "agent-ready: searchSite/findTerm usable from the inline WebMCP boot script, with overridable answers (issue #437)"
status: archived
roadmap_item: null
issue: 437
branch: claude/project-thread-sekqk7
created: 2026-10-13
updated: 2026-10-13
archived_at: 2026-10-13
---

## Intent

Close [issue #437](https://github.com/SOFTURE/AI/issues/437) (follow-up to #415). `createSearchSiteTool()` and
`createFindTermTool()` return tools with a JavaScript `execute`, so only a client component can register them. A page
that registers its public tools through `buildWebMcpBootScript` in `<head>` cannot use them. Their answer lines and
input descriptions are fixed English text.

Outcome:
1. `searchSiteScriptTool(options)` and `findTermScriptTool(options)` return `WebMcpScriptTool`s (definition plus
   self-contained `execute` source) that `buildWebMcpBootScript({ tools })` registers, behaving like the JS tools.
2. Both forms take `messages` (partial overrides of English defaults: answer lines, input descriptions) and `locale`
   (plural rules), so an app can supply its own translation.

## Context

agent-ready is at 0.1.4 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Product rule: the package ships English only; no translated dictionaries, only the override hook.

## Constraints

- The `/webmcp` entry imports nothing (architecture test), so everything stays in `src/webmcp/index.ts`.
- The script form cannot import or close the `<script>` tag: configuration goes in as script-safe JSON.
- Existing JS tool behaviour and English answers stay byte-identical.

## Process notes

- Framing: skipped. The issue names the two asks and a proposed API.

## Decisions (auto)

- API: `searchSiteScriptTool` / `findTermScriptTool` (the issue's first proposal); `buildWebMcpBootScript` keeps its shape.
- Messages are string templates with `{placeholders}`; count-dependent lines take plural forms keyed by
  `Intl.PluralRules` categories (`other` required), selected with `locale` (default `en`). Templates are plain data,
  so the boot script can carry them.
- `description` stays a top-level option; `messages` covers the answer lines and the input field descriptions.
- Argument errors keep the `<name>: ` prefix; their text is a message too.
- No Polish (or other) dictionary ships.
