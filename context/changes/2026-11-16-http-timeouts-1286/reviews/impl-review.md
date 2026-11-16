---
change_id: http-timeouts-1286
verdict: approved
---

# Implementation review

Reviewed d75491f against plan.md.

- Each call site sends `AbortSignal.timeout(timeoutMs)`; defaults 10 s (fonts, CLI) and 30 s (Grafana, Cloudflare),
  each configurable.
- The OG loader's single signal covers headers and body; a timed-out read goes through the existing failure path,
  which deletes the cache entry (test: two calls, two fetches).
- The agent-ready CLI wraps its fetch once, so the DoH, skills and directory requests all inherit the deadline;
  `skillsIndexSchema` replaces the cast and a malformed index is a failed line.
- Five new tests failed on master (hung past the 3 s test timeout) and pass now. CHANGELOG `## Unreleased` of the four
  packages. No version bump.
- Gates: pre-commit typecheck, ESLint, language gate green; package tests 1010 passed.

Verdict: approved, no findings.
