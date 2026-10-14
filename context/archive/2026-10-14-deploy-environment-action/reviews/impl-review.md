---
change_id: deploy-environment-action
reviewed: 2026-10-14
verdict: approved
---

# Implementation review: deploy-environment-action

Reviewed: the branch diff against plan.md, change.md and issue #468.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance: a caller job with `environment:` runs `.github/actions/deploy` and renders `.env.prod` from that environment's `secrets` and `vars`; nothing needs `secrets: inherit`, so an app of another owner works. | No change. |
| 2 | Check | One implementation: `deploy-app.yml`'s deploy and verify jobs check out the workflow's own commit (`job.workflow_repository`, `job.workflow_sha`) and run the same action; callers with one `uses:` line change nothing (repository tests and the e2e suite cover both paths). | No change. |
| 3 | Check | `deploy: false` refuses every secret and the deploy-only inputs, so a secret never sits in a job that does not use it; the `release` object is the single source of checked values and the action refuses one missing a key. | No change. |
| 4 | Check | Values from `release` are written to `GITHUB_OUTPUT` with random heredoc delimiters; `app-url` overrides are validated by the check job's pattern; `verify-env` keeps the check job's reserved names and masking. | No change. |
| 5 | Warning | actionlint 1.7.12 does not know `job.workflow_repository`/`job.workflow_sha`; `.github/actionlint.yaml` ignores exactly that message for `deploy-app.yml`. | Accepted; drop the ignore once actionlint knows the properties. |
| 6 | Warning | The action checks out the app into `.softure-ai-release/` in the caller's job; a caller that checks out its own repository there first would be overwritten. | Accepted: documented path, unlikely name. |
| 7 | Deviation | Plan phase 3 named a bump to 0.3.0 in this change. The repository bumps at release time (`npm run release:version -- deploy minor`, which renames `## Unreleased`), so the CHANGELOG entry stays `## Unreleased` and the workflow defaults follow the release commit. | Recorded. |
| 8 | Check | Docs: README (action section, input table, `deploy` input, pinning), CHANGELOG with migration steps, `examples/deploy-environments.yml` linted in CI. | No change. |

Gates: see plan.md Progress.
