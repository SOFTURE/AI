# Research: dependabot-2026-11-05

## Why the three pull requests are red

- #1097: `typecheck + lint + language` and `build packages` fail with two `@opentelemetry/api` copies in the tree.
  The group moves the experimental OpenTelemetry packages (exporters, instrumentation) to 0.300 and the api to
  1.10, while `@opentelemetry/sdk-*`, `core` and `resources` stay on 2.x and the root keeps api 1.9.1 hoisted (drizzle,
  next and vitest accept it). 1.10's `Attributes` is `Record<string, unknown>`, which 1.9's types do not accept.
- #1098: `@opentelemetry/resources` 3.0 alone against SDK 2.x: the same split.
- #1099: `node-html-parser` 9 types `parentNode` as `HTMLElement | null`; `modules/security/src/readable-text.ts`
  dereferences it twice in `listPosition`.

## OpenTelemetry JS 3.0 (checked against the published tarballs)

- `@opentelemetry/api` 1.10 carries the logs API (`logs`, `SeverityNumber`, `LoggerProvider`);
  `@opentelemetry/api-logs` has no 0.300 release. `AttributeValue` is now an alias of `AnyValue = unknown`
  (deprecated). `logs.setGlobalLoggerProvider` returns a boolean, like `trace.setGlobalTracerProvider`.
- `@opentelemetry/sdk-trace` 3.x replaces `sdk-trace-base` and `sdk-trace-node`: `TracerProvider` (no `register()`),
  `BatchSpanProcessor({ exporter })` and `SimpleSpanProcessor({ exporter })` take an options object. The README sets up
  Node.js with `AsyncLocalStorageContextManager` (`@opentelemetry/context-async-hooks`) and a
  `CompositePropagator(W3CTraceContext, W3CBaggage)` from `@opentelemetry/core`, which is what
  `NodeTracerProvider.register()` did.
- `sdk-logs`, `sdk-metrics`, `core`, `resources`, `context-async-hooks` are 3.x; exporters and instrumentation 0.300
  pin `sdk-trace`/`sdk-logs`/`core` 3.0.0 exactly. `instrumentation-runtime-node` 0.37 and `instrumentation-undici`
  0.34 take `^0.300.0` and `^3.0.0`. So the family is held on 3.0.x / 0.300.x with `~`, which resolves to one copy
  of every package.

## Other updates in the group

`npm run typecheck` over the whole tree is green after the OpenTelemetry and node-html-parser changes, so the
remaining 0.x minors (satori 0.63, hyperframes 0.9, lucide) need no code change. The parallel security thread (#1101)
also bumps next, zod and markdown-it; its versions win on rebase.
