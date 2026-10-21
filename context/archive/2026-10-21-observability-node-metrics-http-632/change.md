---
change_id: observability-node-metrics-http-632
title: "observability: OTLP metrics, inbound HTTP spans and both deployment environment keys in startObservability (issue #632)"
status: archived
roadmap_item: null
issue: 632
branch: claude/project-thread-aenczl
created: 2026-10-21
updated: 2026-10-21
archived_at: 2026-10-21
---

## Intent

Close [issue #632](https://github.com/SOFTURE/AI/issues/632). A Node/Express service on `startObservability`
(`/node`) is a blind spot next to .NET services on `SOFTURE.Common.Observability`: it exports no metrics, its inbound
requests get no server spans (so its logs carry no trace id for them), and its environment lands only under
`deployment.environment.name`, so dashboards filtering on `deployment_environment` drop it.

## Context

Labels: none. observability 0.3.0 is the latest on npm and on master. Everything lives in
`foundation/observability/src/node/` (`config.ts`, `start.ts`); the Next.js adapter (`src/next/index.ts`) goes through
`startObservability`. The coordinator releases right after the merge (dispatch `auto-release.yml`).

## Acceptance

- With an endpoint, `startObservability` also exports metrics over OTLP/HTTP protobuf to `<endpoint>/v1/metrics`
  (`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` and `_HEADERS` honoured like the other signals): HTTP server request
  duration and Node.js runtime metrics, on by default.
- `metrics: { enabled: false }` or `OTEL_METRICS_EXPORTER=none` turns metric export off; traces and logs stay.
- Inbound HTTP requests get server spans (`@opentelemetry/instrumentation-http`), also when `node:http` was loaded
  before `startObservability`. `traces.ignorePaths` drops them (span and metric); the query string is never recorded
  in clear. `instrumentations.http: false` turns it off.
- `options.environment` is written as both `deployment.environment` and `deployment.environment.name`.
- The Next.js adapter does not get a second server span per request (Next.js spans requests itself).
- README documents metrics, the new options and series cardinality; CHANGELOG has the release notes.

## Notes

- Framing: skipped. The issue states the three gaps, the expected behaviour and a workaround.

## Decisions (auto)

- One change for the three points: they share `start.ts`, `config.ts`, the README and one release.
- HTTP server spans come from `@opentelemetry/instrumentation-http` only; Express route instrumentation is left out
  (the issue calls it optional, and it adds a dependency on the app's Express version). Span names stay `GET`/`POST`
  without a route.
- Runtime metrics come from `@opentelemetry/instrumentation-runtime-node` (event loop, GC, heap): the Node analogue of
  the .NET runtime metrics, with a bounded set of series.
- Metrics default on in `startObservability`, as the issue asks. The Next.js adapter defaults `instrumentations.http`
  to `false` (Next.js spans requests itself) and keeps runtime metrics on.
- The new switches follow the existing shape: `instrumentations: { fetch, http, runtime }` for what is collected,
  `metrics: { enabled, exportIntervalMs }` for whether and how often metrics leave the process.
- `probeObservability` / `softure-observability ping` stay traces and logs only; a probe metric would create a series
  of its own in the backend. Not needed for the issue.
- Release as 0.4.0 (minor): new default exports and a new resource attribute.
