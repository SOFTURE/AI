---
change_id: quality-review-workflow-1212
---

# Research: quality review workflow (issue #1212)

## Agent SDK (`@anthropic-ai/claude-agent-sdk` 0.3.319)

- `query({ prompt, options })` streams messages; the last is a `result` with `subtype` `success` or
  `error_max_budget_usd` / `error_max_turns` / `error_during_execution`, `total_cost_usd`, `modelUsage` (per model:
  `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `costUSD`).
- Options that make it read-only: `tools: ["Read","Glob","Grep"]` (the only built-in tools in context),
  `allowedTools` (same list, no prompts), `disallowedTools` (belt and braces), `permissionMode: "dontAsk"` (anything
  not allowed is denied), `canUseTool` (a third guard), `settingSources: []` (no `.claude/` settings or hooks of the
  reviewed repository), `mcpServers: {}` + `strictMcpConfig: true`, `maxBudgetUsd`, `maxTurns`, `model`, `cwd`.
- The SDK installs a native Claude Code binary per platform as an optional dependency: 340 MB for linux-x64. As a
  dependency of a workspace package it would land in every `npm ci` of this monorepo. It also has non-optional peers
  (`@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod`).
- Models (claude-api reference, 2026-10): Opus 5.5 `claude-opus-5-5` 4/20 USD per MTok, Sonnet 5.5 2/10, Haiku 5.5
  0.10/0.50.

## Repository patterns

- Reusable workflows (`deploy-*.yml`): one `runs-on` JSON input checked by the shared first step, the
  "Empty the workspace" step after it in every job that checks out, a timeout per job (tests/repo/workflow-runners,
  ci-workflows). The CLI comes from npm through `npx --package=@softure-ai/deploy@$VERSION`, its version an exact
  input whose default equals the package version (deploy-workflows test).
- Packages: copy `templates/package/`; `tools/config` is a CLI package without `module.json`. Release tags count
  (`tests/repo/release-tags.test.ts`, 35 public packages) and the README layout list grow by one.
- First publication of a new package goes through `NPM_TOKEN` in release.yml, then the owner sets the trusted
  publisher.
