---
change_id: observability-rule-group-by-1276
status: archived
---

# Plan: per-rule notification grouping (issue #1276)

Input: change.md, research.md. Complexity: small (one package, docs).

## Phase 1: schema, merge and steps (TDD)

Files: `foundation/observability/src/node/grafana/rules-file.ts`, `src/node/grafana/apply.ts`,
`tests/grafana-rules.test.ts`, `tests/grafana-apply.test.ts`.

- `grafanaRuleSchema` gets optional `notification_settings`: a strict object with `group_by` (non-empty label names,
  no duplicates), `group_wait`, `group_interval`, `repeat_interval` (Prometheus durations). A `receiver` key is
  refused as "the file's receiver notifies every rule; a rule cannot name its own"; other keys as unknown.
- `buildRuleGroupBody`: `notification_settings: { ...rule.notification_settings, receiver: rules.receiver }`.
- Apply steps: after the group line, one line per rule with settings, e.g.
  `rule "Error burst" (errors-burst): notifications grouped by alertname, service_name; repeat every 4h`
  (the same text in a dry run and a commit). Files without settings keep the exact steps they had.
- Tests: schema accepts the four keys and refuses `receiver`, an unknown key, an empty or duplicate `group_by` and a
  bad duration; the `PUT` body carries the merged settings; the steps name the grouping; a file without settings
  keeps its body and steps (existing tests).

## Phase 2: docs

observability README (rules file section) and `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Option B of the research (strict keys): a typo must fail the file check, not silently do nothing.
- The required labels `alertname` and `grafana_folder` are not enforced: Grafana adds them itself.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: schema, merge and steps (47fffdc)
- [x] Phase 2: docs (a003aa5)
- [x] Implementation review
