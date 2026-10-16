---
change_id: observability-probe-547
title: "observability: a probe that proves the trace and log export is accepted (issue #547)"
status: archived
roadmap_item: null
issue: 547
branch: claude/project-thread-qxjrkd
created: 2026-10-16
updated: 2026-10-16
archived_at: 2026-10-16
---

## Intent

Close [issue #547](https://github.com/SOFTURE/AI/issues/547): an app that logs only `warn` and `error` cannot tell
whether its log export works (endpoint path, auth, scope) until the first production error. The start-up line only
says export was configured.

## Context

Same package and pull request as #545 and #546. No version bump; CHANGELOG `## Unreleased`.

## Constraints

- The probe never touches the process's global providers and never prints export headers.
- It reads the same options and `OTEL_*` variables as `startObservability`.

## Notes

- Framing: skipped. The issue names the preferred fix (option 1).

## Decisions (auto)

- Option 1 of the issue: `probeObservability(options)` in `/node` returns a result value per signal, and the
  `softure-observability ping` command runs it from the `OTEL_*` variables (`--service-name` overrides
  `service.name`). Option 2 (a start-up record) is not built.
- One span `softure.probe` and one log record `softure.probe`, each with `softure.probe=true`, sent through the
  package's own OTLP exporters on private providers.
- Exit codes: `0` every configured signal accepted; `1` a signal refused, or export not configured at all
  (nothing to verify is a failed check); `2` a usage error. A signal without an endpoint is reported as such and
  does not fail the check when the other one is accepted.
