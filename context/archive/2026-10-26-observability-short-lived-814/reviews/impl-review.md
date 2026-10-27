---
change_id: observability-short-lived-814
verdict: approved
---

# Implementation review

Reviewed the diff 92f5756..cadfb37 against plan.md and the issue.

- Every ask is covered: `lifetime: "short"` turns metric export off in the resolver (so no meter provider, no runtime
  metrics, the HTTP duration metric on the no-op provider), traces and logs are unchanged, a `beforeExit` listener
  flushes through the memoized `shutdown()`, and the README's "Series" paragraph names the cost per run.
- The test is a real child process that never calls `shutdown()`: its log reaches the receiver, nothing reaches
  `/v1/metrics`, and its own exit code (3) survives. It failed before the implementation (no log delivered).
- An explicit `shutdown()` before the end stays harmless (memoized); a second `startObservability` returns the first
  handle and adds no listener; dispose removes the listener, so tests do not stack them.
- The listener swallows a shutdown rejection on purpose: export errors already go to the diag logger, and telemetry
  must not turn a finished script into a crash.
- Gates: observability tests 110 passed, typecheck and ESLint clean, language gate green.

Verdict: approved, no changes.
