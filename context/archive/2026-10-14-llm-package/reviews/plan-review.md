# Plan review: llm-package

Reviewed: `plan.md` against `change.md`, `research.md`, issue #472, `tests/repo/packages.test.ts` and the AI SDK 7
types. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Critical | D3 races the SDK call against a timer. When the timer wins, the SDK promise may still reject later (the abort reason), which is an unhandled rejection that can crash a Node process. | Fixed in the plan (D3): the SDK promise gets its own handler before the race, so a late rejection is observed. A test drives a model that rejects after the timeout. |
| F2 | Warning | `trace.setGlobalTracerProvider` accepts one provider per process; a tracing test that registers its own provider leaks into the other test files of the run and fails on the second registration. | Fixed in the plan (D6): `createLlm` takes an optional `tracer` (default: the global `@softure-ai/llm` tracer); the test passes one from its own `BasicTracerProvider` with an in-memory exporter. |
| F3 | Warning | Usage numbers default to `0` when the provider reports nothing, which makes a missing count look like a free call. | Kept: a quota needs numbers, and a provider that reports no usage at all is rare; the README says so. `costUsd` stays `null` only for an unpriced model. |
| F4 | Suggestion | `result.usage` is the last step, `result.totalUsage` the sum; without tools there is one step. | Use `totalUsage`, so the record stays right if a later version adds steps. |
| F5 | Suggestion | `@opentelemetry/sdk-trace-base` is only in the lockfile as a transitive dependency. | Add it as a dev dependency of the package with the lockfile's version. |

No migration, no change to another package's contract.
