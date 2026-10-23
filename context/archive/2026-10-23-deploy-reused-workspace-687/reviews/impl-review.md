---
change_id: deploy-reused-workspace-687
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: twelve jobs in six reusable workflows (`deploy-release-checks` prepare/static/unit, `deploy-app`
  check/build/deploy/verify, `deploy-integration` test/record, `deploy-release-image` build, `deploy-report` report,
  `blog-links` links) run "Empty the workspace" right after "Check the runner"; jobs without a checkout (summary,
  cancel, cut-release, release-notes) are untouched. Files with anchors define `&empty-workspace` once.
- Order: the step runs before anything writes into the workspace; in `deploy-app`'s deploy job the `.softure-ai-*`
  checkouts come after it, so nothing they need is removed. `blog-links`' `defaults.run.working-directory` is
  bypassed with `working-directory: ${{ runner.temp }}`.
- Shell: `${GITHUB_WORKSPACE:?}` aborts on an unset variable before `find` runs; `-mindepth 1 -maxdepth 1` keeps the
  folder; `find -exec ... +` returns non-zero when `rm` fails, and the error names the workspace and the fix. Bash
  3.2, BSD and GNU safe.
- Tests: the guard covers every current and future reusable job that checks out; the behaviour tests cover dot files,
  a `.git` folder, an empty workspace, a failing `rm` and an unset variable.
- Docs: README "Runner" explains the cause and the job-started hook for the app's own jobs; CHANGELOG `## Unreleased`
  says nothing changes for the caller.
- Gates: typecheck, ESLint and language through the hooks; `tests/repo` green (667 passing).

Verdict: approved, no changes.
