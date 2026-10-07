# Plan review: ops-health-testable-handler

Reviewed: `plan.md` against `change.md`, issue #216 and the current sources of `modules/ops/src/next/route.ts`,
`src/next/database.ts`, `src/next/index.ts`, `src/server/index.ts`, `tests/route.test.ts` and the auth README.
Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | D6 named only `package.json` and `module.json`; the manifest in `src/index.ts` pins the version too, and a mismatch would ship a module that reports 0.1.7. | Fixed in the plan: D6 lists all three pins found by grep. |
| F2 | Warning | Moving the single-flight state into a function that takes the config makes it look per-config while it is not: two concurrent calls with different configs would share the first run. | Accepted as is (one config per app, production unchanged) and recorded as D7 with a JSDoc note; tests await each call. |
| F3 | Suggestion | Exporting the core from `./next` would be the obvious place, but that entry loads `next/server` through `route.js` and hits step 1 of the issue again. | Kept on `./server` (D1), which the plan already argues in Findings. |
| F4 | Suggestion | The plan's test list carried a non-test ("no guard needed") line. | Replaced with a check that `closeHealthDatabases` is reachable from `./server`. |
| F5 | Suggestion | The `.js` import suggestion from the issue needs a visible answer, not only a plan decision. | D4 already routes it into the issue comment; kept. |

No migration, no cross-package contract change (additive export), no other open change touches ops.
