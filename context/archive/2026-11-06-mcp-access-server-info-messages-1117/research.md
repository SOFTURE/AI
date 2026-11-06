# Research: mcp-access-server-info-messages-1117

## Findings

- `modules/mcp-access/src/server/server-info.ts` imports `en` and reads `en.serverInfoTool.*` for the description,
  the `name` input description, `toolsHint` and `unknownToolHint`. No option carries the app's messages.
- `McpAccessMessages` is `typeof en`, so every key is required in an app's typed dictionary. The 0.7.0 changelog
  entry ends "Migrate: nothing" although it added four keys there (confirmed in `fcae0c2`).
- The other localized registrations take the app's config: the operation tools (`registerOperationStatusTool`,
  `registerOperationCancelTool`) accept `config?: SoftureConfig` and read `getMcpAccessMessages(config)` at
  registration, falling back to the English dictionary (`src/jobs/operations.ts`, `getRegistrationMessages`).
  `withStrictToolInput` takes `messages` directly.
- `createMcpServerFactory` spreads `serverInfoTool` options into `registerServerInfoTool`, so an option added to
  `ServerInfoToolOptions` reaches the factory path with no extra wiring.
- The module factory merges an app's partial `messages` over `en` per locale, so an app that overrides only some
  keys still gets English for the rest; only an app typing a complete dictionary against `McpAccessMessages` needs
  the four new keys.
