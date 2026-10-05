# Plan review: packages-first-release

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase, metadata only). Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 0 suggestions.
Grounding: 9/9 paths (`foundation/{core,db,ui}/package.json`, `modules/*/module.json`, `modules/*/src/index.ts`,
`tests/repo/packages.test.ts`, `scripts/release/release-rules.mjs`, `scripts/release/version.mjs`,
`examples/next-app/package-lock.json`, `.github/workflows/e2e.yml`, `scripts/release/README.md`),
3/3 symbols (`checkManifest`, `checkInternalRanges`, `checkDependency` in `foundation/core/src/config.ts`),
4/4 commands (`workflow.json` gates, `npm run build`, `npm run release:pack`).

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (every place research lists is in the Files) |
| Slicing | PASS (one phase; the tree is consistent only when all versions move together) |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (no data) |
| Tests | PASS (package, module and release tests already pin every field) |
| Security | PASS (no secret; nothing published; the tag stays the owner's) |
| Lean | PASS |
| Fit | PASS (the runbook stays the one place for release steps) |
| Cost and defaults | PASS |
| Scope | PASS (LT-1 and the item finish reviews stay out; the release:version gap goes to LT-2) |
| Reuse | PASS (the existing release:pack dry run is the pack check) |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The e2e app install is not named as a check
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, Done when · `.github/workflows/e2e.yml:53`
**Problem:** the e2e job runs `npm ci` in `examples/next-app`; a stale lockfile there fails only in that
job, which the plan's Done-when does not name.
**Fix:** run `npm ci` in `examples/next-app` after regenerating its lockfile and name it in item 1.2.
**Decision:** Fix now (applied) - item 1.2 says "`npm ci` passes at the root and in `examples/next-app`".
