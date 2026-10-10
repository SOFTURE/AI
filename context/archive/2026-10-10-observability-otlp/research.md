# Research: observability-otlp

Input: change.md (issue #370), research.sources (docs/, ../../FIRE_TRACKER/). Depth: normal (no data, no auth,
no money; a new package with network export of secrets-bearing headers).
Snapshot: 19d024e on claude/dotnet-observability-mcp-wnmlot, 2026-10-10 13:26 CEST.

## Summary

- No package in the repo depends on `@opentelemetry/*` and none has a logger; packages call `console.*` with a
  prefix (`modules/mailing/src/server/send-mail.ts:115`) and log errors through `errorLogLabel`
  (`foundation/core/src/safe-error.ts:52`). The new package is greenfield.
- A package with no database, UI or routes fits `foundation/` (like `foundation/testing`): `tests/repo/packages.test.ts`
  requires `module.json`, the 12 README sections and dictionaries only for `modules/*` (:43-45, :144-170).
- The repository discovers a new workspace automatically (build order, release planner, shape tests); nothing to
  register by hand. A brand-new npm package needs the `NPM_TOKEN` secret for its first publish
  (`scripts/release/README.md:65-90`).
- OpenTelemetry JS: `NodeSDK` (`@opentelemetry/sdk-node` 0.223.0) weighs 52 MB, pulls gRPC/zipkin/prometheus
  exporters and exports to `http://localhost:4318` when nothing is configured. A minimal set (tracer provider, logger
  provider, OTLP proto exporters, http + undici instrumentation) is about 33 MB and exports nothing unless we create
  exporters.
- Next.js 16 calls `register()` from `instrumentation.ts` once per server; a globally registered tracer provider
  receives Next's built-in spans; `onRequestError` reports server errors with route context.
- Grafana indexes `service.name`, `service.namespace`, `deployment.environment.name` as Loki labels; the old
  `deployment.environment` is deprecated and not indexed.

## Current state

- **Repo layout.** `foundation/` holds shared libraries (core, db, ui, charts, testing), `modules/` feature modules
  with manifests, `tools/` app tooling (README.md:16-36). Template: `templates/package/` (README.md:7-12: rename,
  set `repository.directory`, drop `private`).
- **Logging today.** No logger abstraction anywhere (grep of `src/` for logger/pino/winston: none). Packages log with
  `console.error("<package>: …", errorLogLabel(error))`, e.g. `modules/auth/src/next/actions.ts:89`,
  `modules/analytics/src/server/funnel.ts:148`; ops injects `options.log ?? console.error`
  (`modules/ops/src/server/health.ts:23`, :80).
- **Example app.** `examples/next-app/instrumentation.ts:1-8` imports the config when `NEXT_RUNTIME === "nodejs"`;
  packages are installed as packed copies (`.npmrc` `install-links=true`, `scripts/e2e.mjs:4-5`);
  `next.config.ts:8` sets `serverExternalPackages: ["@softure-ai/db","pg"]`.
- **First adopter (FIRE_TRACKER).** `src/instrumentation.ts:11-15` imports the config and opens the database under
  the Node.js runtime check; no `onRequestError` (none in `src/`). `next.config.ts:26` `output: "standalone"`,
  `:13` `serverExternalPackages: ["@softure-ai/db", "@electric-sql/pglite", "pg"]`. 55 `console.*` calls in non-test
  `src/` files, mostly `console.error` in server actions (`src/app/actions/save-snapshot.ts:550`). Script bundles are
  esbuild ESM with `--external:pg` (docker/Dockerfile:120-161). Container env vars must be listed explicitly in
  `docker/prod/docker-compose.yml` (app `environment:` from :145).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| New package | `foundation/observability/**` | the package itself |
| Lockfile | `package-lock.json` | new dependencies |
| Example app | `examples/next-app/{package.json,instrumentation.ts,next.config.ts}` | prove the Next adapter with `next build` (L-002 practice) |
| Repo docs | `README.md` (package list) | foundation list mentions packages |

## Data

None: no tables, no migrations.

## Tests

- Gates: `npm run typecheck`, `npm run lint`, `npm test` (Vitest over packages and `tests/repo/`), `npm run build`;
  e2e `npm run e2e` (example app build + Playwright).
- Repo tests constrain the package shape (`tests/repo/packages.test.ts:81-142`): name `@softure-ai/<folder>`,
  `type: module`, `engines.node >=22`, `files` with `dist`/`src`/`CHANGELOG.md`, no tests in `files`, `build` =
  `tsc -p tsconfig.build.json`, exports conditions exactly `@softure-ai/source`, `types`, `default`, CHANGELOG starting
  `# Changelog` with `## Unreleased` or the version; `release-rules.mjs:141-219` checks license, repository, publishConfig
  and the packed tarball. Language gate: no Polish outside `messages/` or `pl/` (`tests/repo/language.test.ts:18-19`).
- OpenTelemetry offers in-memory exporters (`InMemorySpanExporter`, `InMemoryLogRecordExporter`) for asserting
  content, and a local `node:http` server can stand in for the OTLP receiver to assert paths and headers.

## Patterns to follow

- Package manifest: `foundation/testing/package.json` (exports, files, peers with `peerDependenciesMeta`).
- Error labels for paths with personal data: `errorLogLabel` (`foundation/core/src/safe-error.ts:52`).
- Next adapter imports by bare specifier with an ambient declaration file (L-002).
- `tsc` builds only (L-001).

## Prior work

- None on observability: no change, archive folder, issue or commit mentions OpenTelemetry or logging
  (grep of `context/`, issue search "observability logging OpenTelemetry": 0 results). `@opentelemetry/api` appears
  only transitively in `package-lock.json`.

## SOFTURE modules

Not applicable: no existing module covers logging or telemetry; this change adds the capability.

## Risks

- **Exporting by accident to localhost or exporting with no endpoint.** NodeSDK defaults to `otlp` exporters on
  `http://localhost:4318` (`otlp-http-configuration.js:60`). Mitigation: never use NodeSDK; create exporters only
  when an endpoint resolves.
- **Secret leakage.** The auth header could appear in a startup log or an error. Mitigation: never print headers;
  a test asserts the header value never reaches console output.
- **Next bundling of instrumentation.** `require-in-the-middle` warnings with NodeSDK (reported by other SDKs);
  instrumentation-http patches `http` through module hooks. Mitigation: the package stays out of the bundle when
  listed in `serverExternalPackages` (documented), proven by the example app's `next build`.
- **Personal data in exception messages.** Drizzle errors carry SQL and params in `message`
  (`foundation/core/src/safe-error.ts:63-66`). Mitigation: decided below.
- **Lost batches on shutdown.** Next's standalone server exits on SIGTERM; batched records in flight may be lost.
  Mitigation: short export delay, `shutdown()` exposed for plain Node processes.
- **OTel 0.x churn.** logs SDK and exporters are 0.x (0.223.0); processor constructors changed shape. Mitigation:
  pin minor ranges (`~0.223.0`), stable 2.x for trace and resources.
- **First npm publish needs `NPM_TOKEN`.** Owner-only secret; the release job fails with a clear message if it is
  missing and can be re-run.

## Relevant lessons

- L-001: build with `tsc`, no bundler.
- L-002: the Next adapter imports `next` types by bare specifiers and is proven through the example app's
  `next build`.

## Answers to unknowns

- **Where does the package live?** `foundation/observability` (answered: shape rules above; it is a library every app
  and module can use, with no manifest).
- **NodeSDK or a minimal set or `@vercel/otel`?** Minimal set (decided auto, below).
- **Which env vars?** The JS exporters read `OTEL_EXPORTER_OTLP_{ENDPOINT,HEADERS,PROTOCOL,…}` and per-signal
  variants themselves; with `OTEL_EXPORTER_OTLP_ENDPOINT` they append `/v1/traces` and `/v1/logs`, a programmatic
  `url` is used as given (otlp-exporter-base configuration source).
- **Does a log record get trace ids?** Yes: sdk-logs takes `logRecord.context || context.active()` and attaches its
  span context (`Logger.js:24`, `LogRecordImpl.js:98-101`).
- **Constructors in current versions:** `new LoggerProvider({ resource, processors })`,
  `new BatchLogRecordProcessor({ exporter, … })`, `new NodeTracerProvider({ resource, spanProcessors })`.
- **Grafana protocol:** OTLP/HTTP protobuf; JSON only for low traffic; endpoint `https://otlp-gateway-<region>.grafana.net/otlp`.

## Open questions

- Package placement: answered (foundation).
- SDK shape: decided (auto).
- Environment attribute name: decided (auto): `deployment.environment.name`.
- Exception details: decided (auto), below.
- Metrics: decided (auto): out of scope (issue #370 "Out of scope").
- Browser: out of scope (change.md Constraints).
- First publish secret: not a planning blocker; the release step reports it if missing.

## Decisions (auto)

- **Placement `foundation/observability`**, because the package has no database, UI or routes and every app or module
  may import its logger; a module manifest would describe nothing.
- **Minimal OpenTelemetry set, not NodeSDK, not `@vercel/otel`**: NodeSDK is 52 MB with exporters we do not use and
  defaults to exporting to localhost; `@vercel/otel` is a vendor package with wide peer ranges. The minimal set keeps
  control over "no endpoint, no export".
- **Protocol http/protobuf only** (Grafana's recommended format); in-memory exporters cover content in tests.
- **Resource attribute `deployment.environment.name`** (stable semconv, a Loki index label).
- **Exceptions**: the logger records `exception.type`, `exception.message` and `exception.stacktrace` (OTel semantic
  conventions) by default, because the purpose is debugging errors; README points apps to `errorLogLabel` for paths
  with personal data, and an option replaces the message with the label for apps that need it everywhere.
- **Metrics out of scope** for this change, as the issue states.
- **Research redo**: none; first run.
