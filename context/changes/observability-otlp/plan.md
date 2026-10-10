# Plan: observability-otlp

Input: change.md, research.md. Complexity: medium (one new package, three entry points, external protocol; no data).

## Goal

An app installs `@softure-ai/observability` 0.1.0 from npm and:

- logs through `createLogger(name)`: levels, attributes, child loggers, console output always, OTel log records when a
  logger provider is registered, each record carrying the active trace and span ids;
- calls `startObservability({...})` once per Node.js process (or `registerObservability({...})` from a Next.js
  `instrumentation.ts`), and from then on traces (Next's built-in request and `fetch` spans in a Next app; outgoing
  `fetch` through the undici instrumentation in a plain Node process) and logs
  go to the OTLP/HTTP endpoint from its options or from `OTEL_EXPORTER_OTLP_*`, with the resource attributes the app
  chose (`service.name`, `service.namespace`, `service.version`, `deployment.environment.name`);
- with no endpoint, nothing is exported and nothing tries `localhost:4318`;
- never sees the OTLP auth header in any output;
- reports Next.js server errors through `createOnRequestError(logger)`.

**Out of scope:** metrics, browser telemetry, vendor SDKs, auto-instrumentation of databases and of `node:http`
(it does not patch an ESM process that imported `http` first, and in Next it would re-parent Next's spans), migrating any app.

## Approach

**Starting point:** no logger or telemetry exists in the repo (research §Current state); packages log with
`console.error("<pkg>: …", errorLogLabel(error))` (`foundation/core/src/safe-error.ts:52`). New workspaces are
discovered automatically; shape rules live in `tests/repo/packages.test.ts:81-142`.

**Chosen:** a `foundation/observability` package on the minimal OpenTelemetry set (`@opentelemetry/api`,
`api-logs`, `sdk-trace-node`, `sdk-logs`, `resources`, `semantic-conventions`, `exporter-trace-otlp-proto`,
`exporter-logs-otlp-proto`, `instrumentation`, `instrumentation-undici`), with three entry
points: `.` (logger, no SDK import), `./node` (registration), `./next` (instrumentation helpers).
Rejected: `@opentelemetry/sdk-node` - 52 MB, unused exporters, exports to localhost by default; `@vercel/otel` -
vendor package, wide peer ranges, less control over the no-endpoint mode.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Location | `foundation/observability` | no DB, UI or routes; a library modules and apps import | research |
| SDK shape | minimal set, no NodeSDK | size, no default localhost export | research |
| Protocol | OTLP/HTTP protobuf only | Grafana's recommended format | research |
| Environment attribute | `deployment.environment.name` | stable semconv, Loki index label | research |
| Names | none in the package; the app passes them | owner: the app controls names | owner |
| Endpoint resolution | options win over env; base endpoint gets `/v1/traces`, `/v1/logs`; per-signal env endpoints used as given | mirrors the OTel env spec, one rule for both sources | plan |
| Logger without registration | console only, OTel emit is a no-op through the global API | a logger must work in tests and scripts | plan |
| Exception details | type, message, stack by default; `errorDetails: "label"` swaps message and stack for `errorLogLabel` | debugging first, an opt-out for apps with personal data in errors | research |
| Idempotence | one registration per process kept on `globalThis` | `next dev` reloads and double imports must not stack providers | plan |
| Shutdown | `handle.shutdown()` flushes; no signal handlers by default (`handleSignals: true` opt-in for plain Node) | Next's standalone server owns SIGTERM | plan |
| Version | 0.1.0 | new package | plan |
| Instrumentations | undici (outgoing `fetch`) on by default in plain Node, off by default in the Next adapter; no `node:http` instrumentation | measured: http instrumentation records nothing in ESM after an early `import`, Next already spans requests and `fetch` | plan-review |

**Critical details:**
- A programmatic exporter `url` is used as given, so the package appends `/v1/traces` and `/v1/logs` to the base
  endpoint itself; a per-signal env endpoint (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) is used unchanged.
- The exporters also read `OTEL_EXPORTER_OTLP_*` on their own; the package passes the resolved `url` and `headers`
  explicitly, so the result does not depend on that merge.
- `BatchLogRecordProcessor`, `SimpleLogRecordProcessor` and `LoggerProvider` take options objects in 0.223
  (`{ exporter }`, `{ resource, processors }`); passing the exporter positionally fails silently with a diag error.
  `NodeTracerProvider` (from `sdk-trace-node`) takes `{ resource, spanProcessors }`.
- Next requires the npm `@opentelemetry/api` first and falls back to its compiled 1.6.0 copy
  (`next/dist/server/lib/trace/tracer.js:54-61`); a provider registered through api 1.9.x is readable by both, so Next's
  spans reach it. The app must resolve a single `@opentelemetry/api` (README says how to check with `npm ls`).
- A second `logs.setGlobalLoggerProvider` is ignored silently, so idempotence must come from the package's own
  `globalThis` handle, not from the API.

## Phase 1: Logger package
**Discipline:** TDD. **Files:** `foundation/observability/{package.json,tsconfig.json,tsconfig.build.json,README.md,CHANGELOG.md}`, `foundation/observability/src/{index.ts,logger.ts,levels.ts,errors.ts}`, `foundation/observability/tests/logger.test.ts`, `package-lock.json`

1. Scaffold from `templates/package/` without module parts (no `module.json`, `messages`, `migrations`): name
   `@softure-ai/observability`, version `0.1.0`, `repository.directory` `foundation/observability`, export `.` only
   for now; dependencies `@opentelemetry/api`, `@opentelemetry/api-logs`, `@softure-ai/core` (for `errorLogLabel`);
   dev `@opentelemetry/sdk-logs` and `@opentelemetry/sdk-trace-node` for tests.
2. `src/levels.ts`: levels `debug | info | warn | error` with OTel severity numbers (5, 9, 13, 17) and a
   `parseLogLevel(value)` that accepts the names case-insensitively and returns `null` otherwise.
3. `src/errors.ts`: `describeError(error, mode)` returns OTel exception attributes. Contract:
   `mode "full"` → `exception.type`, `exception.message`, `exception.stacktrace`; `mode "label"` →
   `exception.type` and `exception.message = errorLogLabel(error)` from `@softure-ai/core`, no stack; non-Error
   values give `exception.type = typeof value`.
4. `src/logger.ts`: `createLogger(name, options?)` → `Logger { debug, info, warn, error, child(attributes) }`; each
   call is `(message: string, attributes?: Record<string, AttributeValue> & { error?: unknown })`. Minimum level from
   `options.level`, else `SOFTURE_LOG_LEVEL`, else `info`. Writes one console line (`console.error` for warn/error,
   `console.log` otherwise) as `<level> <name>: <message>` plus attributes as `key=value`, and emits an OTel log record
   through `logs.getLogger(name).emit(...)` with severity, body, attributes and the exception attributes. Defaults for
   `errorDetails` and `level` can be set once with `configureLogging({ level?, errorDetails? })`, kept on
   `globalThis` so duplicated copies of the package agree.
5. `src/index.ts`: exports `createLogger`, `configureLogging`, `parseLogLevel`, the `Logger` and option types.

**Tests:** level filtering (debug dropped at info; `SOFTURE_LOG_LEVEL=debug` lets it through; invalid env value falls
back to info); console routing per level and line format; child merges attributes, child attributes win; error with
`"full"` and `"label"` modes; non-Error thrown value; OTel emission captured by an in-memory `LoggerProvider` set as
global provider, with severity number, body and attributes; a record emitted inside an active span carries that
span's trace id; without a provider the logger still writes to the console and throws nothing.

**Done when:**
- Automated: `tests/logger.test.ts` passes with every case above.
- Automated: `npm run build` emits `foundation/observability/dist/index.js` and the repository shape tests pass for the new package.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: Node.js registration and OTLP export
**Discipline:** TDD. **Files:** `foundation/observability/src/node/{index.ts,config.ts,start.ts}`, `foundation/observability/tests/{config.test.ts,start.test.ts,otlp-receiver.ts}`, `foundation/observability/package.json`, `package-lock.json`

1. `src/node/config.ts`: pure `resolveObservabilityConfig(options, env)` → discriminated union
   `{ kind: "disabled", reason } | { kind: "export", tracesUrl, logsUrl, headers, resourceAttributes }`.
   Rules: `OTEL_SDK_DISABLED=true` or `options.enabled === false` → disabled; endpoint from `options.endpoint`, else
   `OTEL_EXPORTER_OTLP_ENDPOINT`, per-signal env endpoints override per signal; no endpoint at all → disabled;
   base endpoint gets `/v1/traces` and `/v1/logs` (trailing slash tolerated); headers from `options.headers`
   (record) else parsed from `OTEL_EXPORTER_OTLP_HEADERS` (`k=v,k2=v2`, values URL-decoded); resource from
   `OTEL_RESOURCE_ATTRIBUTES` overlaid by `OTEL_SERVICE_NAME` and the options `serviceName`, `serviceNamespace`,
   `serviceVersion`, `environment` (→ `deployment.environment.name`). An endpoint that is not an `http(s)` URL is a
   configuration error thrown with the variable name, never its value.
2. `src/node/start.ts`: `startObservability(options)` → `ObservabilityHandle { isExporting, forceFlush(), shutdown() }`.
   Disabled: no providers, one console line `observability: export disabled (<reason>)`. Export: resource, a
   `NodeTracerProvider` with a `BatchSpanProcessor` on `OTLPTraceExporter({ url, headers })`, registered globally
   (context manager and propagator included); a `LoggerProvider` with a `BatchLogRecordProcessor` on
   `OTLPLogExporter`, set as global logger provider; `registerInstrumentations` with undici unless
   `options.instrumentations.fetch === false`; `configureLogging` with the options' `logLevel` and `errorDetails`;
   one console line naming the endpoint origin and `service.name`, never the headers. Second call in a process
   returns the first handle and warns once. An internal `resetObservabilityForTests()` in `src/node/start.ts` (not
   exported from `package.json`) shuts the handle down, clears the `globalThis` key and calls `trace.disable()`,
   `logs.disable()`, `context.disable()`, `propagation.disable()`; every test that starts observability calls it in
   `afterEach`. `handleSignals: true` flushes on SIGTERM/SIGINT and re-raises the signal.
3. `src/node/index.ts` and `package.json`: export `./node`; add the SDK, exporter and instrumentation dependencies
   pinned to the current minors (`~0.223.0` for 0.x, `^2.12.0` and `^1.9.1` for stable ones).
4. `tests/otlp-receiver.ts`: a test helper that listens on a random port with `node:http` and records method, path,
   `content-type` and `authorization` of every request.

**Tests:** config: options over env; base endpoint with and without trailing slash; per-signal env endpoint used as
given; header string parsing with `=` inside a value and URL-encoded space; `OTEL_SDK_DISABLED`; no endpoint →
disabled; invalid endpoint error names the variable and not the value; resource attributes overlay order. Start:
disabled mode registers no provider (`handle.isExporting === false`, the global tracer provider still has no
delegate, the global logger provider is still the no-op one) and the logger still writes to the console; export mode against the fake receiver — after a span and a log line and `forceFlush()`, the receiver
saw `POST /v1/traces` and `POST /v1/logs` with `application/x-protobuf` and the exact `Authorization` header; a
`fetch` to the receiver inside the process produces a client span through the undici instrumentation; console
output captured during the whole test never contains the header value; second `startObservability` returns the same
handle; `shutdown()` resolves and later log calls do not throw.

**Done when:**
- Automated: `tests/config.test.ts` and `tests/start.test.ts` pass with every case above.
- Automated: Gates green (typecheck, lint, test).

## Phase 3: Next.js adapter, example app and documentation
**Discipline:** test-after. **Files:** `foundation/observability/src/next/index.ts`, `foundation/observability/tests/next.test.ts`, `foundation/observability/{package.json,README.md,CHANGELOG.md}`, `examples/next-app/{package.json,instrumentation.ts,next.config.ts}`, `README.md`, `package-lock.json`

1. `src/next/index.ts`: `registerObservability(options)` does nothing unless `process.env.NEXT_RUNTIME === "nodejs"`,
   then imports `../node/index.js` dynamically and starts it with `instrumentations.fetch` defaulting to `false`
   (Next's own `fetch` span covers it; README: set `NEXT_OTEL_FETCH_DISABLED=1` when turning it on); `createOnRequestError(logger)` returns a function with
   Next's `onRequestError(error, request, context)` shape (typed structurally, no `next` import) that logs at error
   level with `http.request.method`, `url.path`, `next.route` (`context.routePath`), `next.route_type` and the error.
   No request headers are logged.
2. `package.json`: export `./next`.
3. `examples/next-app`: depend on the package (`file:`), call `registerObservability` with placeholder names and no
   endpoint from `instrumentation.ts`, export `onRequestError`, and add the package to `serverExternalPackages`; the
   e2e build proves Next accepts it.
4. `README.md` of the package: what it provides, installation, configuration (options table and env variables with
   precedence), Next.js setup (`instrumentation.ts`, `serverExternalPackages`, `onRequestError`), plain Node setup,
   logger usage, error details and personal data, the auth header rule (environment only, never logged), limits
   (no metrics, no browser, no `node:http` instrumentation), and how to check for a single `@opentelemetry/api`
   (`npm ls @opentelemetry/api`). Placeholders only (`https://otlp.example.com/otlp`, `my-service`).
5. `CHANGELOG.md`: `## Unreleased` with the 0.1.0 entries. Root `README.md`: list the package under foundation.

**Tests:** `registerObservability` outside the Node.js runtime does not start anything; inside it, it returns a handle
(disabled without endpoint); `createOnRequestError` logs one error record with the route attributes and no headers.

**Done when:**
- Automated: `tests/next.test.ts` passes.
- Automated: `npm run e2e` passes with the example app wired to the package.
- Automated: Gates green (typecheck, lint, test).

## Risks and rollback

- OTel 0.x API change between minors → pinned `~0.223.0`; tests cover the constructors used.
- Next bundles the SDK and warns or fails → documented `serverExternalPackages`, proven by `npm run e2e`.
- Two copies of `@opentelemetry/api` in an app → Next and the package see different registries; README check, and
  the package declares the api as a dependency with a caret range so npm dedupes it.
- Secret in output → test on captured console output; README rule.
- Rollback: the package is new; reverting the merge removes it. A published 0.1.0 is fixed forward with a patch.

## Decisions (auto)

- Phase 1 drift: Vitest's SSR conditions drop `module` (`vitest.config.mts`), because that condition picks
  @opentelemetry's ESM build with extension-less imports, which Node refuses once Vitest externalizes it;
  `server.deps.inline` and `ssr.noExternal` did not help (measured). Node itself never reads `module`.
- Phase 1 drift: `tests/repo/release-tags.test.ts` counts 22 public packages (was 21) now that the package exists.
- Phase 2: the tests and the code were written before a red run (the code was drafted while phase 1's gates ran).
  Compensated with a sabotage check: dropping `/v1/<signal>` from the URL and printing the headers on start turned
  5 tests red (config paths, export, header never printed); restored, 33/33 green.
- Phase 2 drift: the disabled-mode test proves "no provider" by registering a probe provider successfully (the API
  returns a proxy, not a no-op provider, so a class-name check was wrong).
- Phase 3: `npm run e2e` needs Docker or a Postgres server, neither available in the cloud session; 3.2 is
  checked by the `e2e` workflow on the pull request. Locally: `next build` of the example app passed with no warning,
  `npm ls @opentelemetry/api` shows one copy, and `next start` with `OTEL_EXPORTER_OTLP_ENDPOINT` pointed at a local
  receiver delivered Next.js spans (`next.js` scope, `next.route`, `service.namespace`) as protobuf with the
  `Authorization` header.
- Impl review (reviews/impl-review.md): headers now merge per key (per-signal env over shared env, options over
  both), replacing the plan's "options replace the environment" detail, because the OTLP exporters merge the
  environment per key anyway; `handleSignals` re-raises only without other listeners and bounds the flush to 5 s;
  `url.path` drops the query; diag errors go to the console.
- Phase 2 drift: the SDK packages moved from dev dependencies to dependencies, since `./node` imports them.

- Complexity → medium (one package, three entry points, no data).
- Metrics now? → no (issue scope).
- Console format JSON or text? → text `<level> <name>: <message> key=value` (readable in `docker logs`; structured data goes through OTLP).
- Signal handlers by default? → no (Next's standalone server handles SIGTERM itself).
- Logger level env name → `SOFTURE_LOG_LEVEL` (no OTel standard exists for app log level; prefix matches other SOFTURE env vars).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Logger package

#### Automated
- [x] 1.1 `tests/logger.test.ts` passes with every case above. — 0ef5ff7
- [x] 1.2 `npm run build` emits `foundation/observability/dist/index.js` and the repository shape tests pass for the new package. — 0ef5ff7
- [x] 1.3 Gates green (typecheck, lint, test) — 0ef5ff7

### Phase 2: Node.js registration and OTLP export

#### Automated
- [x] 2.1 `tests/config.test.ts` and `tests/start.test.ts` pass with every case above. — 060011c
- [x] 2.2 Gates green (typecheck, lint, test) — 060011c

### Phase 3: Next.js adapter, example app and documentation

#### Automated
- [x] 3.1 `tests/next.test.ts` passes. — 348bfab
- [ ] 3.2 `npm run e2e` passes with the example app wired to the package.
- [x] 3.3 Gates green (typecheck, lint, test) — 348bfab
