---
change_id: observability-workers
title: "observability: a Workers entry with OTLP over fetch"
status: archived
roadmap_item: RP-6
issue: null
branch: claude/project-thread-dufdk1
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Logs and traces of an app on Cloudflare reach the same Grafana as on a VPS, under the same service names, without the Node OpenTelemetry SDK.

## Context

`foundation/observability/src/node/` starts the Node SDK (`start.ts` uses `node:module` `createRequire` and patches `node:http`), reads memory metrics from `/proc`, and the logger sets error labels. Settings come from `OTEL_EXPORTER_OTLP_ENDPOINT` and `_HEADERS`.

## Constraints

- Nothing leaves without an endpoint (tests, dev).
- The logger API is the same on both runtimes, so module code does not branch.
- No change to the Node entry.

## Notes

- Item block: [`roadmap.md` → RP-6](../../foundation/roadmap.md).
