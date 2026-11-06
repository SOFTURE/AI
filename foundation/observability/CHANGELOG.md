# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/observability`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.8.1

- OpenTelemetry JS 3.1: the SDK packages on ~3.1.0, the exporters and `instrumentation-http` on ~0.301.0,
  `instrumentation-runtime-node` ~0.38.0, `instrumentation-undici` ~0.35.0.
- `forwarded-parse` is no longer a dependency of its own: `instrumentation-http` 0.301 imports it statically (0.300
  hid it behind a bundler helper), so Next.js output file tracing keeps it in a standalone build without the extra
  `require` in `startObservability`, and the version is the one `instrumentation-http` pins (2.2.0).

## 0.8.0

- OpenTelemetry JS 3.0: `@opentelemetry/api` ^1.10.0, the SDK packages on ~3.0.0 (`sdk-trace` replaces
  `sdk-trace-node`, plus `context-async-hooks`), the exporters and instrumentations on ~0.300.0;
  `@opentelemetry/api-logs` is no longer a dependency (the logs API is part of `@opentelemetry/api` 1.10).
  `startObservability` registers the same context manager (AsyncLocalStorage), W3C trace context and baggage
  propagation and global providers as before.
- New dependency `forwarded-parse` (2.1.2, the version `instrumentation-http` pins): instrumentation-http 0.300 loads
  it through a bundler helper that Next.js output file tracing cannot follow, so a `output: "standalone"` build left
  it out and the app failed at start ("Cannot find module 'forwarded-parse'"). `startObservability` now requires it
  where the tracer sees it.
- Migration: the app's own `@opentelemetry/api` must be 1.10 or newer. Next.js bundles the instrumentation hook
  against the copy at the app's root, so a lockfile that still hoists 1.9 fails the build with "Export logs doesn't
  exist in target module"; refresh the lockfile (or add `@opentelemetry/api@^1.10.0` to the app). An app that imports
  `@opentelemetry/api-logs` or `@opentelemetry/sdk-trace-node` next to this package moves to `@opentelemetry/api` and
  `@opentelemetry/sdk-trace` 3.

## 0.7.0

- `createOnRequestError` logs a client's aborted request (React's `The destination stream closed early.`,
  `ERR_STREAM_PREMATURE_CLOSE`, Next.js's `ResponseAborted`, Node's `aborted` with `ECONNRESET`) as `info` "request
  aborted by the client" with `outcome: "client_aborted"` and no exception, instead of `error` "request failed"
  (#1071). Every other error is logged as before. A second argument `{ isClientAbort }` replaces the check; the
  default is exported as `isClientAbortError`.
- Migration: an app that wraps the logger to downgrade these aborts can drop the wrapper. An alert or query on
  `request failed` no longer sees them; query `outcome="client_aborted"` to count them.

## 0.6.0

- `softure-observability grafana apply --rules <file> [--dashboard <file>] [--commit] [--paused]` and
  `applyGrafanaResources()` in `/node` apply Grafana alert rules and a dashboard kept as code in the app (#1006),
  with `GRAFANA_URL` and `GRAFANA_TOKEN` from the environment. Dry run by default; `--commit` creates the folder when
  missing, refuses when the contact point does not exist (it is never created), replaces the rule group in one `PUT`
  with `X-Disable-Provenance` and `notification_settings.receiver` on every rule, and upserts the dashboard.
  `--paused` applies every rule paused.
- `grafanaRulesFileSchema` / `parseGrafanaRulesFile` (and `grafanaDashboardSchema` / `parseGrafanaDashboard`) for the
  app's tests; builders `buildServiceSilentRule` and `buildLogProblemsRule` for the common rules, keyed on
  `service_namespace`, `service_name` and `deployment_environment`.
- New dependency: `zod`.
- Migration: an app with its own apply script moves its rules into the file shape of the README (folder, receiver,
  group, intervalSeconds, rules), drops `folderUID`, `ruleGroup` and `notification_settings` from each rule (the
  command sets them), runs the dry run, compares, then replaces its script with `grafana apply --commit`. Rules can
  keep their uids; a rule replaced by a builder gets the builder's uid, so Grafana deletes the old rule and creates
  the new one (its alert state starts over).

## 0.5.0

- `errorDetails: "label"` now tells errors apart without logging any message (#932). The label names the cause chain
  with safe codes, which may be Node system and undici codes as well as SQLSTATEs (`Error cause=Error
  code=ETIMEDOUT`), and `exception.stacktrace` holds the first two frames of the app without the message line (it
  was left out before). An `Error("Failed query: … params: …")` logs where it was thrown and nothing of its text.
- `createOnRequestError` adds `next.digest` when Next's digest is a hash (`<hash>` or `<hash>@E<n>`), the one the
  error page shows, and `next.render_source`. A `NEXT_*` digest is never logged.
- The README says why a record of Next.js's RSC payload path carries no trace id: Next.js 16 reports the error
  outside the request's context and passes no span.
- `@softure-ai/core` is no longer a dependency.
- Migration: none needed. A log query on the old label of an error whose direct cause has a SQLSTATE
  (`Error code=23505`) now matches `Error cause=DatabaseError code=23505`; query `code=23505` to match both. A
  console in label mode now prints the frames on the lines after the error line.

## 0.4.1

- `lifetime: "short"` for a process that does one job and ends (a migration, an ops script, a cron run) (#814): no
  metrics, since every run would only add new series under a new `service.instance.id`; traces and logs stay and are
  flushed when the process ends on its own (`beforeExit`), without calling `shutdown()`. `process.exit()` still needs
  an `await shutdown()` before it. New exported type: `ProcessLifetime`. The README's "Series" paragraph counts the
  cost per run.
- Migration: an app that sets `metrics: { enabled: false }` in its own script wrapper can pass `lifetime: "short"`
  instead; its explicit `shutdown()` before the end can stay (it is idempotent).
- Metrics: `http.client.request.duration` no longer counts the OTLP exporter's own requests (#810). The `node:http`
  instrumentation skips requests to the resolved trace, log and metric URLs (same scheme, host, port and path), so a
  process that makes no outgoing `node:http` calls of its own exports no client histogram at all (in an adopting
  app's job worker, 34 active series that measured only the export). Calls to other paths on the collector's host are still measured.
  An app that set `instrumentations: { http: false }` only to drop those series can remove it.

## 0.4.0

- Metrics: with an endpoint, `startObservability` also exports metrics over OTLP/HTTP protobuf to
  `<endpoint>/v1/metrics` (`OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`, `_HEADERS`), every 60 s and on shutdown:
  `http.server.request.duration`, `http.client.request.duration` and Node.js runtime metrics (event loop, GC, heap)
  (#632). On by default. `metrics: { enabled: false }` or `OTEL_METRICS_EXPORTER=none` turns metric export off,
  `instrumentations: { runtime: false }` the runtime metrics only, `metrics.exportIntervalMs` sets the interval. The
  README's "Metrics" section counts the series it adds.
- Incoming requests to `node:http`/`node:https` servers (Express and the like) get server spans, so request latency
  and 4xx/5xx show in traces and the logs of a request carry its trace id (#632). Also when `node:http` was imported
  before `startObservability`. `traces.ignorePaths` drops them from traces and from the duration metric; the query
  string is recorded as `url.query=REDACTED`. Outgoing `http.request` calls get client spans. Off with
  `instrumentations: { http: false }`; off by default in `registerObservability` (`/next`), since Next.js spans its
  requests itself.
- `environment` is written as both `deployment.environment.name` and `deployment.environment`, as
  `SOFTURE.Common.Observability` (.NET) does, so dashboards filtering on `deployment_environment` match Node.js
  services too (#632).
- `ResolvedObservabilityConfig` carries `metrics: SignalExport | null` on the `export` variant; a test comparing the
  whole object with `toEqual` adds it. New exported types: `InstrumentationOptions`, `MetricOptions`.
- Migration: an app that set `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<env>` only to work around the missing
  key can drop it. An app that must not add series sets `metrics: { enabled: false }` before upgrading.
- Bundling: `startObservability` now imports `createRequire` from `node:module` at the top level. An ESM bundle whose
  esbuild banner also imports `createRequire` (the banner `softure-deploy init` wrote up to deploy 0.4.6) fails to
  load with `SyntaxError: Identifier 'createRequire' has already been declared`. Import it under another name in the
  banner: `import { createRequire as __bundleCreateRequire } from 'module'; const require =
  __bundleCreateRequire(import.meta.url);` (#681).

## 0.3.0

- An OTLP endpoint with a scheme other than `http:`/`https:` no longer throws at start: that signal is not exported
  and one warning names the option or variable and the scheme (#608). Docker BuildKit sets
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=unix:///dev/otel-grpc.sock` in every `RUN` step, so a script that started
  observability during `docker build` died with `must be an http(s) URL`; it now runs with export disabled. A value
  that is not a URL at all (`localhost:4318`) still throws.
- `ResolvedObservabilityConfig` (from `resolveObservabilityConfig`) carries `warnings: string[]` on both variants. A
  test that compares the whole object with `toEqual` adds `warnings: []`.
- Migration: an app that set `OTEL_SDK_DISABLED=true` on a Dockerfile `RUN` step only to get past this error can
  remove it after upgrading.

## 0.2.0

- `traces.stableHttpAttributes`: the legacy HTTP attributes of a server span are copied onto their stable names when
  it ends (`http.status_code` to `http.response.status_code`, `http.method` to `http.request.method`, `http.target` to
  `url.path` without the query); the legacy keys stay. On by default in `registerObservability` (`/next`), so
  Next.js's request spans match queries on the current conventions; off by default in `startObservability` (#545).
- `traces.ignorePaths`: incoming requests to these paths (and below them) get no trace, e.g. a container health check
  (#546).
- `probeObservability` (`/node`) and the `softure-observability ping` command: send one probe span and one probe log
  record (`softure.probe=true`) and report per signal whether the backend accepted it, with the HTTP status when not;
  the command exits non-zero then (#547).

## 0.1.3

- The `@softure-ai/core` range also accepts 0.2.0, so an app can install core 0.2.0 next to this version.

## 0.1.2

- `registerObservability` (`/next`) now starts under a standalone Next.js server (`node server.js`), where
  `NEXT_RUNTIME` is unset at runtime; before, it returned `null` there and exported nothing (#381). It still does
  nothing in the edge runtime. An app that called `startObservability` from `/node` as a workaround can go back to
  `registerObservability`.

## 0.1.1

- No change for an app: the code is that of 0.1.0. This is the first version published through the package's npm
  trusted publisher (OIDC, `release.yml`) with no token; 0.1.0 needed `NPM_TOKEN` as a new package.

## 0.1.0

- First version (#370).
- `createLogger` and `configureLogging`: levels, attributes, child loggers, console output and OpenTelemetry log
  records with the active trace and span ids; `errorDetails: "label"` keeps error messages and stacks out of logs.
- `startObservability` (`/node`): traces and logs over OTLP/HTTP protobuf to the endpoint from the options or
  `OTEL_EXPORTER_OTLP_*`, resource attributes from the options and `OTEL_*`, spans for outgoing `fetch`; nothing is
  exported without an endpoint, and export headers are never printed.
- `registerObservability` and `createOnRequestError` (`/next`) for a Next.js `instrumentation.ts`.
