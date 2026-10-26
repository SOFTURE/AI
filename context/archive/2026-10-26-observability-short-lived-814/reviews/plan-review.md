---
change_id: observability-short-lived-814
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (4b2821f).

- Scope covers every ask of the issue: metrics off, logs and traces stay, a flush before the process exits, and the
  README's "Series" paragraph naming the cost in one-shot processes.
- Compatibility: additive option; the default path is unchanged, so long-running services see no difference.
- Safety: the `beforeExit` listener is `once`, calls the memoized `shutdown()` and is removed on dispose, so a
  restart in tests does not stack listeners; it never calls `process.exit` and keeps `process.exitCode`.
- Tests: a real child process proves the flush without an explicit `shutdown()`, the absence of `/v1/metrics` and the
  kept exit code; the resolver test covers a per-signal metrics endpoint too.
- Risk: the flush to an unreachable endpoint delays the exit by the exporters' timeout (10 s each). Acceptable for a
  script and the same as an explicit `shutdown()` today; note it in the README.

Verdict: approved, no changes.
