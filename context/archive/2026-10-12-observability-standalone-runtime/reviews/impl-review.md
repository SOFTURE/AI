# Implementation review: observability-standalone-runtime

Reviewed commit ebaee23 against plan.md, change.md and issue #381. Mode: autonomous.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Suggestion | The test for the `EdgeRuntime` global would also pass on the old code (it returned `null` whenever `NEXT_RUNTIME` was not `nodejs`); it pins the new branch, not the bug. | Accepted as is: the standalone test fails on the old code and passes now, which pins the bug; the global test keeps the edge guard from regressing. |
| F2 | Suggestion | `"EdgeRuntime" in globalThis` is true even if a polyfill defines the global as `undefined`. | Accepted as is: only edge hosts define it. |

Plan coverage: the phase is done (tests, code, README, CHANGELOG `## Unreleased`). Gates: typecheck, lint, build
green; the pre-commit hook passed. Asks of the issue: the edge runtime is detected instead of the Node.js one, and a
test runs the adapter with `NEXT_RUNTIME` unset.

No finding blocks the change.
