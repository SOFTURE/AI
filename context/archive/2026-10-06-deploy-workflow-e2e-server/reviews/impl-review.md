# Implementation review: deploy-workflow-e2e-server

Reviewed: the branch against plan.md (both phases), change.md and research.md; the diff of `deploy-app.yml`,
`e2e-deploy.yml`, `tools/deploy/e2e/`, `scripts/write-e2e-app.ts`, the regenerated e2e app and both test files.
Mode: autonomous (`--auto`), every finding decided by the reviewer.

## Drift from the plan

None. Both phases landed in one commit (`a694f98`), as DF-3 did; the plan's files, steps and tests are all there.
The repository test checks nine test-only deploy steps, as planned.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| I1 | Warning | The cleanup step deletes `$RUNNER_TEMP/e2e-server` as the runner's user while `sshd.log` and `sshd.pid` in it belong to root. | No change: deleting a file needs write access to its folder, which the runner's user owns; the files go. sshd itself keeps running until the runner is gone, with nothing left to authorise. |
| I2 | Warning | The log step prints the stack's container logs, which could carry a secret if an app logged one. | No change: every value in the test's `.env.prod` is a placeholder from `e2e-deploy.yml`; production never takes this path (`check` refuses `e2e` outside SOFTURE/AI). |
| I3 | Warning | The `verify` job's wait loop is copied into the deploy job. | Already guarded: the repository test fails when the two scripts or their env differ (P5). |
| I4 | Suggestion | `start-server.sh` is checked by tests only up to its input validation; the Docker, sshd and certificate half runs only in CI and in the local run. | No change: it needs `sudo`, Docker and ports 80/443/5000; the `e2e-deploy` run on the pull request is the test (Progress, Manual). |
| I5 | Suggestion | A runner image that ships PostgreSQL's client in a newer major than the compose file's server (17 against 16) would still back up (pg_dump reads older servers). | No change; noted for the reader. |

Security: the test path stays behind `check`'s repository gate; the CA and keys are made per run and deleted at
the end; the authorised key reaches only the forced command (`restrict`); `start-server.sh` refuses paths that could
break out of `sshd_config` or the authorised line (tested). Nothing new reaches the production path: every added
step and output is under `inputs.e2e`, and the production `verify` job is unchanged.

Gates: `npm run typecheck`, `npm run lint`, `npm test` (3820 tests, after the link fix in `backlog-input.md`),
`npm run build`, actionlint 1.7.12 and shellcheck on every script: green. The red-first check: the recorder test
(no `result|` line) failed on DF-9's recorder; the forced-command and npx tests failed before the scripts existed;
the repository tests failed before the workflow changed.

No open blocking findings.
