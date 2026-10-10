# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/observability`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

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
