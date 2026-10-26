---
change_id: observability-short-lived-814
title: "observability: a short-lived mode for one-shot processes (issue #814)"
status: in_progress
roadmap_item: null
issue: 814
branch: claude/project-thread-4gobi3
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #814](https://github.com/SOFTURE/AI/issues/814): a one-shot process (a migration, an ops script, a cron
run) gets a new `service.instance.id` on every run and exports its metrics once at shutdown, so every run adds about
110 active series nobody reads. Give `startObservability` a short-lived mode: metrics off, logs and traces unchanged,
the export flushed before the process exits, and a note on the cost of metrics in one-shot processes in the README.

## Context

Issue labels: `enhancement`. Measured in an adopting app on Grafana Cloud with observability 0.4.0: three script
services produced about 1,300 series a week, five times the app's steady 254. #810 (the exporter counting its own
requests) changes the same package in another thread; this change merges after it. No version bump in this change:
the coordinator releases observability in the next combined release.

## Constraints

- Long-running processes behave exactly as before (the default stays).
- Telemetry never keeps a process alive or changes its exit code.

## Notes

- Framing: skipped. The issue names the problem, the measurement and the proposal.
