# Plan review: db-migrator

Reviewed: plan.md @ 2026-10-02. Mode: deep (an independent read-only reviewer plus the author's
check). Verdict: ready after fixes.
Findings: 0 critical, 8 warning, 9 suggestion.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (Goal and roadmap Baseline map to phases 2-4) |
| Slicing and contracts | PASS |
| Data and migrations | FAIL (W2, W3, W5, W7) → fixed |
| Adopt correctness | FAIL (W4) → fixed |
| Security and input | FAIL (W6) → fixed |
| CI and container path | FAIL (W1, W8) → fixed |
| Lessons | PASS (L-001: package build stays `tsc`; esbuild only in a test) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The bundle test cannot resolve workspace packages in CI
**Where:** Phase 4, step 4 · `.github/workflows/ci.yml` (the test job has no build step)
**Problem:** without the `@softure-ai/source` condition esbuild resolves `@softure-ai/core` to a `dist/` that does not exist in CI.
**Decision:** Fix now (applied) - esbuild gets `conditions: ["@softure-ai/source"]`.

### W2 [WARNING] Adopt checks outside the lock
**Where:** Phase 3, step 2
**Problem:** the ledger check and the schema comparison ran before the lock, so a concurrent run could change both.
**Decision:** Fix now (applied) - the lock is taken first; read, compare and write all run under it.

### W3 [WARNING] Adopt neither bootstraps the ledger nor requires its dependencies
**Where:** Phase 3, step 2
**Problem:** an adopting app has no `softure.migrations` yet; adopting `tags` while `notes` is not in the ledger would let a later migrate re-run `notes` against existing tables.
**Decision:** Fix now (applied) - adopt applies a pending ledger migration (not on a dry run) and refuses with `db.adopt_dependency_pending`; tests added.

### W4 [WARNING] False differences in adopt
**Where:** Phase 3, step 1
**Problem:** dropped columns, extension-owned objects, serial and identity sequences.
**Decision:** Fix now (applied) - filters on `attisdropped`, `attnum`, `pg_depend.deptype = 'e'`; sequences listed; fixtures with identity, serial and a dropped column, and a sequence left behind.

### W5 [WARNING] A poisoned connection could return to the app's pool
**Where:** Phase 2, step 1
**Problem:** a plain `SET` in a file or a failed unlock survives `release()`.
**Decision:** Fix now (applied) - the pg client is destroyed with `release(true)`; PGlite gets `RESET ALL`; test added.

### W6 [WARNING] Only `softure` was reserved as a schema
**Where:** Key decisions, Phase 2
**Problem:** the manifest regex accepts `public`, `information_schema`, `pg_*` and names over 63 bytes.
**Decision:** Fix now (applied) - all refused with `db.reserved_module`.

### W7 [WARNING] Nothing pins the ledger migration
**Where:** Phase 2, step 2
**Problem:** an edit to the TS string would make every deployed app fail with `db.migration_changed`.
**Decision:** Fix now (applied) - a test pins its sha256.

### W8 [WARNING] `.ts` config loading proven only under Vite
**Where:** Phase 4, steps 3-4
**Problem:** Vitest transpiles what real Node cannot (Node 22 type stripping keeps `.js` specifiers and skips `node_modules`).
**Decision:** Fix now (applied) - the bundle test spawns real Node on a bundled bin and `.mjs` config; the limits are documented.

### S1 [SUGGESTION] Load drizzle driver entries lazily too
**Decision:** Dismiss - already the case in `src/client.ts` (phase 1).

### S2 [SUGGESTION] `@types/pg` in the package dependencies
**Decision:** Fix now (applied) - `Pool` is in the public types.

### S3 [SUGGESTION] Fix the top-level failure code
**Decision:** Fix now (applied) - the first problem's code; recorded in Key decisions.

### S4 [SUGGESTION] Renamed files pass unnoticed
**Decision:** Fix now (applied) - a changed name is `db.migration_changed`.

### S5 [SUGGESTION] The concurrency test may not overlap
**Decision:** Fix now (applied) - a `pg_sleep(0.5)` fixture.

### S6 [SUGGESTION] Transaction control inside a file
**Decision:** Fix now (applied) - statement lines `BEGIN;`, `COMMIT;`, `ROLLBACK;`, `START TRANSACTION` are invalid.

### S7 [SUGGESTION] RLS policies and view bodies in adopt
**Decision:** Defer - listed in Out of scope next to grants; README section 12.

### S8 [SUGGESTION] Lock wait timeout
**Decision:** Defer - `lock_timeout` would also cut DDL waits inside migrations; documented with PgBouncer in README section 12.

### S9 [SUGGESTION] PGlite in a `pg`-only image
**Decision:** Fix now (applied) - docs/05 and README note it.

## Triage summary
Fixed: W1-W8, S2-S6, S9. Accepted: -. Deferred: S7, S8. Dismissed: S1. Verdict after triage: ready.

## Decisions (auto)

- Every warning → Fix now (local edits, no scope change).
- S7, S8 → Defer with documentation (each widens scope or changes migration semantics).
