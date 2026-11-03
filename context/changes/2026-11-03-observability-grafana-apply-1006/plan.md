---
change_id: observability-grafana-apply-1006
status: in_progress
---

# Plan: apply Grafana rules and dashboards as code (issue #1006)

## Goal

One command and one function apply an app's Grafana alert rules and dashboard; a schema and builders let the app's
tests hold the file to its service names.

## Approach

Research option 1. `fetch` is injectable so tests run against a fake Grafana in-process (a local HTTP server).

## Phase 1: schema, builders, apply function (TDD)

Files: `src/node/grafana/rules-file.ts`, `src/node/grafana/rule-builders.ts`, `src/node/grafana/apply.ts`,
`src/node/index.ts`, `tests/grafana-*.test.ts`, `package.json` (zod).

- `grafanaRulesFileSchema` (zod): `folder { uid, title }`, `receiver`, `group`, `intervalSeconds` (default 60),
  `rules[]` (`uid`, `title`, `condition`, `data[]` required; other Grafana fields passed through). Unique rule uids.
  `parseGrafanaRulesFile(unknown)` returns a result.
- Builders: `buildServiceSilentRule({ service, datasourceUid, window?, for? })` (`absent_over_time(target_info{…})`,
  no data = OK) and `buildLogProblemsRule({ service, datasourceUid, severities?, window?, for? })` (Loki
  `count_over_time` on `severity_text`). `service = { namespace, name, environment }`. The worker rule is the
  silent rule with the worker's name.
- `applyGrafanaResources({ url, token, rules, dashboard?, commit, paused, fetch? })`: reads folder, contact point,
  rule group, dashboard; returns the planned steps; refuses a missing contact point (dry run reports it too); with
  `commit` creates the folder, `PUT`s the group with `notification_settings.receiver` and `isPaused`, and upserts the
  dashboard into the folder. Errors name the call and the HTTP status, never the token.

## Phase 2: CLI, README, CHANGELOG

Files: `src/cli/run.ts`, `tests/cli.test.ts` or `tests/grafana-cli.test.ts`, `README.md`, `CHANGELOG.md`.

- `grafana apply --rules <file> [--dashboard <file>] [--commit] [--paused]`; missing `GRAFANA_URL`/`GRAFANA_TOKEN` or
  an invalid file exits 1 with the reason; usage errors exit 2.
- README section "Grafana alert rules and dashboards"; CHANGELOG `Unreleased` with the migration for an app that has
  its own apply script.

## Risks and rollback

- A `PUT` replaces the group: a rule created in the UI inside that group is deleted. Documented; the dry run lists
  rules that will be removed. Rollback: revert the PR; nothing persists outside the app's Grafana.

## Decisions (auto)

- Dry run reads Grafana (GET only) so it can show what changes; it still needs the token.
- `intervalSeconds` as a number (what the API takes) rather than a duration string.
- The dashboard goes into the rules file's folder; no separate folder option.
- zod `^4.6.5` as a runtime dependency (external JSON is narrowed with a schema at the boundary).

## Progress

- [ ] Phase 1: schema, builders, apply function
- [ ] Phase 2: CLI, README, CHANGELOG
