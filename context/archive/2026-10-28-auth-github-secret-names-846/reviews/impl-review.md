---
change_id: auth-github-secret-names-846
verdict: approved
---

# Implementation review

- README example uses `GH_AUTH_CLIENT_ID` / `GH_AUTH_CLIENT_SECRET`, followed by one sentence on why (GitHub
  Actions refuses secret names starting with `GITHUB_`).
- `githubProviderSchema` hints name the same variables; the regex is unchanged, so any name still parses.
- CHANGELOG `## Unreleased` carries the bullet.
- No other `GITHUB_AUTH_*` outside tests (grep). auth tests green.

Verdict: approved, no changes.
