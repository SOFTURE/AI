# Plan: deploy-verify-production

Input: change.md, research.md. Complexity: medium (one command, a config schema, an async CLI).

## Goal

`softure-deploy verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=<n>]` runs every check of the
`verify` section of `deploy.json` against `<url>`, prints a table and a summary, and exits `1` when a check fails.
`deploy.json` has a zod schema, published as `tools/deploy/schema/deploy.schema.json`.

**Out of scope:** certificate expiry window, FIRE parity (both gaps in `deploy-followups`); retries or waiting for
the app to come up (the DP-2 workflow's health step); any request to a real production URL.

## Approach

**Chosen:** a zod schema (`src/verify/schema.ts`) parsed at the boundary; a pure check engine per response
(`src/verify/checks.ts`); a runner that fetches with `redirect: "manual"`, a timeout and a concurrency limit
(`src/verify/run-checks.ts`, `fetch` injectable but tested against a real `node:http` server); a formatter for the
table (`src/verify/report.ts`); a thin command (`src/cli/verify-command.ts`). `runCli` becomes async.
**Rejected:** shelling out to curl (the roadmap replaces bash); following redirects (the redirect target is the
thing checked); a global `fetch` mock in tests (the roadmap asks for a local server).

## Phase 1: Schema and the published JSON Schema

**Discipline:** TDD.
**Files:** `src/verify/schema.ts`, `src/verify/schema.test.ts`, `scripts/write-schema.ts`,
`schema/deploy.schema.json`, `tests/schema.test.ts`, `package.json` (`zod`, `files`, `schema` script).

1. `deploySchema`: strict root with optional `$schema` and `verify`; `verify` = `timeoutMs` (default 10000),
   `headers` (every route; `null` = must be absent), `routes` (at least one). A route = `path` (starts with `/`, not
   `//`), `status` (default 200), `contains`, `excludes`, `redirect` (only with a 3xx status), `headers`.
   Header names are lower case. Every key `.describe()`d.
2. `parseDeployConfig(unknown)`: a result value with the zod issues as `path: message` lines.
3. `schema/deploy.schema.json` written by `npm run schema -w @softure-ai/deploy`; a test fails when it is stale or a
   key has no description.

## Phase 2: Checks and runner

**Discipline:** TDD.
**Files:** `src/verify/checks.ts`, `src/verify/run-checks.ts`, `src/verify/report.ts`, `src/verify/index.ts`,
tests, `src/index.ts`.

1. `checkResponse({ route, headers, response })` → a list of outcomes (`status`, `contains`, `excludes`,
   `redirect`, `header`), each `passed` with a detail naming expected and actual.
2. `runVerify({ baseUrl, config, fetch, concurrency, timeoutMs })`: one request per route (GET, no redirect
   following, `cache-control: no-cache`), body read only when a marker needs it; a network error or timeout is one
   failed `request` outcome; reports in config order.
3. `formatVerifyReport(reports, baseUrl)`: aligned table (Result, Status, Route, Detail) and a summary line.
4. Tests against a local `node:http` server: pass, wrong status, missing and forbidden marker, redirect match and
   mismatch, header value and absence, timeout, connection refused, order kept with concurrency.

## Phase 3: CLI

**Discipline:** TDD.
**Files:** `src/cli/{run,main,verify-command}.ts`, `tests/cli.test.ts`, `tests/verify-cli.test.ts`, `README.md`.

1. `runCli` returns `Promise<number>`; commands may be async; `main.ts` awaits it; existing tests await.
2. `verify <url>`: exactly one positional `http(s)` URL without credentials; `--config` (default `deploy.json`),
   `--timeout`, `--concurrency` (1…32); unreadable or invalid config → exit 1 with the zod issues; usage → exit 2.
3. README section, usage text; roadmap and status rows.
4. Gates: typecheck, lint, test, build.

## Progress

#### Automated
- [x] Phase 1: schema and the published JSON Schema
- [x] Phase 2: checks and runner
- [x] Phase 3: CLI (the three phases land in one commit; each was test-first in the working tree)

#### Manual
- [ ] (owner, after DP-8) run `softure-deploy verify` against FIRE_TRACKER's production with its own `deploy.json`
