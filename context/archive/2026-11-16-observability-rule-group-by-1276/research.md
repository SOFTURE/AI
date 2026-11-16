---
change_id: observability-rule-group-by-1276
---

# Research: per-rule notification grouping (issue #1276)

## Current code

- `foundation/observability/src/node/grafana/rules-file.ts`: `grafanaRuleSchema` is a loose object (`uid`, `title`,
  `condition`, `data` checked, the rest passed through). A rule's `notification_settings` passes the schema but is
  then dropped.
- `foundation/observability/src/node/grafana/apply.ts` `buildRuleGroupBody`: spreads the rule, then sets
  `notification_settings: { receiver: rules.receiver }`, replacing whatever the rule carried.
- `describeGroupChange` prints one step for the group (`... notifying "<receiver>"`); nothing about grouping.
- Tests: `tests/grafana-apply.test.ts` asserts the exact `PUT` body and steps; `tests/grafana-rules.test.ts` the
  schema problems.

## Grafana

Grafana's provisioning API takes `notification_settings` (simplified routing) with `receiver`, `group_by`,
`group_wait`, `group_interval`, `repeat_interval`, `mute_time_intervals` (and newer `active_time_intervals`).
`pkg/services/ngalert/models/notifications.go` (v11.0.0, v12.0.0, main):

- validation refuses an empty receiver, a negative `group_wait`, a non-positive `group_interval` or
  `repeat_interval`, and a duplicate value in `group_by`;
- `NormalizedGroupBy` puts the required `grafana_folder` and `alertname` first and the custom labels after them, or
  returns only `...` when the list holds it. An app does not have to list the required labels itself.
- An empty `group_by` inherits the default (`alertname`, `grafana_folder`).

Durations are Prometheus durations (`30s`, `5m`, `4h`, `1h30m`).

## Options

- A. Loose pass-through: merge whatever the rule carries, override `receiver`. Simplest, but a typo
  (`groupBy`) silently does nothing, and a rule-level `receiver` is quietly ignored.
- B. Strict schema for the four keys the issue needs, refusing `receiver` with its own message and any other key.
  A typo fails the file check; time intervals can be added later when an app needs them.

Recommendation: B.
