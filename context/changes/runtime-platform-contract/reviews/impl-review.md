# Implementation review: runtime-platform-contract

Verdict: approve. Reviewed the diff of phases 1 to 3 against `plan.md`.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `SoftureConfig.platform` is a new required field, so a config object built by hand and typed as `SoftureConfig` (not through `defineSoftureConfig`) fails to typecheck in an app. Two module tests cast such objects and still pass. | Accepted: documented under "Migrate" in the 0.2.8 changelog; `defineSoftureConfig` is the only supported way to build a config. |
| 2 | Suggestion | The guard follows literal dynamic imports, so a package that lazily imports a Node-only driver from a Workers entry will be refused even when the branch never runs on Workers. | Accepted as intended: such a driver belongs behind a Node-only entry; RP-2 splits db's drivers that way. |
| 3 | Suggestion | `WORKERS_BUILTINS` is a hand-kept list; Cloudflare adds builtins over time. | Accepted: the list lives in one file and docs/07 points at it. |

Evidence: core tests 575 passed; sabotaging the runtime check turned 2 tests red; planting `import "node:fs"` in
`foundation/core/src/next/registry.ts` turned the guard red; `tests/repo` and `foundation/core` 1537 passed; repo
typecheck clean; ESLint clean on the changed files. Plan drift: the version moved from 0.3.0 to 0.2.8 (recorded in
the plan review).
