---
change_id: deploy-integration-ref-delete-684
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the workflow on master.

- Scope: the one ask (the endpoint) plus the issue's suggested assertion, realised as a test that fails on the old
  path. The 422 "already gone" and 403 cases stay covered.
- Shell: `${GITHUB_REF#refs/}` stays; only the literal `git/` becomes `git/refs/`. Bash 3.2 safe.
- The stub must log calls inside its own temp directory so the test can read them and cleans them up.

Verdict: approved, no changes.
