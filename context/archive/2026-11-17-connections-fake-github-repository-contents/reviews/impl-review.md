---
change_id: connections-fake-github-repository-contents
verdict: approved
---

# Implementation review

- Drift: none.
- Correctness: blob ids checked against git's formula in a test; a comparison from an unknown commit answers 404, a
  force-pushed head `diverged`.
- Gates: typecheck, ESLint and the connections tests green.

Verdict: approved.
