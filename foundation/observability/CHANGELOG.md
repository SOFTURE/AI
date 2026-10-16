# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/observability`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

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
