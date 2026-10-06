# Plan review: deploy-workflow-release-guards

Reviewed: plan.md against change.md, research.md, `deploy-app.yml`, `e2e-deploy.yml`, `deploy.sh.tmpl`, the three
test files and lessons. Mode: autonomous (`--auto`), every finding decided by the reviewer.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| P1 | Critical | The e2e caller deploys `github.sha`; on a pull request that is the merge commit, on no branch, so the new guard would fail every e2e run. | Accepted (already in the plan): the head commit and the head branch; the `assert` job checks out the same commit. A dispatch has to run from a branch; noted in the plan. |
| P2 | Warning | `docker login` into the host's own config would replace, and a `logout` would remove, a login the owner set up; a failed run could leave the token there. | Accepted (already in the plan): login and pull under `DOCKER_CONFIG` in the run's temp folder, removed by the existing trap. |
| P3 | Warning | A `deploy.sh` from before this change copies every archive member next to itself, so the token file would land in `/srv/<app>/` on the first release. | Accepted: `registry-token: false` for such a server, stated in the README and the manual step; the token expires with the deploy job. |
| P4 | Warning | The comparison step must never print a value: the runtime side is a secret, and the error is read in a public log. | Accepted (already in the plan): the error names the variable only; a test asserts neither value appears. |
| P5 | Warning | The deploy job's token pulls only when the package grants the repository access; a package pushed by the build job of that repository is linked by its `org.opencontainers.image.source` label. | Accepted: README says so; `registry-token: false` otherwise. |
| P6 | Suggestion | The manual step named a tag the owner asked not to be reminded of. | Accepted: the manual step names only the package release. |
| P7 | Suggestion | `deploy.sh.tmpl` is DF-9's file too, running in parallel. | No change: the edit stays around the archive check and the pull; whoever merges second resolves. |

No open blocking findings. Plan updated (P1, P3, P6 wording).
