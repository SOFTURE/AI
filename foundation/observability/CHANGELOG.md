# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/observability`. When an app has run a
version in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- First version: `createLogger` (levels, attributes, child loggers, console output, OpenTelemetry log records with
  the active trace and span ids) and `configureLogging`.
