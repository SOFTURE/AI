# Implementation review: deploy-cut-release

Reviewed: commit `edc4b94` (and the merge of `master` with DF-9) against plan.md, the plan review and the project
rules. Verdict: **approve**; one finding fixed before the commit, one gap queued.

## Checks run

- Repository test red before the workflow existed (`deploy-cut-release.yml` missing: the suite failed to load), green
  after: 59 tests in `tests/repo/deploy-workflows.test.ts`, the step scripts run with `bash` against a fake `gh` and
  a fake `date` (the zone has to reach `date`, or the tag comes out wrong).
- `npm run typecheck`, `npm run lint`, `npm test` (3743 passed before the fix below, then the repository tests again),
  `npm run build`: green.
- actionlint 1.7.12 with shellcheck 0.11.0 over `.github/workflows/` and both examples: clean.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | `tests/repo/ci-workflows.test.ts` requires `timeout-minutes` on every job; the `cut` job had none (a hung `gh` would hold the concurrency group for six hours). | Fixed in `edc4b94`: `timeout-minutes: 5`. |
| 2 | Suggestion | `softure-deploy init` writes `.github/workflows/deploy.yml` but not the release caller, so an app copies `examples/release.yml` by hand. | Gap: **DF-16** (`deploy-init-release-caller`), queued in the deploy-followups roadmap. |
| 3 | Check | Plan drift: none. Generic tests over `deploy-*.yml` still apply to both workflows; the SSH and `packages: write` checks now apply where there is SSH or a build job (deploy-app.yml keeps both). | No change. |
| 4 | Check | Security: the description, prefix, zone and workflow name reach scripts only through `env:`; the zone is pattern-checked before the file test; the job has `contents: write` + `actions: write` and nothing else; no checkout, so no app hook or `.npmrc` runs with a write token. | No change. |
| 5 | Check | A release made with `GITHUB_TOKEN` does not fire `release: published`, so `deploy.yml` runs once (from the dispatch), not twice. | No change. |

## Not verified here

The first real run in an app (a live tag, release and deploy) is the owner's; it is recorded in `## Progress`.
