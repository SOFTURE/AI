---
change_id: observability-node-metrics-http-632
status: archived
---

# Plan: metrics, inbound HTTP spans and both environment keys (issue #632)

Input: change.md, research.md. Complexity: medium (config, start, Next.js defaults, tests, docs, four dependencies).

## Phase 1: config (TDD)

Files: `src/node/config.ts`, `tests/config.test.ts`.

1. Tests first: metrics URL from the base endpoint, `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` and `_HEADERS`;
   `metrics.enabled: false` and `OTEL_METRICS_EXPORTER=none` give `metrics: null`; `environment` sets both
   `deployment.environment` and `deployment.environment.name`.
2. Implement: `Signal` gains `metrics`; resolved config gains `metrics: SignalExport | null`; options gain `metrics`
   and `instrumentations.http` / `.runtime`; both environment keys.

## Phase 2: start (TDD)

Files: `src/node/start.ts`, `src/node/ignore-paths-sampler.ts`, `src/next/index.ts`, `tests/start.test.ts`,
`tests/next.test.ts`.

1. Tests first against the local receiver: an inbound request to a server created from a `node:http` import made
   before start produces a server span; its query is `REDACTED`; an ignored path produces none; metrics reach
   `/v1/metrics` with `http.server.request.duration` and a runtime metric; `metrics.enabled: false` sends none;
   `instrumentations.http: false` records no server span; the Next.js adapter passes `http: false`.
2. Implement: `MeterProvider` + `PeriodicExportingMetricReader` + `OTLPMetricExporter`; `HttpInstrumentation` with
   `ignoreIncomingRequestHook` (shared path matcher exported from the sampler module) and a query-redacting
   `startIncomingSpanHook`; `createRequire` of `node:http`/`node:https` after registering; `RuntimeNodeInstrumentation`;
   flush and shutdown of the meter provider; the start line names metrics.

## Phase 3: docs

README (signals, options, cardinality, http instrumentation load order), CHANGELOG `## Unreleased`; the bump to
0.4.0 is the release pull request (`npm run release:version`).

## Progress

- [x] Phase 1: config (TDD) (7 tests written first and failing; metrics signal, off switches, both environment keys)
- [x] Phase 2: start (TDD) (10 tests written first, 7 failing without the change; process-wide http instrumentation,
  shutdown order fixed after a manual ESM run; 107 observability tests pass)
- [x] Phase 3: docs (README configuration, Incoming requests, Metrics; CHANGELOG `## Unreleased`; the version bump
  follows in the release pull request)
