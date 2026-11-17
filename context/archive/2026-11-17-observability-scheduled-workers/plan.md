# Plan: observability-scheduled-workers

## Approach
A second wrapper beside `withObservability` that runs the scheduled handler inside the same per-run store and exports
its records and one internal span; logging setup shared through one helper.

## Decisions (auto)
- Span name `scheduled`, kind internal, `faas.trigger`/`faas.cron` attributes; no parent (a Cron Trigger has none).
- Same options as `withObservability` minus `ignorePaths`; the app names its own `serviceName` for background work.
- Patch bump (0.8.7): additive export.

## Phases
1. Wrapper and tests (test-after). Done when the workers tests, typecheck and lint are green.
2. README, CHANGELOG, version.

## Progress
- [x] Phase 1: `npx vitest run foundation/observability/tests/workers.test.ts` 14/14 (3 new).
- [x] Phase 2: README section, limitation line, CHANGELOG 0.8.7, package.json and lockfile at 0.8.7.
