# Plan review: deploy-cut-release

Reviewed: plan.md against change.md, research.md, `deploy-app.yml`, `tools/deploy/examples/deploy.yml`,
`tests/repo/deploy-workflows.test.ts`, `ci.yml` and FIRE's `auto-release.yml`. Verdict: **approve with fixes** (all
applied below).

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Warning | The generic tests over `deploy-*.yml` require SSH host-key options and a `build` job with `packages: write`; a new `deploy-cut-release.yml` has neither, so the suite would fail for the wrong reason. | Accepted, already in step 1: those two checks apply only to workflows with SSH or a build job; every other generic check stays. |
| 2 | Warning | `gh workflow run … -f tag=<tag>` fails with "unexpected inputs" when the app's deploy workflow has no `tag` input; the plan did not say so. | Accepted: the README states the contract (a `workflow_dispatch` input `tag`, as `deploy.yml` and `init`'s template have), and a test checks the example `deploy.yml` declares it. |
| 3 | Suggestion | The caller pins `@deploy-workflows-v1`; the new file exists under that tag only after the owner moves it. | Accepted: added to the manual line in Progress next to DP-8. |
| 4 | Suggestion | `timezone` checked as a path under `/usr/share/zoneinfo` would accept `../../etc/passwd`-like values. | Accepted: the value must also match `^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$` before the file test. |
| 5 | Check | DF-11's tag guard (commit on the default branch) and DF-12 compose: the tag targets the dispatched default-branch SHA. | No change. |
| 6 | Check | The release step must not interpolate the description: it goes through `env:` (the existing no-interpolation test covers it). | No change. |
