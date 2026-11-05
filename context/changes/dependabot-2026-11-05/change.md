---
change_id: dependabot-2026-11-05
title: "deps: first Dependabot round (minor/patch group, OpenTelemetry 3, node-html-parser 9)"
status: in_progress
roadmap_item: null
issue: null
branch: claude/project-thread-ti6gcw
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Land the first three Dependabot pull requests as one change, since all three are red and need code changes:

- #1097, the npm minor/patch group (31 updates). It moves the OpenTelemetry experimental packages to 0.300, which
  belong to the OpenTelemetry JS 3.0 release, while the stable SDK packages stay on 2.x, so the tree carries two
  `@opentelemetry/api` copies and typecheck fails.
- #1098, `@opentelemetry/resources` 2.12 -> 3.0 (major).
- #1099, `node-html-parser` 6 -> 9 (major): `parentNode` is now nullable.

The outcome: every package on the versions those pull requests ask for (the OpenTelemetry family on one coherent
3.x / 0.30x line), gates green, the Dependabot pull requests closed when this merges. Changed packages join the next
combined release.

## Context

Coordinator brief (2026-11-05 20:39 UTC), Dependabot rule in `AGENTS.md`: a red check or a major bump becomes a change
of its own; the thread opens its own pull request with the bump and the fixes and closes the Dependabot pull request
when it merges.

OpenTelemetry JS 3.0: `@opentelemetry/api` 1.10 carries the logs API (`@opentelemetry/api-logs` is retired),
`@opentelemetry/sdk-trace` replaces `sdk-trace-base` and `sdk-trace-node` (`TracerProvider` instead of
`BasicTracerProvider`/`NodeTracerProvider`, no `register()`; the context manager and propagator are set up by the
caller), `sdk-logs` moves to the stable 3.x line.

Files: `foundation/observability` (src, tests, package.json), `foundation/llm` (tests, package.json),
`modules/security/src/readable-text.ts`, `modules/seo`, every `package.json` the group touches, `package-lock.json`.

## Constraints

- English only. No behaviour change of `startObservability`: same context manager (AsyncLocalStorage), same W3C trace
  context + baggage propagation, same exports.
- Coordinate the lockfile with the parallel thread "Patch vulnerable dependencies" (issue #1101): it merges first,
  this branch then rebuilds the lockfile on top.

## Notes

- Framing: skipped. The Dependabot pull requests name the outcome.
