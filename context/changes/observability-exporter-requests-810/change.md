---
change_id: observability-exporter-requests-810
title: "observability: the OTLP exporter's own requests are not measured (issue #810)"
status: planned
roadmap_item: null
issue: 810
branch: claude/project-thread-1ab3ch
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #810](https://github.com/SOFTURE/AI/issues/810): with `instrumentations.http` on, the `node:http`
instrumentation records `http.client.request.duration` for the OTLP exporter's own `POST`s to the trace, log and metric
endpoints. Tracing is suppressed for them, the metric is not. In an adopting app that was about a quarter of a job
worker's active series, measuring only the export. After the change, requests to the resolved export endpoints are
skipped by the instrumentation; the histogram shows only the program's own outgoing calls.

## Context

- Found adopting `@softure-ai/observability` 0.4.0 in an adopting app (Grafana Cloud, 2026-10-26).
- Workaround today: `instrumentations: { http: false }`, impossible for a process that serves HTTP or calls out
  through `node:http`.

## Constraints

- The program's own outgoing `node:http` calls, including other paths on the same host, are still measured and traced.
- No version bump in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the cause and the fix (`ignoreOutgoingRequestHook`).
