---
change_id: observability-otlp
title: "Node and Next.js apps ship logs and traces over OTLP with @softure-ai/observability (issue #370)"
status: new
roadmap_item: null
issue: 370
branch: claude/dotnet-observability-mcp-wnmlot
created: 2026-10-10
updated: 2026-10-10
archived_at: null
---

## Intent

Close [issue #370](https://github.com/SOFTURE/AI/issues/370). An adopting Node.js or Next.js app installs
`@softure-ai/observability`, sets a few options or the standard `OTEL_*` environment variables, and from then on:

- its server-side traces and logs reach any OTLP/HTTP backend (the first target is a hosted Grafana stack read by
  agents through its MCP server), each log line carrying the active trace and span ids;
- it logs through a small structured logger (levels, attributes, child loggers) that also writes to the console;
- every signal carries the resource attributes the app chose (`service.name`, `service.namespace`,
  `service.version`, `deployment.environment`), so several projects can share one backend and be told apart;
- with no endpoint configured, nothing is exported and the logger still works on the console;
- the OTLP auth header comes from the environment and never appears in output.

The package is published on npm. A reviewer checks the package README, its tests (export with a fake OTLP
receiver, no-endpoint mode, header redaction, resource attributes) and the CHANGELOG.

## Context

The owner (2026-10-10, chat) is moving every project's logs to one cloud backend with MCP access, replacing a
self-hosted log server that is not reachable from outside. The .NET packages of the stack get the same OTLP
path in a separate repository. The owner's words: the package is common, so it carries no names; "only the app
that installs the package controls the names". The owner asked for this package to be built and released to npm
autonomously.

An adopting Next.js app today logs with bare `console.*` (about 28 files) and has an `instrumentation.ts` that only
opens its config and database.

## Constraints

- No project, app or vendor names in code, defaults or docs examples (placeholders only).
- No browser telemetry: an OTLP auth token must not reach a client bundle.
- Owns a new package folder only; existing packages change only where the repository's own tests require it
  (package lists, release planner).

## Notes

- Placement: unlinked (`roadmap_item: null`); the project takes work from issues (`autonomy.source: "issues"`),
  the issue is the record.
