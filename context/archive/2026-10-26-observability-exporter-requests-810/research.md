---
change_id: observability-exporter-requests-810
---

# Research: OTLP export requests in http.client.request.duration

## Where the requests come from

- `foundation/observability/src/node/start.ts` builds `OTLPTraceExporter`, `OTLPLogExporter` and `OTLPMetricExporter`
  (`*-otlp-proto`) with the URLs from `resolveObservabilityConfig` (`config.traces.url` etc., always absolute http(s)
  URLs with the signal path already applied).
- `@opentelemetry/otlp-exporter-base` `sendWithHttp` calls `http.request(new URL(url), { method: "POST", headers,
  agent }, cb)` (or `https.request`), at export time, through the module object, so the patched function runs.
- The exporter suppresses tracing for the export context, so no client span appears; the instrumentation still
  records the client duration histogram (`_recordClientDuration`) for every non-ignored request.

## The hook

- `@opentelemetry/instrumentation-http` 0.223.0, `_outgoingRequestFunction`: `getRequestInfo(options, extraOptions)`
  turns a `URL` argument into `{ protocol, hostname (IPv6 brackets stripped), path: pathname + search, port?: number,
  auth? }` merged with the extra options, then calls `ignoreOutgoingRequestHook(optionsParsed)`. `true` means the
  original request runs unpatched: no span, no metric, no context injection.
- `port` is absent when the URL has the scheme's default port; `optionsParsed.port` may be a number or a string for a
  plain options object.
- `startHttpInstrumentation` sets only `ignoreIncomingRequestHook` and `startIncomingSpanHook` today.

## Approach

Build a matcher from the resolved export URLs: normalise each to `protocol//hostname:port/path?query` (default port
filled in, brackets stripped) and compare the hook's options the same way. Exact path match keeps the program's own
calls to other paths on the same host (e.g. a self-hosted collector's health endpoint) measured.

## Tests

`foundation/observability/tests/start.test.ts` runs a local OTLP receiver (`otlp-receiver.ts`) and reads the metric
bodies as bytes (`bodyOf("/otlp/v1/metrics")`). A program call through `node:http` to the app server gives the
positive control (`http.client.request.duration` present, `server.address` 127.0.0.1); the export requests go to
`localhost`, so the receiver's address must not appear in the client histogram.
