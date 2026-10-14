# Implementation review: llm-package

Reviewed: the diff of `claude/project-thread-umylap` against `plan.md`, the plan review and issue #472. Verdict:
**approved**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | The plan accepted a bare model id (the AI SDK gateway). Measured while testing: the gateway throws `GatewayAuthenticationError` and siblings from `@ai-sdk/gateway`, which are not `AISDKError`s and which `ai` does not export, so they would escape the error mapping as exceptions. | Fixed: `LlmModel` excludes the string form; the app passes a provider's model object, which is what the owner's scope asked for. Recorded in plan D1 and the README. |
| F2 | Warning | The race in D3 could leave a late rejection unhandled (plan review F1). | Verified: the SDK promise is settled into a value before the race; a test rejects after the timeout and asserts no `unhandledRejection`. |
| F3 | Suggestion | `fakeModel` builds on `MockLanguageModelV4` from `ai/test`, a public entry of the SDK that imports no test runner. A future major may move it. | Kept: the peer range stops at major 7, so a move arrives with a deliberate upgrade of this package. |
| F4 | Suggestion | `onUsage` runs after the span ends, so a slow hook does not inflate the span's duration; a throwing hook still propagates. | Kept as designed (plan D5); tested. |

Every phase is done; tests were written with the code (30 package tests: success, both invalid-output shapes,
unavailable, timeout with and without abort support, timer cleanup, per-call overrides, non-SDK errors, failing hook,
option validation, cost, usage mapping, fake model, spans). `tests/repo/release-tags.test.ts` counts 23 public
packages. Gates: typecheck, lint, build green; `npm test` result in the PR.
