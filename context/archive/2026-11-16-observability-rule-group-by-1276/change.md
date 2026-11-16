---
change_id: observability-rule-group-by-1276
title: "observability: a rule keeps its notification grouping under grafana apply (issue #1276)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1276
branch: claude/project-thread-yfd2ys
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1276](https://github.com/SOFTURE/AI/issues/1276): `grafana apply` overwrites every rule's
`notification_settings` with `{ receiver }`, so a rule that needs its own grouping (one mail per service) falls back
to Grafana's default grouping and two bursts arrive as one mail. A rule in the rules file may carry
`notification_settings` without `receiver`; the apply merges it under the file's receiver.

## Context

Labels: `bug`, `pkg: observability`. Package: `foundation/observability` 0.8.3 (on npm). No version bump: the
coordinator releases the batch.

## Scope

- Rules file schema: optional per-rule `notification_settings` with `group_by`, `group_wait`, `group_interval`,
  `repeat_interval`; a `receiver` (or any other key) inside it is refused with a message that names why.
- `buildRuleGroupBody` merges the rule's settings under the file's receiver.
- The apply steps (dry run and commit) name every rule whose notifications differ from the default.
- README and CHANGELOG (`## Unreleased`).

## Constraints

- One contact point per file stays the rule: the receiver comes only from the file.
- Rules files without per-rule settings produce exactly the same `PUT` body and steps as before.

## Notes

- Framing: skipped. The issue names the cause, the code path and the fix; nothing about the problem is in doubt.

## Done

- `@softure-ai/observability`: a rule's `notification_settings` (`group_by`, `group_wait`, `group_interval`,
  `repeat_interval`) is merged under the file's receiver by `grafana apply`, and the steps name it; README and
  CHANGELOG `## Unreleased`. Next release of observability (patch: a fix with an additive field).
