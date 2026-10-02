# Impl review: ops-health-migrate

Reviewed: commits 4540c26..8f35188 against plan.md (author's review, `--auto`, fully autonomous
mode). Verdict: approve after fixes. Findings: 0 critical, 2 warning, 2 suggestion.

Evidence re-run for every ticked Progress item: gates (typecheck, lint, 827 tests, build),
`release:pack --package ops`, `npm run e2e` 15/15 on PostgreSQL 16 as `softure_app`,
`npm run e2e:container` (200, DDL refused, 503 with Postgres stopped). Mutation check: replacing the
single-flight `??=` with `=` turns "shares one run between concurrent requests" red.

## Findings

### W1 [WARNING] A check that resolves to a non-Result fails the whole route
**Where:** `modules/ops/src/server/health.ts` `runOne`
**Impact:** LOW. **Dimension:** correctness.
**Problem:** reading `result.ok` on `undefined` threw inside the fulfilment handler, which the
sibling rejection handler does not catch; the route answered 500 instead of a `failed` check.
**Decision:** fix now - `.catch` after the result handler; test "marks a check that does not return
a Result as failed". 8f35188.

### W2 [WARNING] The health route opened a pglite:// database a second time
**Where:** `modules/ops/src/next/route.ts`, `database.ts`
**Impact:** MEDIUM. **Dimension:** correctness.
**Problem:** with `pglite://<dir>` the route opened the app's data folder in a second PGlite
instance in the same process (corruption risk); with `pglite://` it checked a second, empty database.
**Decision:** fix now - `ops({ getDatabase })` passes the app's own database; a pglite URL without it
throws a setup error (500, the log names the option). Tests for both and for a failing
`getDatabase`. 8f35188.

### S1 [SUGGESTION] Module checks do not run when the database cannot be opened
**Where:** `modules/ops/src/next/route.ts` `checkHealth`
**Decision:** accept - module checks take the database in their context; without one they would
all fail too, and the answer is already 503.

### S2 [SUGGESTION] The README's image template is not built by CI
**Where:** `modules/ops/README.md`, "Container recipe"
**Decision:** accept - the verified instance is the example app's Dockerfile (CI job `container`);
the template differs only in the monorepo build stage, which a single-package app does not have.

## Dimensions

| Dimension | Verdict |
| --- | --- |
| Plan fidelity | approve (`getDatabase` added by W2, recorded here) |
| Progress honesty | approve |
| Correctness | approve after W1, W2 |
| Tests | approve |
| Security | approve: public route with no input, single flight instead of a DB-backed limiter (plan), causes logged by label only, least-privilege roles verified |
| Patterns | approve |
