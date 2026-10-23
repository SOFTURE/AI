---
change_id: deploy-gh-self-hosted-686
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the issue.

- Scope: the five jobs that call `gh` are all covered (research table, checked with a grep over every reusable
  workflow and the composite action). The issue's first outcome is delivered; the second (a readable failure) covers
  what cannot be installed.
- Security: the download is pinned by version and SHA-256 and verified before unpacking; nothing lands outside
  `$RUNNER_TEMP`; no `sudo`. The token is not needed for the download.
- No regression on hosted runners: `command -v gh` short-circuits.
- Portability: bash 3.2, `sha256sum` with a `shasum -a 256` fallback so the test runs on macOS.
- Tests: the guard derives the jobs from their scripts, so a new job that calls `gh` without the step fails the suite.
  The success path is tested by swapping the pinned sum for the test archive's, which exercises the real script.

Verdict: approved, no changes.
