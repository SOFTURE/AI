# Implementation review: ci-test-shards-prepush

Verdict: approved.

- The shard matrix keeps the job's services, secrets and environment; only the name and the command take the shard.
- `scripts/test-changed.mjs` runs the full suite on any doubt (no merge base, a git error, a file of the preset's
  list); a red related run stops before `tests/repo`, so the hook fails on the first red set.
- The trial `vitest run --changed` on the area-gating commit picked its one changed test file (29 tests, 11 s).
- Gates: typecheck, ESLint and language gate green (pre-commit); `tests/repo` 850 passed, 69 skipped. This push runs
  the full suite in the hook, since `lefthook.yml` and `package.json` changed.
