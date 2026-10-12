# Plan review: observability-standalone-runtime

Reviewed plan.md against change.md, issue #381, `src/next/index.ts` and Next.js 16.3.8 (`bin/next`,
`server/web/sandbox/context.js`) on master. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Treating an unset variable as Node.js also starts observability when the function is called outside Next.js (a plain Node.js script). | Accepted: that is what `startObservability` would do there too, and the function is only documented for `instrumentation.ts`. |
| F2 | Suggestion | `process` may be missing in some non-Next edge hosts; `process.env.NEXT_RUNTIME` would throw there. | Accepted: check the `EdgeRuntime` global first and read `process` through `globalThis.process?.env`, so neither marker throws. |
| F3 | Suggestion | A test that sets `globalThis.EdgeRuntime` must remove it afterwards, or later tests see an edge runtime. | Accepted: removed in `afterEach`. |

No finding blocks the plan.
