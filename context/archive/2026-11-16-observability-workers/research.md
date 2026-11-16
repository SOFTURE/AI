# Research: observability-workers (RP-6)

## Today

- `.` (the logger) writes a console line and emits an OpenTelemetry log record through `logs.getLogger(name).emit`
  from `@opentelemetry/api`. The api package is plain JavaScript, and the logger reads only `process.env`, which
  workerd provides under `nodejs_compat`.
- `./node` starts the Node SDK (`node:module`, `node:http` patching, `/proc` metrics). It is Node-only and stays so.
- `resolveObservabilityConfig(options, env)` in `node/config.ts` is pure: no Node import. The Workers entry reuses it,
  so the settings and the resource attributes (`service.name`, `service.namespace`, `deployment.environment*`) are
  the same on both runtimes.
- The Grafana "silent" rule watches `target_info`, which only a metric export sends.

## In workerd

- `AsyncLocalStorage` (`node:async_hooks`) is provided, so a record can find its request's span.
- Measured with Miniflare 4.20260730 (`nodejs_compat`): a worker bundled from the new entry sent one log record and
  one server span to a local OTLP receiver. Both carried the incoming `traceparent`'s trace id, and the span carried
  its parent id. The `Authorization` header came from `OTEL_EXPORTER_OTLP_HEADERS` in the bindings.

## Decisions to make

- The exporter: the SDK's OTLP exporters rely on Node transports, so the entry writes OTLP/HTTP JSON itself. The
  format is small and documented.
- Liveness without metrics: the Loki `absent_over_time` on the service's log stream.
