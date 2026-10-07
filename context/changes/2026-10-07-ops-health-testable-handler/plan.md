# Plan: ops-health-testable-handler

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

An app can unit test what `/api/health` answers with a plain call and no mocks
(`createHealthResponse(config)` from `@softure-ai/ops/server`), and the README tells it how to test the
mounted `GET` itself when it wants to. ops 0.1.8.

**Out of scope:** changing `next/server` to `next/server.js` (and `next/headers.js` in auth), see D4; any
behaviour change of `GET`.

## Findings (the reading behind the plan)

- `GET` = `connection()` + `getSoftureConfig()` + module lookup + single-flight `checkHealth` + `Response`.
  Only the first line needs Next or a request scope.
- `src/next/database.ts` has no Next import; it sits under `next/` only because only the route uses it.
- `@softure-ai/ops/next`'s index re-exports `route.js`, so any import of that entry loads `next/server`;
  the handler core must live on an entry that does not (`./server`).
- The package's own `tests/route.test.ts` already mocks `next/server` (it runs through Vitest with the
  source condition, so step 1 never shows up here).

## Key decisions

- **D1** New `src/server/health-response.ts` exporting
  `createHealthResponse(config: SoftureConfig): Promise<Response>`: module lookup (throws the same
  "ops module is not enabled" error), single flight, database opening, the body by `detail`, status and
  `cache-control: no-store`. Exported from `@softure-ai/ops/server`. It takes the config as an argument,
  so a test needs no registry either.
- **D2** `GET` becomes `await connection(); return createHealthResponse(getSoftureConfig());`.
  The single-flight state moves with the core (one per process, as today).
- **D3** `database.ts` moves to `src/server/health-database.ts`; `closeHealthDatabases` is exported from
  `./server` too and stays exported from `./next` (no breaking change).
- **D4** Imports of Next stay extensionless: the `.js` form bypasses Next's per-runtime alias and breaks
  `next build` (measured before, recorded in `src/next/next-modules.d.ts`). Answer in the issue comment.
- **D5** README § 4 gets "Testing the route": first `createHealthResponse` (no inline, no mock), then the
  recipe for `GET` itself (`server.deps.inline` + `vi.mock("next/server", …)` with a `connection` spy).
  CHANGELOG 0.1.8 lists the new export and backfills the testing note the 0.1.6 line lacked.
- **D6** Version 0.1.8 in `package.json`, `module.json` and the manifest in `src/index.ts` (the three pins
  grep finds).
- **D7** Single flight is keyed by nothing, as today: concurrent calls share one run whatever config they
  pass. One app has one config, so production is unchanged; the JSDoc says so, and tests await each call.

## Phase 1: handler core, docs, version (test-after for the move, TDD for the new export)

- Tests: new `tests/health-response.test.ts` importing only `@softure-ai/ops/server` and
  `@softure-ai/core` (no `vi.mock`): 200 + `{ status: "ok" }` + `no-store` with a passing database;
  503 + `{ status: "unavailable" }` when a check fails; `detail: "checks"` lists checks; throws when ops
  is not enabled; `closeHealthDatabases` reachable from `./server`.
  Existing `tests/route.test.ts` stays as is and must stay green (GET behaviour unchanged).
- Code: `src/server/health-response.ts`, `src/server/health-database.ts` (moved), `src/server/index.ts`,
  `src/next/route.ts`, `src/next/index.ts`, `src/index.ts`, `README.md`, `CHANGELOG.md`, `package.json`,
  `module.json`.

Done when: the new test file fails before the export exists and passes after; `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build` green.

## Progress

- [ ] Phase 1: handler core, docs, version
