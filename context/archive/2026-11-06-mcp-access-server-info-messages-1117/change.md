---
change_id: mcp-access-server-info-messages-1117
title: "fix(mcp-access): get_server_info reads the app's messages; migration note for the new keys (#1117)"
status: archived
roadmap_item: null
issue: 1117
branch: claude/project-thread-c4ostg
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close #1117. 0.7.0 added four required keys to the `serverInfoTool` message group (`descriptionWithTools`,
`nameInputDescription`, `toolsHint`, `unknownToolHint`), but its changelog said "Migrate: nothing", so an app with its
own typed dictionary fails to type-check after the bump. And `registerServerInfoTool` reads every string from the
English dictionary, so an app's translation of them is never used. The outcome: the tool takes its strings from the
app's configured messages, and the changelog names the new keys.

## Context

Coordinator brief (2026-11-06 02:40 UTC): fix per the SOFTURE workflow, `## Unreleased` changelog entry and
migration note, report READY; it joins the current combined release if it lands in time.

## Constraints

- English only. No change to the tool's answer or schema for an app that passes no config (same English strings, so
  the measured tool list version does not change).

## Notes

- Framing: skipped. The issue names the file, the keys and the expected behaviour.

## Done

- `registerServerInfoTool` (and `serverInfoTool` on `createMcpServerFactory`) takes `config`; the description, the
  `name` input description and both hints come from the app's messages in its locale, English without it
  (`modules/mcp-access/tests/server-info-messages-1117.test.ts`).
- The 0.7.0 changelog entry names the four new `serverInfoTool` keys under "Migrate"; `@softure-ai/mcp-access`
  carries a `## Unreleased` entry and rides the next combined release.
