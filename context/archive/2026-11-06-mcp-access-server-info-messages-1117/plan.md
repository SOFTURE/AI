# Plan: mcp-access-server-info-messages-1117

## Phases

1. Test first: `modules/mcp-access/tests/server-info-messages-1117.test.ts` builds a config whose `en` messages
   override the four `serverInfoTool` keys and `description`, passes it as `serverInfoTool.config`, and checks that
   `tools/list` shows the overridden descriptions (tool and `name` input) and that `get_server_info` answers the
   overridden `toolsHint` and `unknownToolHint`; also a `pl` locale config and the no-config default (English).
   Fails before the fix.
2. Fix: `ServerInfoToolOptions.config?: SoftureConfig`; `registerServerInfoTool` reads
   `getMcpAccessMessages(config).serverInfoTool` (else `en.serverInfoTool`) once at registration and uses it for all
   four strings and the default description. README line for the option.
3. `CHANGELOG.md`: `## Unreleased` entry (config option, the keys an app's dictionary needs), and the 0.7.0 entry's
   "Migrate" corrected to name the four keys. Gates; pull request closing #1117.

## Acceptance

- The new test passes, the existing server info tests stay green (evidence: vitest run).
- typecheck, lint, language gate green.

## Decisions (auto)

- `config` rather than `messages`: the same option the operation tools take, and it picks the locale and the app's
  overrides the same way as every other localized part of the module.
- Keep the four keys required in the type: they are now used, and the module merges partial overrides over `en`,
  so only a complete typed dictionary needs them; the changelog says so.

## Progress

- [x] p1 failing test: 3 of 6 cases failed before the fix (the app's texts were ignored)
- [x] p2 fix: `npx vitest run modules/mcp-access` 36 files, 524 tests passed (with the new file)
- [x] p3 changelog (`## Unreleased`, 0.7.0 "Migrate" corrected), README; typecheck, ESLint on the changed files,
  language gate green
