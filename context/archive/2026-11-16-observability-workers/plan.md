# Plan: observability-workers (RP-6)

## Approach

Add `./workers` with `withObservability(handler, options)`. It runs the handler inside an `AsyncLocalStorage` scope
that holds the request's trace and span ids. A global `LoggerProvider` collects `createLogger` records into that
scope. The span and records are posted as OTLP/HTTP JSON under `ctx.waitUntil`. The "silent" rule gains
`signal: "logs"`. observability 0.8.6.

## Decisions (auto)

- No OpenTelemetry SDK on Workers: a JSON encoder of about 100 lines, no new dependency.
- One server span per request named after the method (semantic conventions without a route); `error.type` on a
  throw or a 5xx; an incoming `traceparent` continues the trace.
- A failed export is reported on the console with the signal and the error's name only, never the URL or the
  headers, and never reaches the response.
- Settings are resolved per handler and per bindings object, from `process.env` under the handler's string bindings.
- The liveness rule for Workers watches logs, with its own uid, so a service can have both rules.

## Phases

### Phase 1: the Workers entry (TDD)
- `src/workers/otlp-json.ts`, `src/workers/handler.ts`, `src/workers/index.ts`; the `./workers` export.
- Done when tests show: nothing is sent without an endpoint; records and a span share one trace; `traceparent` is
  continued; a throw is recorded and thrown on; a 5xx is an error and a 4xx is not; an ignored path keeps its records;
  a failed export keeps the response; a record written outside a request is sent with the next request; the encoding
  writes integers, doubles, arrays and nanoseconds. Running the handler outside the scope turns them red. A workerd
  smoke run sends both signals.

### Phase 2: liveness rule, declare, document
- `buildServiceSilentRule({ signal: "logs" })`; `softure.workers` `.` and `./workers`; README, CHANGELOG, docs/07,
  roadmap.
- Done when the guard passes and an `import "node:fs"` in `workers/handler.ts` turns it red.

## Progress

- [x] Phase 1: 10 tests in `tests/workers.test.ts`; running the handler outside `requestStorage.run` turns 3 red; the workerd smoke run (Miniflare 4.20260730) delivered one log record and one span with the incoming trace id, parent id and the bindings' `Authorization` header
- [x] Phase 2: the logs-liveness test passes; the guard passes on `.` and `./workers`, and `node:fs` in `workers/handler.ts` turns it red; README "Cloudflare Workers", CHANGELOG 0.8.6, docs/07 row, roadmap
