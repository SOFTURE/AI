# Plan review: release-dispatch

Reviewed: plan.md @ 2026-10-05. Mode: quick (small, one phase). Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 0 suggestions.
Grounding: 6/6 paths (`.github/workflows/release.yml`, `scripts/release/pack.mjs`, `scripts/release/version.mjs`,
`scripts/build-workspaces.mjs`, `scripts/release/README.md`, `tests/repo/release-version.test.ts`),
4/4 symbols (`readReleasePackages`, `orderWorkspaces`, `getReleaseTag`, `findWorkspaces`), 3/3 commands.

## Lenses

| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | WARN (W1) |
| Data and migrations | PASS (none) |
| Tests | PASS (planner TDD; workflow checked by its first run) |
| Security | PASS (input via env, validated by the planner; job-scoped permissions; `GITHUB_TOKEN` only) |
| Lean | PASS |
| Fit | PASS (same pattern as FIRE_TRACKER; reuses the release helpers) |
| Cost and defaults | PASS |
| Scope | PASS (no version bumps, no `release.yml` job changes) |
| Reuse | PASS |
| Lessons | PASS |
| Progress format | PASS |

## Findings

### W1 [WARNING] The master check of a dispatched release is not named
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1 · `.github/workflows/release.yml` "Tag is on master"
**Problem:** the plan relies on `release.yml` treating a tag-ref dispatch like a tag push; its "Tag is on master"
step compares `GITHUB_SHA` with `origin/master`. If the dispatch ran on another ref, the release would still
refuse, but the auto-release workflow should refuse first, before it creates any tag.
**Fix:** `auto-release.yml` refuses any ref but `refs/heads/master` before planning; name it in step 3 and 1.2.
**Decision:** Fix now (applied) - step 3 and Progress 1.2 name the master-only guard.
