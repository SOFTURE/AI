---
change_id: quality-review-workflow-1212
verdict: approved
---

# Plan review (auto)

- Scope matches #1212 point by point: read-only SDK agent, prompt in this repository, on demand and always full, cost
  cap and header, stable format with ids and a validator, ignore file, one pull request with minimum permissions, the
  secret in the repository, runner as an input, tests without the API, example caller, README, changelog.
- Risk: the SDK option names drift between versions; the version is pinned in the workflow and the options are typed
  locally and tested. The 340 MB binary stays out of the monorepo install (optional peer).
- Risk: a reviewed repository's `.claude/settings.json` could add hooks or permissions; `settingSources: []` closes it.
- Approved.
