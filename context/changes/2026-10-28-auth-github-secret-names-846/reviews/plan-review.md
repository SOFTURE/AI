---
change_id: auth-github-secret-names-846
verdict: approved
---

# Plan review

- Acceptance of #846 covered: README example, `ENV_NAME` hint in `githubProviderSchema`, one sentence on why.
- Compatibility: no behaviour change; an app with `GITHUB_*` names keeps working.
- No test asserts the old hint text (grep over `modules/auth/tests`), so no test changes.

Verdict: approved, no changes.
