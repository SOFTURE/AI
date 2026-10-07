---
change_id: ops-health-requires-database
status: done
updated: 2026-10-07
---

# Plan: /api/health requires a database by default

## Approach

`collectHealthChecks(config, db)` gets the missing-database case: when `db` is `null` and the ops options say
`requireDatabase` (default `true`, also when ops is not in the config), the `database` check is one that returns
`err("ops.database_missing")`. The runner then logs `health check "database" failed: ops.database_missing` and the
report is `unavailable`, through the same path as every other failed check, so the module and app checks still run
and `detail: "checks"` lists them.

## Key decisions

- **D1. Default `true`, not conditional on `dbSchema`.** A module with a `dbSchema` already makes `database: null` a
  config error, so a conditional default would never apply (`change.md`, Context).
- **D2. A failing check, not "zero checks → unavailable".** It names the cause in the response (`database: "failed"`)
  and the log, it also catches the case with passing module checks, and `requireDatabase: false` is a clear opt-out
  for an app without a database.
- **D3. The check lives in `collectHealthChecks`,** next to the real database check, so the route stays one call and
  the server API (`@softure-ai/ops/server`) gives the same answer to an app that runs checks itself.
- **D4. The error code is `ops.database_missing`;** the README tells what to look at (`DATABASE_URL`, the config).

## Phases

### Phase 1: the option and the check (TDD)

- `modules/ops/tests/health.test.ts`, `route.test.ts`, `module.test.ts`: no database + default → `database` check
  first, failing, 503 with `{ database: "failed", ... }` and the log line; `requireDatabase: false` → module checks
  only, and with nothing else 200 `{ status: "ok", checks: {} }`; the option is parsed and refuses a non-boolean.
- `modules/ops/src/options.ts`: `requireDatabase: z.boolean().default(true)`.
- `modules/ops/src/server/health.ts`: `createMissingDatabaseCheck()` and its use in `collectHealthChecks`.
- Existing tests that use `databaseUrl: null` for module-only runs pass `requireDatabase: false`.

Done when: the new tests fail before the change and pass after it; `npm run typecheck`, `npm run lint`, `npm test`
green.

### Phase 2: docs

- `modules/ops/README.md`: the option row, the response table and the check order, the log line.

Done when: gates green, CI green.

## Progress

- [x] Phase 1: the option and the check
- [x] Phase 2: docs
