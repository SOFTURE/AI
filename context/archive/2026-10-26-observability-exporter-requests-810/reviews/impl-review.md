---
change_id: observability-exporter-requests-810
verdict: approved
---

# Implementation review

Reviewed the diff of f1753b1 and 8dac839 against plan.md.

- Fix: `startHttpInstrumentation` passes `ignoreOutgoingRequestHook` from `createExportRequestMatcher` over the
  resolved trace, log and metric URLs. The instrumentation then runs the original `request` for those calls: no
  span (already suppressed by the exporter), no `http.client.request.duration`, no context injection. A restart sets
  the hook from the new configuration (`setConfig` on the reused instance).
- Scope: only exact URL matches are skipped; another path, query, port or scheme on the collector's host is still
  measured. The Next.js adapter keeps `instrumentations.http: false` and is unaffected.
- Tests: the new start test fails on master (`localhost`, the export host, appears in the metric body) and passes
  with the fix, with a positive control for the program's own `node:http` call. `syncBuiltinESMExports` reproduces
  an app whose first `http` import comes after start, and `afterEach` syncs back after the instrumentation is off.
  Matcher unit tests cover default ports, host case, IPv6, near misses and an empty list.
- Docs: README Metrics paragraph; CHANGELOG `Unreleased` reworded so the series count is the measurement from the
  issue, not a claim of this change.
- Gates: typecheck, lint and language green in the pre-commit hook; observability tests 113/113.

Verdict: approved after one wording fix in the CHANGELOG.
