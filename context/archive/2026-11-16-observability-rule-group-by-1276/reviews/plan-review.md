---
change_id: observability-rule-group-by-1276
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (387cb40).

- Issue ask (rule carries `notification_settings` without receiver, merged under the file's receiver): Phase 1.
- Issue ask (schema refuses a rule-level receiver): Phase 1, with its own message.
- Issue ask (dry run prints the grouping when it differs from the default): Phase 1 steps line.
- Compatibility: rules files without settings keep the same body and steps; the existing exact-match tests in
  `grafana-apply.test.ts` stay unchanged and prove it.
- Risk: a strict object refuses `mute_time_intervals`, which Grafana accepts. Acceptable: no app asked for it, the
  error names the key, and adding it later is additive.
- Risk: duration format. The regex follows Prometheus durations (units `ms s m h d w y`, combinable); Grafana parses
  the same format.

Verdict: approved, no changes.
