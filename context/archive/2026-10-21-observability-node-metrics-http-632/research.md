---
change_id: observability-node-metrics-http-632
---

# Research: observability-node-metrics-http-632

Sources: `foundation/observability/src/node/{config,start,ignore-paths-sampler,stable-http-attributes,probe}.ts`,
`src/next/index.ts`, `tests/start.test.ts`, `tests/config.test.ts`, README, CHANGELOG, and the installed
`@opentelemetry/instrumentation-http@0.223.0` and `@opentelemetry/instrumentation-runtime-node@0.36.1`.

- Versions in step with the pinned SDK (`~0.223.0` / `^2.12.0`): `instrumentation-http@~0.223.0`,
  `sdk-metrics@^2.12.0`, `exporter-metrics-otlp-proto@~0.223.0`, `instrumentation-runtime-node@~0.36.1` (peer
  `instrumentation ^0.223.0`). The 0.300/3.x line is a new major and out of scope.
- `HttpInstrumentation` patches `http.Server.prototype.emit` when it sees `node:http` through
  require-in-the-middle. Spike: in an ESM test that imports `node:http` before registering, no server span was
  recorded; one `createRequire(import.meta.url)("node:http")` right after `registerInstrumentations` makes the hook fire
  and the server span appears. The prototype is shared, so servers created from the earlier import are covered too.
  The same goes for `node:https`.
- instrumentation-http 0.223 emits stable semantic conventions by default: server span named by method, attributes
  `http.request.method`, `url.path`, `url.query`, `http.response.status_code`; metric
  `http.server.request.duration` (seconds). No `url.path` on the metric, so cardinality stays bounded.
- `url.query` is recorded with only a fixed list of names redacted (`sig`, `Signature`, `AWSAccessKeyId`, ...). The
  package already treats the query as secret (`createOnRequestError` drops it: reset and unsubscribe tokens).
  `startIncomingSpanHook` attributes are merged last (`Object.assign(attributes, hookAttributes)`), so a hook returning
  `url.query: "REDACTED"` for requests with a query replaces it before the span starts.
- `ignoreIncomingRequestHook` skips the span and the duration metric; the existing sampler reads `url.path` and keeps
  working for Next.js server spans.
- `resolveObservabilityConfig` treats a signal as `traces | logs`; metrics fit the same resolution
  (`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, `_HEADERS`). `disabled` is returned when no signal exports.
- `resolveResourceAttributes` sets only `deployment.environment.name`; `OTEL_RESOURCE_ATTRIBUTES` is parsed first, so
  an explicit option overrides both keys.
- `start.ts` registers a `NodeTracerProvider` and a `LoggerProvider`; a `MeterProvider` with a
  `PeriodicExportingMetricReader` goes alongside, set as the global meter provider and passed to
  `registerInstrumentations`. `forceFlush`/`shutdown` and `resetObservabilityForTests` (`metrics.disable()`) cover it.
- `start.test.ts` uses a local OTLP receiver (`tests/otlp-receiver.ts`) and asserts on request paths and protobuf
  bodies; the start log line `exporting traces and logs to ...` is asserted in tests and changes.
