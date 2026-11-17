---
change_id: connections-github-app-installations
verdict: approved
---

# Implementation review

- Drift: none.
- Correctness: a write answer without a body (`requestJson` types it optional) is `github_app_unexpected`, found by the
  typecheck and fixed. The user code exchange reads an OAuth error from a 200 as GitHub sends it.
- Security: errors carry only a code, the status and `retryAfterSeconds` (test with a fetch error quoting a token);
  the fake checks the JWT signature, issuer and lifetime the way GitHub does.
- Tests: 8 cases, every failure code covered. Gates: typecheck, ESLint on the module, the connections and repository
  tests green, except `tests/repo/deploy-workflows.test.ts`, which needs `ssh-keygen` (missing in the container, the
  same on master; CI runs it).

Verdict: approved.
