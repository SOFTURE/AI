---
change_id: agent-ready-webmcp-script-tools-437
status: in_progress
---

# Plan: WebMCP ready-made tools as boot-script tools, with overridable answers (issue #437)

Input: change.md, research.md. Complexity: medium (one source file, tests, docs).

## Phase 1: messages and locale for the JS tools (TDD)

Files: `modules/agent-ready/src/webmcp/index.ts`, `modules/agent-ready/tests/webmcp-search.test.ts`.

1. Tests first: overriding a line (`noMatch`), plural forms with a non-English `locale` (categories `one`, `few`,
   `other` picked by `Intl.PluralRules`), input descriptions from `messages`, defaults unchanged.
2. Export `WebMcpPluralText`, `SearchSiteMessages`, `FindTermMessages`, `SEARCH_SITE_MESSAGES`,
   `FIND_TERM_MESSAGES`; options `messages?: Partial<…>`, `locale?: string`; input schemas built from the messages.

## Phase 2: script forms (TDD)

Files: same, plus `tests/webmcp.test.ts` if needed.

1. Tests first: the behaviour suites of both tools run against two factories, the JS tool and the tool the boot
   script registers from `searchSiteScriptTool` / `findTermScriptTool` (global `fetch` stubbed); the script form's
   definition (name, description, input schema) equals the JS tool's; a message holding `</script>` still builds.
2. Implement both functions: options as script-safe JSON, helpers as a shared source block, an IIFE source returning
   `async (args, h) => result`.

## Phase 3: docs

README WebMCP section (script form, `messages`, `locale`, English-only note), CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: messages and locale for the JS tools
- [ ] Phase 2: script forms
- [ ] Phase 3: docs
